'use client'

import type { ScheduleSession } from '@/types'
import { cn } from '@/lib/utils'
import { MapPin, Wifi } from 'lucide-react'

export const SECTION_STYLE: Record<string, string> = {
  '키노트':          'bg-blue-100 text-blue-800',
  '그랜드챌린지':    'bg-orange-100 text-orange-800',
  '퍼스펙티브':      'bg-teal-100 text-teal-800',
  '익스포넨셜':      'bg-purple-100 text-purple-800',
  '이노베이션툴킷':  'bg-rose-100 text-rose-800',
  '개인/팀프로젝트': 'bg-amber-100 text-amber-800',
  '필드트립':        'bg-green-100 text-green-800',
}

function sectionStyle(type: string) {
  return SECTION_STYLE[type] ?? 'bg-gray-100 text-gray-700'
}

interface Props {
  sessions: ScheduleSession[]
  isAdmin?: boolean
  onEdit?: (session: ScheduleSession) => void
}

export function ScheduleTable({ sessions, isAdmin, onEdit }: Props) {
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-12">등록된 스케줄이 없습니다.</p>
    )
  }

  const byWeek = new Map<number, Map<string, ScheduleSession[]>>()
  for (const s of sessions) {
    if (!byWeek.has(s.week_num)) byWeek.set(s.week_num, new Map())
    const byDate = byWeek.get(s.week_num)!
    if (!byDate.has(s.session_date)) byDate.set(s.session_date, [])
    byDate.get(s.session_date)!.push(s)
  }

  const weeks = [...byWeek.entries()].sort((a, b) => a[0] - b[0])

  const dayLabel = (d: string) => ['일', '월', '화', '수', '목', '금', '토'][new Date(d).getDay()]
  const dateLabel = (d: string) => {
    const dt = new Date(d)
    return `${dt.getMonth() + 1}월 ${dt.getDate()}일`
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">차수</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">일정</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">장소</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">일시</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">섹션</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">강연 주제 / 내용</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">연사</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">소속</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">직책</th>
            {isAdmin && <th className="px-3 py-2.5 w-10" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {weeks.map(([weekNum, byDate]) => {
            const dates = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))
            const totalRows = dates.reduce((sum, [, s]) => sum + s.length, 0)
            let weekRendered = false

            return dates.map(([date, daySessions]) => {
              const sorted = [...daySessions].sort((a, b) => a.start_time.localeCompare(b.start_time))

              return sorted.map((session, idx) => {
                const showWeek = !weekRendered && idx === 0
                if (showWeek) weekRendered = true
                const showDate = idx === 0

                // 이 세션의 연사 수 (최소 1행)
                const speakerCount = Math.max(session.speakers.length, 1)

                return (
                  <tr key={session.id} className="hover:bg-gray-50/50 transition-colors align-top">
                    {showWeek && (
                      <td rowSpan={totalRows} className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-100">
                        {weekNum}주차
                      </td>
                    )}
                    {showDate && (
                      <td rowSpan={sorted.length} className="px-3 py-2 whitespace-nowrap border-r border-gray-100">
                        <p className="font-medium text-gray-800">{dateLabel(date)}</p>
                        <p className="text-xs text-gray-400">{dayLabel(date)}</p>
                      </td>
                    )}
                    {showDate && (
                      <td rowSpan={sorted.length} className="px-3 py-2 whitespace-nowrap border-r border-gray-100">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                          session.location === '온라인' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'
                        )}>
                          {session.location === '온라인' ? <Wifi className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                          {session.location}
                        </span>
                      </td>
                    )}
                    {/* 일시 */}
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600 font-mono text-xs">
                      {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}
                    </td>
                    {/* 섹션 — 복수 배지 */}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(session.section_types ?? []).map((t) => (
                          <span key={t} className={cn('text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', sectionStyle(t))}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    {/* 주제 */}
                    <td className="px-3 py-2 text-gray-800 max-w-xs">{session.topic}</td>
                    {/* 연사 — 다중 */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="space-y-1">
                        {session.speakers.length > 0
                          ? session.speakers.map((sp, si) => (
                              <p key={si} className="text-gray-700">{sp.name}</p>
                            ))
                          : <span className="text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="space-y-1">
                        {session.speakers.map((sp, si) => (
                          <p key={si} className="text-gray-500 text-xs">{sp.affiliation}</p>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="space-y-1">
                        {session.speakers.map((sp, si) => (
                          <p key={si} className="text-gray-500 text-xs">{sp.title}</p>
                        ))}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2">
                        <button onClick={() => onEdit?.(session)} className="text-xs text-gray-400 hover:text-indigo-600 underline">
                          수정
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })
            })
          })}
        </tbody>
      </table>
    </div>
  )
}
