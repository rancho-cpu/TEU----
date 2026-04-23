'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ScheduleSession, ScheduleSpeaker } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Trash2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const SECTION_TYPES = [
  '키노트', '그랜드챌린지', '퍼스펙티브', '익스포넨셜', '이노베이션킷', '개인/팀프로젝트',
]

interface Props {
  cohortId: string
  open: boolean
  onClose: () => void
  onSaved: (session: ScheduleSession) => void
  editing?: ScheduleSession | null
}

const emptySpeaker = (): ScheduleSpeaker => ({ name: '', affiliation: '', title: '' })

export function AddScheduleModal({ cohortId, open, onClose, onSaved, editing }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [weekNum, setWeekNum] = useState(editing?.week_num?.toString() ?? '1')
  const [sessionDate, setSessionDate] = useState(editing?.session_date ?? '')
  const [location, setLocation] = useState(editing?.location ?? '오프라인')
  const [startTime, setStartTime] = useState(editing?.start_time?.slice(0, 5) ?? '')
  const [endTime, setEndTime] = useState(editing?.end_time?.slice(0, 5) ?? '')
  const [sectionTypes, setSectionTypes] = useState<string[]>(editing?.section_types ?? [])
  const [topic, setTopic] = useState(editing?.topic ?? '')
  const [speakers, setSpeakers] = useState<ScheduleSpeaker[]>(
    editing?.speakers?.length ? editing.speakers : [emptySpeaker()]
  )

  const toggleSection = (type: string) =>
    setSectionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )

  const updateSpeaker = (idx: number, field: keyof ScheduleSpeaker, value: string) =>
    setSpeakers((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)))

  const addSpeaker = () => setSpeakers((prev) => [...prev, emptySpeaker()])
  const removeSpeaker = (idx: number) => setSpeakers((prev) => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionDate || !startTime || !endTime || !topic.trim()) {
      setError('날짜, 시간, 주제를 입력해주세요.')
      return
    }
    setLoading(true)
    setError(null)

    const cleanedSpeakers = speakers
      .filter((s) => s.name.trim())
      .map((s) => ({ name: s.name.trim(), affiliation: s.affiliation.trim(), title: s.title.trim() }))

    const payload = {
      cohort_id: cohortId,
      week_num: parseInt(weekNum),
      session_date: sessionDate,
      location,
      start_time: startTime,
      end_time: endTime,
      section_types: sectionTypes,
      topic: topic.trim(),
      speakers: cleanedSpeakers,
    }

    const query = editing
      ? supabase.from('schedule_sessions').update(payload).eq('id', editing.id).select().single()
      : supabase.from('schedule_sessions').insert(payload).select().single()

    const { data, error: err } = await query
    if (err) { setError(err.message); setLoading(false); return }
    onSaved(data as ScheduleSession)
    onClose()
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!editing) return
    setDeleting(true)
    await supabase.from('schedule_sessions').delete().eq('id', editing.id)
    setDeleting(false)
    onClose()
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? '세션 수정' : '새 세션 추가'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* 차수 + 날짜 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">차수</Label>
              <Input type="number" min={1} value={weekNum} onChange={(e) => setWeekNum(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">날짜</Label>
              <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className="text-sm" />
            </div>
          </div>

          {/* 시간 + 장소 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">시작</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">종료</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">장소</Label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option>오프라인</option>
                <option>온라인</option>
              </select>
            </div>
          </div>

          {/* 섹션 다중 선택 */}
          <div className="space-y-1.5">
            <Label className="text-xs">섹션 <span className="text-gray-400">(복수 선택 가능)</span></Label>
            <div className="flex flex-wrap gap-2">
              {SECTION_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleSection(t)}
                  className={cn(
                    'text-xs px-3 py-1 rounded-full border-2 font-medium transition-all',
                    sectionTypes.includes(t)
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 주제 */}
          <div className="space-y-1">
            <Label className="text-xs">강연 주제 / 내용</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="주제를 입력하세요" className="text-sm" />
          </div>

          {/* 연사 (다중) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">연사</Label>
              <button
                type="button"
                onClick={addSpeaker}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" />연사 추가
              </button>
            </div>
            <div className="space-y-2">
              {speakers.map((sp, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="grid grid-cols-3 gap-2 flex-1">
                    <Input
                      value={sp.name}
                      onChange={(e) => updateSpeaker(idx, 'name', e.target.value)}
                      placeholder="이름"
                      className="text-sm"
                    />
                    <Input
                      value={sp.affiliation}
                      onChange={(e) => updateSpeaker(idx, 'affiliation', e.target.value)}
                      placeholder="소속"
                      className="text-sm"
                    />
                    <Input
                      value={sp.title}
                      onChange={(e) => updateSpeaker(idx, 'title', e.target.value)}
                      placeholder="직책"
                      className="text-sm"
                    />
                  </div>
                  {speakers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSpeaker(idx)}
                      className="mt-2 text-gray-300 hover:text-red-400 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            {editing ? (
              <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />{deleting ? '삭제 중...' : '삭제'}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>취소</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                {editing ? '저장' : '추가'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
