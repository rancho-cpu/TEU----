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
}

interface MemberStatItem {
  user_id: string
  name: string
  email: string
  avatar_url: string | null
  submitted: number
  total: number
  percentage: number
}

interface SurveyStatItem {
  title: string
  response_count: number
}

interface JoinTrendItem {
  month: string
  count: number
}

interface Props {
  assignmentStats: AssignmentStatItem[]
  memberStats: MemberStatItem[]
  surveyStats: SurveyStatItem[]
  joinTrend: JoinTrendItem[]
  totalMembers: number
}

const BLUE_SHADES = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']

function getInitial(name: string) {
  return name.charAt(0).toUpperCase()
}

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

export function StatsClientWrapper({
  assignmentStats, memberStats, surveyStats, joinTrend, totalMembers,
}: Props) {
  const [tab, setTab] = useState<'member' | 'assignment'>('member')
  const [search, setSearch] = useState('')
  const [pageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // 시트 1: 구성원 달성률
      const memberRows = memberStats.map((m) => ({
        '이름': m.name,
        '이메일': m.email,
        '완료 항목': m.submitted,
        '전체 항목': m.total,
        '달성률(%)': m.percentage,
      }))
      const ws1 = XLSX.utils.json_to_sheet(memberRows)
      ws1['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, ws1, '구성원 달성률')

      // 시트 2: 글쓰기 과제별 현황
      if (assignmentStats.length > 0) {
        const assignRows = assignmentStats.map((a) => ({
          '과제명': a.title,
          '제출 수': a.submission_count,
          '전체 멤버': a.total_members,
          '제출률(%)': a.percentage,
        }))
        const ws2 = XLSX.utils.json_to_sheet(assignRows)
        ws2['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]
        XLSX.utils.book_append_sheet(wb, ws2, '과제별 현황')
      }

      // 시트 3: 설문 응답 현황
      if (surveyStats.length > 0) {
        const surveyRows = surveyStats.map((s) => ({
          '설문명': s.title,
          '응답 수': s.response_count,
          '전체 멤버': totalMembers,
          '응답률(%)': totalMembers > 0 ? Math.round((s.response_count / totalMembers) * 100) : 0,
        }))
        const ws3 = XLSX.utils.json_to_sheet(surveyRows)
        ws3['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]
        XLSX.utils.book_append_sheet(wb, ws3, '설문 응답 현황')
      }

      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `통계_${date}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  const filtered = memberStats.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-6">
      {/* ── 과제 제출률 (메인) ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            과제 제출률
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
            className="ml-auto mr-2 h-7 gap-1.5 text-xs text-green-700 border-green-300 hover:bg-green-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? '내보내는 중...' : '엑셀 내보내기'}
          </Button>
          <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5">
            <button
              onClick={() => setTab('member')}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                tab === 'member' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              구성원 통계
            </button>
            <button
              onClick={() => setTab('assignment')}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                tab === 'assignment' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              과제별 현황
            </button>
          </div>
        </div>

        {/* 구성원 통계 탭 */}
        {tab === 'member' && (
          <>
            {memberStats.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">구성원 데이터가 없습니다.</p>
            ) : (
              <>
                {/* 검색 */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="이름 검색..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    className="pl-9 text-sm"
                  />
                </div>

                {/* 테이블 헤더 */}
                <div className="grid grid-cols-[2fr_1fr_3fr_1fr] gap-3 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <span>이름</span>
                  <span className="text-center">제출</span>
                  <span>진행률</span>
                  <span className="text-right">달성률</span>
                </div>

                {/* 행 */}
                <div className="divide-y divide-gray-50">
                  {paginated.map((m) => (
                    <div
                      key={m.user_id}
                      className="grid grid-cols-[2fr_1fr_3fr_1fr] gap-3 items-center px-3 py-3 hover:bg-gray-50 transition-colors rounded-lg"
                    >
                      {/* 이름 */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                          {getInitial(m.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                          <p className="text-xs text-gray-400">참여자</p>
                        </div>
                      </div>

                      {/* 제출 수 */}
                      <div className="text-center">
                        <span className="text-sm text-gray-600">
                          {m.submitted}<span className="text-gray-400">/{m.total}</span>
                        </span>
                      </div>

                      {/* 프로그레스 바 */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', getRateColor(m.percentage))}
                            style={{ width: `${m.percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* 퍼센트 */}
                      <div className="text-right">
                        <span className={cn('text-sm font-semibold', getRateTextColor(m.percentage))}>
                          {m.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">{filtered.length}명 중 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}명</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30">‹</button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <button key={p} onClick={() => setPage(p)}
                          className={cn('w-7 h-7 rounded-full text-xs font-medium transition-colors',
                            p === page ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100')}>
                          {p}
                        </button>
                      ))}
                      <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30">›</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 과제별 현황 탭 */}
        {tab === 'assignment' && (
          <>
            {assignmentStats.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">과제 데이터가 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {assignmentStats.map((stat, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700 truncate max-w-xs">{stat.title}</span>
                      <span className="text-sm text-gray-500 ml-4 flex-shrink-0">
                        {stat.submission_count} / {stat.total_members}명
                        <span className={cn('ml-2 font-semibold', getRateTextColor(stat.percentage))}>
                          {stat.percentage}%
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', getRateColor(stat.percentage))}
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

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
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                formatter={(value) => [`${value}명`, '응답 수']}
              />
              <Bar dataKey="response_count" radius={[4, 4, 0, 0]}>
                {surveyStats.map((_, i) => <Cell key={i} fill={BLUE_SHADES[i % BLUE_SHADES.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 멤버 가입 추이 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
            멤버 가입 추이
          </h2>
          <span className="text-sm text-gray-500">총 <span className="font-semibold text-gray-900">{totalMembers}</span>명</span>
        </div>
        {joinTrend.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">가입 데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={joinTrend} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                formatter={(value) => [`${value}명`, '신규 가입']}
              />
              <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
