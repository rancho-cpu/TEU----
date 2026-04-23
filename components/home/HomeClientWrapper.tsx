'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Assignment, Survey, ScheduleSession, ScheduleSpeaker } from '@/types'
import { ScheduleTable } from './ScheduleTable'
import { AddScheduleModal } from './AddScheduleModal'
import { Button } from '@/components/ui/button'
import { ClipboardList, AlertCircle, Plus, CalendarDays, CheckCircle2, Download, Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DueItem {
  id: string
  kind: 'assignment' | 'survey'
  title: string
  deadline: string
  submitted: boolean
}

interface Props {
  cohortId: string
  isAdmin: boolean
  dueItems: DueItem[]
  sessions: ScheduleSession[]
}

function formatDeadline(d: string) {
  const date = new Date(d)
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const hours = Math.floor(diff / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  if (diff < 0) return '마감됨'
  if (hours < 1) return `${mins}분 남음`
  if (hours < 24) return `${hours}시간 ${mins}분 남음`
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} 마감`
}

// ── CSV 헤더 정의 ──────────────────────────────────────────
const CSV_HEADERS = [
  '차수', '날짜(YYYY-MM-DD)', '장소(온라인/오프라인)', '시작(HH:MM)', '종료(HH:MM)',
  '섹션(복수는 | 구분)', '강연주제/내용',
  '연사1이름', '연사1소속', '연사1직책',
  '연사2이름', '연사2소속', '연사2직책',
  '연사3이름', '연사3소속', '연사3직책',
]

const CSV_EXAMPLE = [
  '1', '2026-07-12', '오프라인', '13:30', '14:30',
  '키노트', 'Life is what you make it',
  '홍길동', '서울대학교', '교수',
  '', '', '',
  '', '', '',
]

const CSV_EXAMPLE2 = [
  '1', '2026-07-12', '오프라인', '14:30', '15:30',
  '퍼스펙티브|익스포넨셜', '미래혁신과 기술',
  '김철수', '카카오', '대표',
  '이영희', '네이버', '이사',
  '', '', '',
]

function downloadTemplate() {
  const rows = [CSV_HEADERS, CSV_EXAMPLE, CSV_EXAMPLE2]
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '스케줄_양식.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── 간단한 CSV 파서 (따옴표 포함 처리) ──────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const cells: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    cells.push(cur.trim())
    rows.push(cells)
  }
  return rows
}

function rowToSession(cells: string[], cohortId: string): Omit<ScheduleSession, 'id' | 'created_at'> | null {
  const [weekNum, date, location, start, end, sections, topic,
    s1n, s1a, s1t, s2n, s2a, s2t, s3n, s3a, s3t] = cells

  if (!weekNum || !date || !start || !end || !topic?.trim()) return null

  const section_types = (sections ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)

  const speakers: ScheduleSpeaker[] = [
    { name: s1n ?? '', affiliation: s1a ?? '', title: s1t ?? '' },
    { name: s2n ?? '', affiliation: s2a ?? '', title: s2t ?? '' },
    { name: s3n ?? '', affiliation: s3a ?? '', title: s3t ?? '' },
  ].filter((s) => s.name.trim())

  return {
    cohort_id: cohortId,
    week_num: parseInt(weekNum) || 1,
    session_date: date.trim(),
    location: location?.trim() || '오프라인',
    start_time: start.trim(),
    end_time: end.trim(),
    section_types,
    topic: topic.trim(),
    speakers,
    order_index: 0,
  }
}

export function HomeClientWrapper({ cohortId, isAdmin, dueItems, sessions: initialSessions }: Props) {
  const supabase = createClient()
  const [sessions, setSessions] = useState<ScheduleSession[]>(initialSessions)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<ScheduleSession | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSaved = (session: ScheduleSession) => {
    setSessions((prev) => {
      const exists = prev.find((s) => s.id === session.id)
      return exists
        ? prev.map((s) => (s.id === session.id ? session : s))
        : [...prev, session].sort((a, b) => {
            if (a.week_num !== b.week_num) return a.week_num - b.week_num
            if (a.session_date !== b.session_date) return a.session_date.localeCompare(b.session_date)
            return a.start_time.localeCompare(b.start_time)
          })
    })
  }

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileRef.current) fileRef.current.value = ''
    setUploading(true)
    setUploadMsg(null)

    try {
      const text = await file.text()
      const rows = parseCSV(text)
      // 첫 행은 헤더 → 건너뜀
      const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim()))

      const payloads = dataRows
        .map((r) => rowToSession(r, cohortId))
        .filter((p): p is NonNullable<typeof p> => p !== null)

      if (payloads.length === 0) {
        setUploadMsg({ type: 'err', text: '유효한 행이 없습니다. 양식을 확인하세요.' })
        return
      }

      const { data, error } = await supabase
        .from('schedule_sessions')
        .insert(payloads)
        .select()

      if (error) { setUploadMsg({ type: 'err', text: error.message }); return }

      const inserted = (data as ScheduleSession[]).sort((a, b) => {
        if (a.week_num !== b.week_num) return a.week_num - b.week_num
        if (a.session_date !== b.session_date) return a.session_date.localeCompare(b.session_date)
        return a.start_time.localeCompare(b.start_time)
      })

      setSessions((prev) =>
        [...prev, ...inserted].sort((a, b) => {
          if (a.week_num !== b.week_num) return a.week_num - b.week_num
          if (a.session_date !== b.session_date) return a.session_date.localeCompare(b.session_date)
          return a.start_time.localeCompare(b.start_time)
        })
      )
      setUploadMsg({ type: 'ok', text: `${inserted.length}개 세션이 추가되었습니다.` })
    } catch {
      setUploadMsg({ type: 'err', text: '파일 파싱에 실패했습니다.' })
    } finally {
      setUploading(false)
    }
  }

  const unsubmitted = dueItems.filter((d) => !d.submitted)

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-8">

      {/* 오늘 마감 과제 */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          오늘 마감 과제 / 설문
        </h2>
        {dueItems.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-700 font-medium">오늘 마감인 과제 / 설문이 없습니다 🎉</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {dueItems.map((item) => (
              <Link
                key={item.id}
                href={`/${cohortId}/assignments`}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border transition-all hover:shadow-md',
                  item.submitted
                    ? 'bg-gray-50 border-gray-200 opacity-60'
                    : 'bg-white border-rose-200 shadow-sm hover:border-rose-300'
                )}
              >
                <ClipboardList className={cn('w-5 h-5 flex-shrink-0 mt-0.5', item.submitted ? 'text-gray-400' : 'text-rose-500')} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold truncate', item.submitted ? 'text-gray-500 line-through' : 'text-gray-900')}>
                    {item.title}
                  </p>
                  <p className={cn('text-xs mt-0.5', item.submitted ? 'text-gray-400' : 'text-rose-500 font-medium')}>
                    {item.submitted ? '제출 완료' : formatDeadline(item.deadline)}
                  </p>
                </div>
                {!item.submitted && (
                  <span className="text-xs bg-rose-500 text-white font-semibold px-2 py-0.5 rounded-full flex-shrink-0">제출하기</span>
                )}
              </Link>
            ))}
          </div>
        )}
        {unsubmitted.length > 0 && (
          <p className="text-xs text-rose-400 mt-2 pl-1">미제출 {unsubmitted.length}건 있습니다. 서둘러 제출하세요!</p>
        )}
      </section>

      {/* 전체 스케줄 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-500" />
            전체 스케줄
          </h2>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={downloadTemplate}>
                <Download className="w-3.5 h-3.5" />양식 다운로드
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                CSV 업로드
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setEditingSession(null); setModalOpen(true) }}>
                <Plus className="w-3.5 h-3.5" />세션 추가
              </Button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
            </div>
          )}
        </div>

        {uploadMsg && (
          <div className={cn(
            'mb-3 px-4 py-2.5 rounded-lg text-sm font-medium',
            uploadMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
          )}>
            {uploadMsg.text}
          </div>
        )}

        <ScheduleTable
          sessions={sessions}
          isAdmin={isAdmin}
          onEdit={(s) => { setEditingSession(s); setModalOpen(true) }}
        />
      </section>

      <AddScheduleModal
        key={editingSession?.id ?? 'new'}
        cohortId={cohortId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        editing={editingSession}
      />
    </div>
  )
}
