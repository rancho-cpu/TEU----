'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Assignment, Survey, ScheduleSession } from '@/types'
import { ScheduleTable } from './ScheduleTable'
import { AddScheduleModal } from './AddScheduleModal'
import { Button } from '@/components/ui/button'
import { ClipboardList, AlertCircle, Plus, CalendarDays, CheckCircle2 } from 'lucide-react'
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

export function HomeClientWrapper({ cohortId, isAdmin, dueItems, sessions: initialSessions }: Props) {
  const [sessions, setSessions] = useState<ScheduleSession[]>(initialSessions)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<ScheduleSession | null>(null)

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
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setEditingSession(null); setModalOpen(true) }}>
              <Plus className="w-3.5 h-3.5" />세션 추가
            </Button>
          )}
        </div>
        <ScheduleTable
          sessions={sessions}
          isAdmin={isAdmin}
          onEdit={(s) => { setEditingSession(s); setModalOpen(true) }}
        />
      </section>

      <AddScheduleModal
        cohortId={cohortId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        editing={editingSession}
      />
    </div>
  )
}
