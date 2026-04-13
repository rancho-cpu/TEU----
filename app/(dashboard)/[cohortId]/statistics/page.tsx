import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsClientWrapper } from '@/components/community/StatsClientWrapper'
import { BarChart2 } from 'lucide-react'

export default async function StatisticsPage({
  params,
}: {
  params: Promise<{ cohortId: string }>
}) {
  const { cohortId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 설문 ID 먼저 조회 (survey_responses 필터링에 필요)
  const { data: surveysData } = await supabase
    .from('surveys')
    .select('id, title')
    .eq('cohort_id', cohortId)
    .order('created_at', { ascending: true })

  const surveyIds = (surveysData ?? []).map((s: { id: string }) => s.id)

  const [
    { data: assignmentsData },
    { data: allSubmissionsData },
    { data: surveyResponsesData },
    { data: membersData },
  ] = await Promise.all([
    supabase
      .from('assignments')
      .select('id, title, order_index')
      .eq('cohort_id', cohortId)
      .order('order_index', { ascending: true }),
    supabase
      .from('assignment_submissions')
      .select('assignment_id, user_id'),
    surveyIds.length > 0
      ? supabase
          .from('survey_responses')
          .select('survey_id, user_id')
          .in('survey_id', surveyIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('cohort_members')
      .select('user_id, joined_at, profile:profiles!user_id(id, name, avatar_url, email)')
      .eq('cohort_id', cohortId),
  ])

  const totalMembers = membersData?.length ?? 0
  const assignmentIds = (assignmentsData ?? []).map((a: { id: string }) => a.id)

  // 과제별 제출 수
  const subCountByAssignment: Record<string, number> = {}
  const subByUserAssignment: Record<string, Set<string>> = {} // userId -> Set<assignmentId>

  for (const row of (allSubmissionsData ?? []) as { assignment_id: string; user_id: string }[]) {
    if (!assignmentIds.includes(row.assignment_id)) continue
    subCountByAssignment[row.assignment_id] = (subCountByAssignment[row.assignment_id] ?? 0) + 1
    if (!subByUserAssignment[row.user_id]) subByUserAssignment[row.user_id] = new Set()
    subByUserAssignment[row.user_id].add(row.assignment_id)
  }

  // 설문 응답 per user
  const responsesByUser: Record<string, Set<string>> = {} // userId -> Set<surveyId>
  const responseCountBySurvey: Record<string, number> = {}
  for (const row of (surveyResponsesData ?? []) as { survey_id: string; user_id: string }[]) {
    responseCountBySurvey[row.survey_id] = (responseCountBySurvey[row.survey_id] ?? 0) + 1
    if (!responsesByUser[row.user_id]) responsesByUser[row.user_id] = new Set()
    responsesByUser[row.user_id].add(row.survey_id)
  }

  // 과제별 제출률
  const assignmentStats = (assignmentsData ?? []).map((a: { id: string; title: string }) => {
    const count = subCountByAssignment[a.id] ?? 0
    return {
      id: a.id,
      title: a.title,
      submission_count: count,
      total_members: totalMembers,
      percentage: totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0,
    }
  })

  // 멤버별 통합 제출률 (글쓰기 + 설문)
  const totalItems = assignmentIds.length + surveyIds.length
  const memberStats = (membersData ?? []).map((m) => {
    const profile = (m.profile as unknown) as { id: string; name: string | null; avatar_url: string | null; email: string } | null
    const userId = profile?.id ?? (m as { user_id: string }).user_id
    const assignmentsSubmitted = subByUserAssignment[userId]?.size ?? 0
    const surveysResponded = responsesByUser[userId]?.size ?? 0
    const completed = assignmentsSubmitted + surveysResponded
    return {
      user_id: userId,
      name: profile?.name ?? profile?.email ?? '알 수 없음',
      avatar_url: profile?.avatar_url ?? null,
      submitted: completed,
      total: totalItems,
      percentage: totalItems > 0 ? Math.round((completed / totalItems) * 100) : 0,
    }
  }).sort((a, b) => b.percentage - a.percentage)

  // 설문 응답 현황
  const surveyStats = (surveysData ?? []).map((s: { id: string; title: string }) => ({
    title: s.title.length > 14 ? s.title.slice(0, 14) + '…' : s.title,
    response_count: responseCountBySurvey[s.id] ?? 0,
  }))

  // 멤버 가입 추이
  const joinCountByMonth: Record<string, number> = {}
  for (const row of (membersData ?? []) as { joined_at: string }[]) {
    const month = row.joined_at.slice(0, 7)
    joinCountByMonth[month] = (joinCountByMonth[month] ?? 0) + 1
  }
  const joinTrend = Object.entries(joinCountByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month: month.replace('-', '.'), count }))

  // 평균 제출률
  const avgRate = memberStats.length > 0
    ? Math.round(memberStats.reduce((s, m) => s + m.percentage, 0) / memberStats.length)
    : 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900">통계</h1>
        </div>
        <p className="text-sm text-gray-500">기수 활동 현황을 한눈에 확인하세요.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{totalMembers}</p>
          <p className="text-xs text-gray-500 mt-1">전체 멤버</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{assignmentStats.length}</p>
          <p className="text-xs text-gray-500 mt-1">글쓰기 과제</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{avgRate}%</p>
          <p className="text-xs text-gray-500 mt-1">평균 달성률</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{surveyStats.length}</p>
          <p className="text-xs text-gray-500 mt-1">설문</p>
        </div>
      </div>

      <StatsClientWrapper
        assignmentStats={assignmentStats}
        memberStats={memberStats}
        surveyStats={surveyStats}
        joinTrend={joinTrend}
        totalMembers={totalMembers}
      />
    </div>
  )
}
