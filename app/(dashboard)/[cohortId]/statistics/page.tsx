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

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all data in parallel
  const [
    { data: challengesData },
    { data: submissionsData },
    { data: surveysData },
    { data: surveyResponsesData },
    { data: membersData },
  ] = await Promise.all([
    supabase
      .from('challenges')
      .select('id, title')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: true }),
    supabase
      .from('challenge_submissions')
      .select('challenge_id')
      .in(
        'challenge_id',
        (await supabase.from('challenges').select('id').eq('cohort_id', cohortId)).data?.map(
          (c: { id: string }) => c.id
        ) ?? []
      ),
    supabase
      .from('surveys')
      .select('id, title')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: true }),
    supabase
      .from('survey_responses')
      .select('survey_id, submitted_at')
      .in(
        'survey_id',
        (await supabase.from('surveys').select('id').eq('cohort_id', cohortId)).data?.map(
          (s: { id: string }) => s.id
        ) ?? []
      ),
    supabase
      .from('cohort_members')
      .select('joined_at')
      .eq('cohort_id', cohortId),
  ])

  const totalMembers = membersData?.length ?? 0

  // Challenge stats
  const submissionCountByChallenge: Record<string, number> = {}
  for (const row of submissionsData ?? []) {
    const r = row as { challenge_id: string }
    submissionCountByChallenge[r.challenge_id] =
      (submissionCountByChallenge[r.challenge_id] ?? 0) + 1
  }

  const challengeStats = (challengesData ?? []).map((c: { id: string; title: string }) => {
    const count = submissionCountByChallenge[c.id] ?? 0
    return {
      title: c.title,
      submission_count: count,
      total_members: totalMembers,
      percentage: totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0,
    }
  })

  // Survey stats
  const responseCountBySurvey: Record<string, number> = {}
  for (const row of surveyResponsesData ?? []) {
    const r = row as { survey_id: string }
    responseCountBySurvey[r.survey_id] = (responseCountBySurvey[r.survey_id] ?? 0) + 1
  }

  const surveyStats = (surveysData ?? []).map((s: { id: string; title: string }) => ({
    title: s.title.length > 12 ? s.title.slice(0, 12) + '…' : s.title,
    response_count: responseCountBySurvey[s.id] ?? 0,
  }))

  // Member join trend (by month)
  const joinCountByMonth: Record<string, number> = {}
  for (const row of membersData ?? []) {
    const r = row as { joined_at: string }
    const month = r.joined_at.slice(0, 7) // YYYY-MM
    joinCountByMonth[month] = (joinCountByMonth[month] ?? 0) + 1
  }

  const joinTrend = Object.entries(joinCountByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month: month.replace('-', '.'),
      count,
    }))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900">통계</h1>
        </div>
        <p className="text-sm text-gray-500">기수 활동 현황을 한눈에 확인하세요.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{totalMembers}</p>
          <p className="text-xs text-gray-500 mt-1">전체 멤버</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{challengeStats.length}</p>
          <p className="text-xs text-gray-500 mt-1">챌린지</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{surveyStats.length}</p>
          <p className="text-xs text-gray-500 mt-1">설문</p>
        </div>
      </div>

      <StatsClientWrapper
        challengeStats={challengeStats}
        surveyStats={surveyStats}
        joinTrend={joinTrend}
        totalMembers={totalMembers}
      />
    </div>
  )
}
