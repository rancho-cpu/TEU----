'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Search, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AssignmentStatItem {
  id: string
  title: string
  submission_count: number
  total_members: number
  percentage: number
  submitted_user_ids: string[]
  is_active: boolean
}

interface MemberStatItem {
  user_id: string
  name: string
  email: string
  avatar_url: string | null
  submitted: number
  total: number
  percentage: number
  submitted_assignment_ids: string[]
  responded_survey_ids: string[]
  // 진행된 항목 기준
  active_completed: number
  active_total: number
  active_percentage: number
  // 출석
  sessions_attended: number
  total_sessions: number
  participation_rate: number
  overall_attendance_rate: number
  offline_sessions_attended: number
  total_offline_sessions: number
  offline_participation_rate: number
  offline_overall_rate: number
  zoom_sessions_attended: number
  total_zoom_sessions: number
  zoom_participation_rate: number
  zoom_overall_rate: number
}

interface SurveyStatItem {
  title: string
  response_count: number
}

interface Props {
  assignmentStats: AssignmentStatItem[]
  memberStats: MemberStatItem[]
  surveyStats: SurveyStatItem[]
  totalMembers: number
  isAdmin: boolean
  allAssignments: { id: string; title: string }[]
  allSurveys: { id: string; title: string }[]
  totalSessions: number
  totalOfflineSessions: number
  totalZoomSessions: number
}

const BLUE_SHADES = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']

function getInitial(name: string) { return name.charAt(0).toUpperCase() }

function getRateColor(pct: number) {
  if (pct >= 80) return 'bg-blue-500'
  if (pct >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

function getRateTextColor(pct: number) {
  if (pct >= 80) return 'text-blue-600'
  if (pct >= 50) return 'text-amber-600'
  return 'text-red-500'
}

function getAttendColor(pct: number) {
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

function getAttendTextColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600'
  if (pct >= 50) return 'text-amber-600'
  return 'text-red-500'
}

/* ─── 멤버 행 컴포넌트 ─────────────────────────────────────── */
function MemberRow({
  m, rank, page, pageSize, idx, isExpanded, onToggle,
  allAssignments, allSurveys, attendanceMode,
}: {
  m: MemberStatItem
  rank: number
  page: number
  pageSize: number
  idx: number
  isExpanded: boolean
  onToggle: () => void
  allAssignments: { id: string; title: string }[]
  allSurveys: { id: string; title: string }[]
  attendanceMode: 'all' | 'offline' | 'zoom'
}) {
  const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

  const attended = attendanceMode === 'offline' ? m.offline_sessions_attended
    : attendanceMode === 'zoom' ? m.zoom_sessions_attended
    : m.sessions_attended
  const totalS = attendanceMode === 'offline' ? m.total_offline_sessions
    : attendanceMode === 'zoom' ? m.total_zoom_sessions
    : m.total_sessions
  const partRate = attendanceMode === 'offline' ? m.offline_participation_rate
    : attendanceMode === 'zoom' ? m.zoom_participation_rate
    : m.participation_rate
  const overallRate = attendanceMode === 'offline' ? m.offline_overall_rate
    : attendanceMode === 'zoom' ? m.zoom_overall_rate
    : m.overall_attendance_rate

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full grid grid-cols-[2fr_1fr_3fr_1fr] gap-3 items-center px-3 py-3 hover:bg-gray-50 transition-colors rounded-lg text-left"
      >
        {/* 이름 */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold">
              {getInitial(m.name)}
            </div>
            <span className={cn(
              'absolute -top-1 -left-1 text-[10px] font-bold leading-none',
              rank <= 3 ? 'text-base' : 'bg-gray-700 text-white rounded-full w-4 h-4 flex items-center justify-center'
            )}>
              {rankLabel}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
            <p className="text-xs text-gray-400">{isExpanded ? '▲ 접기' : '▼ 상세 보기'}</p>
          </div>
        </div>
        {/* 제출 */}
        <div className="text-center">
          <span className="text-sm text-gray-600">{m.submitted}<span className="text-gray-400">/{m.total}</span></span>
        </div>
        {/* 듀얼 진행률 바 */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 w-9 text-right flex-shrink-0">진행분</span>
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-500', getRateColor(m.active_percentage))} style={{ width: `${m.active_percentage}%` }} />
            </div>
            <span className={cn('text-[10px] font-semibold w-8 flex-shrink-0', getRateTextColor(m.active_percentage))}>{m.active_percentage}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 w-9 text-right flex-shrink-0">전체</span>
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-500 opacity-60', getRateColor(m.percentage))} style={{ width: `${m.percentage}%` }} />
            </div>
            <span className={cn('text-[10px] font-semibold w-8 flex-shrink-0', getRateTextColor(m.percentage))}>{m.percentage}%</span>
          </div>
        </div>
        {/* 달성률 */}
        <div className="text-right">
          <span className={cn('text-sm font-semibold', getRateTextColor(m.active_percentage))}>{m.active_percentage}%</span>
          <p className="text-[10px] text-gray-400">전체 {m.percentage}%</p>
        </div>
      </button>

      {/* 드릴다운 */}
      {isExpanded && (
        <div className="mx-3 mb-3 mt-0.5 bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-2">
          {/* 진행분/전체 요약 */}
          {m.total > 0 && (
            <div className="flex items-center gap-4 pb-2 border-b border-gray-200">
              <div className="text-center">
                <p className={cn('text-lg font-bold', getRateTextColor(m.active_percentage))}>{m.active_percentage}%</p>
                <p className="text-[10px] text-gray-400">진행분 달성률<br/><span className="text-gray-500">{m.active_completed}/{m.active_total}개</span></p>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div className="text-center">
                <p className={cn('text-lg font-bold', getRateTextColor(m.percentage))}>{m.percentage}%</p>
                <p className="text-[10px] text-gray-400">전체 달성률<br/><span className="text-gray-500">{m.submitted}/{m.total}개</span></p>
              </div>
            </div>
          )}
          {/* 과제/설문 */}
          <div className="space-y-1.5">
            {allAssignments.length === 0 && allSurveys.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-1">과제/설문 없음</p>
            )}
            {allAssignments.map((a) => {
              const done = m.submitted_assignment_ids.includes(a.id)
              return (
                <div key={a.id} className="flex items-center gap-2">
                  <span className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0', done ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400')}>
                    {done ? '✓' : '✗'}
                  </span>
                  <span className="text-xs text-gray-600 truncate flex-1">{a.title}</span>
                  <span className={cn('text-xs font-medium flex-shrink-0', done ? 'text-blue-600' : 'text-gray-400')}>{done ? '제출' : '미제출'}</span>
                </div>
              )
            })}
            {allSurveys.map((s) => {
              const done = m.responded_survey_ids.includes(s.id)
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <span className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0', done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400')}>
                    {done ? '✓' : '✗'}
                  </span>
                  <span className="text-xs text-gray-600 truncate flex-1">[설문] {s.title}</span>
                  <span className={cn('text-xs font-medium flex-shrink-0', done ? 'text-green-600' : 'text-gray-400')}>{done ? '응답' : '미응답'}</span>
                </div>
              )
            })}
          </div>

          {/* 출석 요약 */}
          {totalS > 0 && (
            <div className="border-t border-gray-200 pt-2 mt-1">
              <p className="text-xs font-semibold text-gray-500 mb-1.5">출석 현황</p>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className={cn('text-lg font-bold', getAttendTextColor(partRate))}>{partRate}%</p>
                  <p className="text-[10px] text-gray-400">참여율<br/><span className="text-gray-500">{attended}회 참여</span></p>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="text-center">
                  <p className={cn('text-lg font-bold', getAttendTextColor(overallRate))}>{overallRate}%</p>
                  <p className="text-[10px] text-gray-400">전체 출석률<br/><span className="text-gray-500">{attended}/{totalS}회</span></p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── 출석률 테이블 ───────────────────────────────────────── */
function AttendanceTable({
  memberStats,
  attendanceMode,
  search,
  page,
  pageSize,
  setPage,
  expandedMember,
  setExpandedMember,
  allAssignments,
  allSurveys,
}: {
  memberStats: MemberStatItem[]
  attendanceMode: 'all' | 'offline' | 'zoom'
  search: string
  page: number
  pageSize: number
  setPage: (p: number) => void
  expandedMember: string | null
  setExpandedMember: (id: string | null) => void
  allAssignments: { id: string; title: string }[]
  allSurveys: { id: string; title: string }[]
}) {
  const getRate = (m: MemberStatItem) =>
    attendanceMode === 'offline' ? m.offline_overall_rate
    : attendanceMode === 'zoom' ? m.zoom_overall_rate
    : m.overall_attendance_rate

  const getTotal = (m: MemberStatItem) =>
    attendanceMode === 'offline' ? m.total_offline_sessions
    : attendanceMode === 'zoom' ? m.total_zoom_sessions
    : m.total_sessions

  const getAttended = (m: MemberStatItem) =>
    attendanceMode === 'offline' ? m.offline_sessions_attended
    : attendanceMode === 'zoom' ? m.zoom_sessions_attended
    : m.sessions_attended

  const getPartRate = (m: MemberStatItem) =>
    attendanceMode === 'offline' ? m.offline_participation_rate
    : attendanceMode === 'zoom' ? m.zoom_participation_rate
    : m.participation_rate

  const filtered = memberStats.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => getRate(b) - getRate(a))

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  if (filtered.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">데이터가 없습니다.</p>
  }

  return (
    <>
      {/* 헤더 */}
      <div className="grid grid-cols-[2fr_1fr_3fr_1fr] gap-3 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
        <span>이름</span>
        <span className="text-center">참여</span>
        <span>참여율 / 전체 출석률</span>
        <span className="text-right">전체 출석률</span>
      </div>

      <div className="divide-y divide-gray-50">
        {paginated.map((m, idx) => {
          const rank = (page - 1) * pageSize + idx + 1
          const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
          const totalS = getTotal(m)
          const attended = getAttended(m)
          const partRate = getPartRate(m)
          const overall = getRate(m)

          return (
            <div key={m.user_id}>
              <button
                type="button"
                onClick={() => setExpandedMember(expandedMember === m.user_id ? null : m.user_id)}
                className="w-full grid grid-cols-[2fr_1fr_3fr_1fr] gap-3 items-center px-3 py-3 hover:bg-gray-50 transition-colors rounded-lg text-left"
              >
                {/* 이름 */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-semibold">
                      {getInitial(m.name)}
                    </div>
                    <span className={cn(
                      'absolute -top-1 -left-1 text-[10px] font-bold leading-none',
                      rank <= 3 ? 'text-base' : 'bg-gray-700 text-white rounded-full w-4 h-4 flex items-center justify-center'
                    )}>
                      {rankLabel}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                    <p className="text-xs text-gray-400">{expandedMember === m.user_id ? '▲ 접기' : '▼ 상세 보기'}</p>
                  </div>
                </div>

                {/* 참여 횟수 */}
                <div className="text-center">
                  <span className="text-sm text-gray-600">{attended}<span className="text-gray-400">/{totalS}</span></span>
                  <p className="text-[10px] text-gray-400">회 참여</p>
                </div>

                {/* 듀얼 진행바 */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 w-9 text-right flex-shrink-0">참여율</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all duration-500', getAttendColor(partRate))} style={{ width: `${partRate}%` }} />
                    </div>
                    <span className={cn('text-[10px] font-semibold w-8 flex-shrink-0', getAttendTextColor(partRate))}>{partRate}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 w-9 text-right flex-shrink-0">전체</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all duration-500 opacity-60', getAttendColor(overall))} style={{ width: `${overall}%` }} />
                    </div>
                    <span className={cn('text-[10px] font-semibold w-8 flex-shrink-0', getAttendTextColor(overall))}>{overall}%</span>
                  </div>
                </div>

                {/* 전체 출석률 */}
                <div className="text-right">
                  <span className={cn('text-sm font-semibold', getAttendTextColor(overall))}>{overall}%</span>
                </div>
              </button>

              {expandedMember === m.user_id && (
                <div className="mx-3 mb-3 mt-0.5 bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className={cn('text-2xl font-bold', getAttendTextColor(partRate))}>{partRate}%</p>
                      <p className="text-xs text-gray-500 mt-0.5">참여율</p>
                      <p className="text-[10px] text-gray-400">참여한 {attended}회 기준</p>
                    </div>
                    <div className="h-10 w-px bg-gray-200" />
                    <div className="text-center">
                      <p className={cn('text-2xl font-bold', getAttendTextColor(overall))}>{overall}%</p>
                      <p className="text-xs text-gray-500 mt-0.5">전체 출석률</p>
                      <p className="text-[10px] text-gray-400">전체 {totalS}회 기준</p>
                    </div>
                    <div className="h-10 w-px bg-gray-200" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-700">{attended}<span className="text-base text-gray-400">/{totalS}</span></p>
                      <p className="text-xs text-gray-500 mt-0.5">출석 세션 수</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">{filtered.length}명 중 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}명</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30">‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={cn('w-7 h-7 rounded-full text-xs font-medium transition-colors', p === page ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100')}>{p}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30">›</button>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── 메인 컴포넌트 ──────────────────────────────────────── */
export function StatsClientWrapper({
  assignmentStats, memberStats, surveyStats, totalMembers, isAdmin,
  allAssignments, allSurveys,
  totalSessions, totalOfflineSessions, totalZoomSessions,
}: Props) {
  const [tab, setTab] = useState<'member' | 'assignment'>('member')
  const [attendanceTab, setAttendanceTab] = useState<'all' | 'offline' | 'zoom'>('all')
  const [search, setSearch] = useState('')
  const [attSearch, setAttSearch] = useState('')
  const [pageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [attPage, setAttPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null)
  const [expandedAttMember, setExpandedAttMember] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const memberRows = memberStats.map((m) => ({
        '이름': m.name, '이메일': m.email,
        '완료 항목': m.submitted, '전체 항목': m.total, '달성률(%)': m.percentage,
        '참여 세션 수': m.sessions_attended, '전체 세션 수': m.total_sessions,
        '참여율(%)': m.participation_rate, '전체 출석률(%)': m.overall_attendance_rate,
      }))
      const ws1 = XLSX.utils.json_to_sheet(memberRows)
      ws1['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, ws1, '구성원 달성률')
      if (assignmentStats.length > 0) {
        const ws2 = XLSX.utils.json_to_sheet(assignmentStats.map((a) => ({ '과제명': a.title, '제출 수': a.submission_count, '전체 멤버': a.total_members, '제출률(%)': a.percentage })))
        XLSX.utils.book_append_sheet(wb, ws2, '과제별 현황')
      }
      if (surveyStats.length > 0) {
        const ws3 = XLSX.utils.json_to_sheet(surveyStats.map((s) => ({ '설문명': s.title, '응답 수': s.response_count, '전체 멤버': totalMembers, '응답률(%)': totalMembers > 0 ? Math.round((s.response_count / totalMembers) * 100) : 0 })))
        XLSX.utils.book_append_sheet(wb, ws3, '설문 응답 현황')
      }
      XLSX.writeFile(wb, `통계_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  const filtered = memberStats.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const hasAttendance = totalSessions > 0

  return (
    <div className="space-y-6">
      {/* ── 과제 제출률 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            과제 제출률
          </h2>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}
              className="ml-auto mr-2 h-7 gap-1.5 text-xs text-green-700 border-green-300 hover:bg-green-50">
              <Download className="w-3.5 h-3.5" />
              {exporting ? '내보내는 중...' : '엑셀 내보내기'}
            </Button>
          )}
          <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5">
            <button onClick={() => setTab('member')} className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors', tab === 'member' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700')}>구성원 통계</button>
            <button onClick={() => setTab('assignment')} className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors', tab === 'assignment' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700')}>과제별 현황</button>
          </div>
        </div>

        {tab === 'member' && (
          <>
            {memberStats.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">구성원 데이터가 없습니다.</p>
            ) : (
              <>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input placeholder="이름 검색..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9 text-sm" />
                </div>
                <div className="grid grid-cols-[2fr_1fr_3fr_1fr] gap-3 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <span>이름</span><span className="text-center">제출</span><span>진행분 / 전체</span><span className="text-right">달성률</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {paginated.map((m, idx) => (
                    <MemberRow key={m.user_id} m={m} rank={(page - 1) * pageSize + idx + 1}
                      page={page} pageSize={pageSize} idx={idx}
                      isExpanded={expandedMember === m.user_id}
                      onToggle={() => setExpandedMember(expandedMember === m.user_id ? null : m.user_id)}
                      allAssignments={allAssignments} allSurveys={allSurveys}
                      attendanceMode="all"
                    />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">{filtered.length}명 중 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}명</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30">‹</button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <button key={p} onClick={() => setPage(p)} className={cn('w-7 h-7 rounded-full text-xs font-medium transition-colors', p === page ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100')}>{p}</button>
                      ))}
                      <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30">›</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'assignment' && (
          <>
            {assignmentStats.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">과제 데이터가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {assignmentStats.map((stat) => (
                  <div key={stat.id} className="border border-gray-100 rounded-lg overflow-hidden">
                    <button type="button" onClick={() => setExpandedAssignment(expandedAssignment === stat.id ? null : stat.id)}
                      className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-gray-700 truncate">{stat.title}</span>
                          {!stat.is_active && (
                            <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full flex-shrink-0">미진행</span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500 ml-4 flex-shrink-0">
                          {stat.submission_count} / {stat.total_members}명
                          <span className={cn('ml-2 font-semibold', stat.is_active ? getRateTextColor(stat.percentage) : 'text-gray-400')}>{stat.percentage}%</span>
                          <span className="ml-2 text-xs text-gray-400">{expandedAssignment === stat.id ? '▲' : '▼'}</span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all duration-500', getRateColor(stat.percentage))} style={{ width: `${stat.percentage}%` }} />
                      </div>
                    </button>
                    {expandedAssignment === stat.id && (
                      <div className="px-4 pb-3 pt-1 border-t border-gray-100 bg-gray-50">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {memberStats.map((m) => {
                            const done = stat.submitted_user_ids.includes(m.user_id)
                            return (
                              <div key={m.user_id} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs', done ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-500 border border-gray-200')}>
                                <span className={cn('w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0', done ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-500')}>{done ? '✓' : '✗'}</span>
                                <span className="truncate">{m.name}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 출석률 ── */}
      {hasAttendance && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              출석률
            </h2>
            <div className="ml-auto flex gap-1 border border-gray-200 rounded-lg p-0.5">
              {([
                { key: 'all',     label: `전체 (${totalSessions}회)` },
                ...(totalOfflineSessions > 0 ? [{ key: 'offline', label: `오프라인 (${totalOfflineSessions}회)` }] : []),
                ...(totalZoomSessions > 0    ? [{ key: 'zoom',    label: `Zoom (${totalZoomSessions}회)` }]    : []),
              ] as { key: 'all' | 'offline' | 'zoom'; label: string }[]).map(({ key, label }) => (
                <button key={key} onClick={() => { setAttendanceTab(key); setAttPage(1) }}
                  className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors', attendanceTab === key ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-700')}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 참여율 vs 전체 출석률 설명 */}
          <div className="flex items-start gap-4 mb-4 bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded-full bg-emerald-500" />
              <span><strong className="text-gray-700">참여율</strong>: 참여한 회차 기준 — 얼마나 성실히 참여했는지</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded-full bg-emerald-300" />
              <span><strong className="text-gray-700">전체 출석률</strong>: 전체 회차 기준 — 불참 포함 종합 출석률</span>
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="이름 검색..." value={attSearch} onChange={(e) => { setAttSearch(e.target.value); setAttPage(1) }} className="pl-9 text-sm" />
          </div>

          <AttendanceTable
            memberStats={memberStats}
            attendanceMode={attendanceTab}
            search={attSearch}
            page={attPage}
            pageSize={pageSize}
            setPage={setAttPage}
            expandedMember={expandedAttMember}
            setExpandedMember={setExpandedAttMember}
            allAssignments={allAssignments}
            allSurveys={allSurveys}
          />
        </div>
      )}

      {/* ── 설문 응답 현황 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          설문 응답 현황
        </h2>
        {surveyStats.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">설문 데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={surveyStats} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="title" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }} formatter={(value) => [`${value}명`, '응답 수']} />
              <Bar dataKey="response_count" radius={[4, 4, 0, 0]}>
                {surveyStats.map((_, i) => <Cell key={i} fill={BLUE_SHADES[i % BLUE_SHADES.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
