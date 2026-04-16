import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsClientWrapper } from '@/components/community/StatsClientWrapper'
import type { Profile, AttendanceSession, OfflineAttendance } from '@/types'
import { BarChart2 } from 'lucide-react'

/** 출석 % 계산 (AttendanceClientWrapper와 동일 로직) */
function calcAttendancePct(
  record: OfflineAttendance | undefined,
  session: AttendanceSession
): number {
  if (!record?.check_in && !record?.check_out) return 0
  const sessionStart = new Date(session.start_time).getTime()
  const sessionEnd   = new Date(session.end_time).getTime()
  const duration     = sessionEnd - sessionStart
  if (duration <= 0) return 100
  const from = record.check_in
    ? Math.max(new Date(record.check_in).getTime(), sessionStart)
    : sessionStart
  const to = record.check_out
    ? Math.min(new Date(record.check_out).getTime(), sessionEnd)
    : sessionEnd
  return Math.min(100, Math.max(0, Math.round(((to - from) / duration) * 100)))
}

export default async function StatisticsPage({
  params,
}: {
  params: Promise<{ cohortId: string }>
}) {
  const { cohortId } = await params
  const supabase = await createClient()
  const service = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = (profileData as Pick<Profile, 'role'> | null)?.role === 'admin'

  const { data: surveysData } = await supabase
    .from('surveys').select('id, title, deadline, is_published').eq('cohort_id', cohortId).order('created_at', { ascending: true })
  const surveyIds = (surveysData ?? []).map((s: { id: string }) => s.id)

  const [
    { data: assignmentsData },
    { data: allSubmissionsData },
    { data: surveyResponsesData },
    { data: membersData },
    { data: sessionsData },
  ] = await Promise.all([
    supabase.from('assignments').select('id, title, order_index, deadline, is_published').eq('cohort_id', cohortId)
      .order('order_index', { ascending: true }),
    service.from('assignment_submissions').select('assignment_id, user_id'),
    surveyIds.length > 0
      ? service.from('survey_responses').select('survey_id, user_id').in('survey_id', surveyIds)
      : Promise.resolve({ data: [] }),
    supabase.from('cohort_members')
      .select('user_id, joined_at, profile:profiles!user_id(id, name, avatar_url, email, role)')
      .eq('cohort_id', cohortId),
    service.from('attendance_sessions').select('*').eq('cohort_id', cohortId)
      .order('session_date', { ascending: true }),
  ])

  type MemberRow = { user_id: string; joined_at: string; profile: unknown }
  type ProfileRow = { id: string; name: string | null; avatar_url: string | null; email: string; role: string }

  const studentMembers = ((membersData ?? []) as MemberRow[]).filter((m) => {
    const p = (m.profile as unknown) as ProfileRow | null
    return p?.role !== 'admin'
  })

  const totalMembers = studentMembers.length

  // 공개된(is_published=true) 과제/설문 = 진행분
  type AssignmentRow = { id: string; title: string; order_index: number; deadline: string | null; is_published: boolean }
  type SurveyRow = { id: string; title: string; deadline: string | null; is_published: boolean }

  const allAssignmentRows = (assignmentsData ?? []) as AssignmentRow[]
  const allSurveyRows = (surveysData ?? []) as SurveyRow[]

  const activeAssignmentIds = new Set(
    allAssignmentRows
      .filter((a) => a.is_published)
      .map((a) => a.id)
  )
  const activeSurveyIds = new Set(
    allSurveyRows
      .filter((s) => s.is_published)
      .map((s) => s.id)
  )

  const assignmentIds = allAssignmentRows.map((a) => a.id)
  const activeItemsCount = activeAssignmentIds.size + activeSurveyIds.size

  // ── 과제/설문 집계 ────────────────────────────────────────────
  const subCountByAssignment: Record<string, number> = {}
  const subByUserAssignment: Record<string, Set<string>> = {}
  for (const row of (allSubmissionsData ?? []) as { assignment_id: string; user_id: string }[]) {
    if (!assignmentIds.includes(row.assignment_id)) continue
    subCountByAssignment[row.assignment_id] = (subCountByAssignment[row.assignment_id] ?? 0) + 1
    if (!subByUserAssignment[row.user_id]) subByUserAssignment[row.user_id] = new Set()
    subByUserAssignment[row.user_id].add(row.assignment_id)
  }
  const responsesByUser: Record<string, Set<string>> = {}
  const responseCountBySurvey: Record<string, number> = {}
  for (const row of (surveyResponsesData ?? []) as { survey_id: string; user_id: string }[]) {
    responseCountBySurvey[row.survey_id] = (responseCountBySurvey[row.survey_id] ?? 0) + 1
    if (!responsesByUser[row.user_id]) responsesByUser[row.user_id] = new Set()
    responsesByUser[row.user_id].add(row.survey_id)
  }

  // ── 출석 집계 ─────────────────────────────────────────────────
  const sessions = (sessionsData ?? []) as AttendanceSession[]
  const sessionIds = sessions.map((s) => s.id)

  let attendanceRecords: OfflineAttendance[] = []
  if (sessionIds.length > 0) {
    const { data } = await service
      .from('offline_attendance').select('*').in('session_id', sessionIds)
    attendanceRecords = (data ?? []) as OfflineAttendance[]
  }

  // 오프라인/혼합 세션만 따로
  const offlineSessions = sessions.filter((s) => s.type === 'offline' || s.type === 'hybrid')
  // Zoom/혼합 세션만
  const zoomSessions = sessions.filter((s) => s.type === 'zoom' || s.type === 'hybrid')

  // ── 과제별 통계 ───────────────────────────────────────────────
  const assignmentStats = allAssignmentRows.map((a) => {
    const submittedUserIds = studentMembers
      .map((m) => (m.profile as unknown as ProfileRow | null)?.id ?? m.user_id)
      .filter((uid) => subByUserAssignment[uid]?.has(a.id))
    return {
      id: a.id, title: a.title,
      submission_count: submittedUserIds.length,
      total_members: totalMembers,
      percentage: totalMembers > 0 ? Math.round((submittedUserIds.length / totalMembers) * 100) : 0,
      submitted_user_ids: submittedUserIds,
      is_active: activeAssignmentIds.has(a.id),
    }
  })

  const totalItems = assignmentIds.length + surveyIds.length

  // ── 멤버별 통합 통계 ──────────────────────────────────────────
  const memberStats = studentMembers.map((m) => {
    const profile = (m.profile as unknown) as ProfileRow | null
    const userId = profile?.id ?? m.user_id

    // 과제/설문 (전체 기준)
    const assignmentsSubmitted = subByUserAssignment[userId]?.size ?? 0
    const surveysResponded = responsesByUser[userId]?.size ?? 0
    const completed = assignmentsSubmitted + surveysResponded

    // 진행된 항목 기준 완수율
    const activeAssignmentsSubmitted = [...(subByUserAssignment[userId] ?? [])].filter((id) => activeAssignmentIds.has(id)).length
    const activeSurveysResponded     = [...(responsesByUser[userId]     ?? [])].filter((id) => activeSurveyIds.has(id)).length
    const activeCompleted = activeAssignmentsSubmitted + activeSurveysResponded
    const activePercentage = activeItemsCount > 0 ? Math.round((activeCompleted / activeItemsCount) * 100) : 0

    // 출석 (전체 세션)
    const attendedSessions = sessions.filter((s) => {
      const rec = attendanceRecords.find((r) => r.session_id === s.id && r.user_id === userId)
      return !!(rec?.check_in || rec?.check_out)
    })
    const sessionsAttended = attendedSessions.length

    // 참여율: 참여한 세션들 중 평균 출석%
    const participationRate = sessionsAttended === 0 ? 0 : Math.round(
      attendedSessions.reduce((sum, s) => {
        const rec = attendanceRecords.find((r) => r.session_id === s.id && r.user_id === userId)
        return sum + calcAttendancePct(rec, s)
      }, 0) / sessionsAttended
    )

    // 전체 출석률: 전체 세션 대비 총 참여%
    const overallAttendanceRate = sessions.length === 0 ? 0 : Math.round(
      sessions.reduce((sum, s) => {
        const rec = attendanceRecords.find((r) => r.session_id === s.id && r.user_id === userId)
        return sum + calcAttendancePct(rec, s)
      }, 0) / sessions.length
    )

    // 오프라인 출석
    const offlineAttendedSessions = offlineSessions.filter((s) => {
      const rec = attendanceRecords.find((r) => r.session_id === s.id && r.user_id === userId)
      return !!(rec?.check_in || rec?.check_out)
    })
    const offlineParticipationRate = offlineAttendedSessions.length === 0 ? 0 : Math.round(
      offlineAttendedSessions.reduce((sum, s) => {
        const rec = attendanceRecords.find((r) => r.session_id === s.id && r.user_id === userId)
        return sum + calcAttendancePct(rec, s)
      }, 0) / offlineAttendedSessions.length
    )
    const offlineOverallRate = offlineSessions.length === 0 ? 0 : Math.round(
      offlineSessions.reduce((sum, s) => {
        const rec = attendanceRecords.find((r) => r.session_id === s.id && r.user_id === userId)
        return sum + calcAttendancePct(rec, s)
      }, 0) / offlineSessions.length
    )

    // Zoom 출석
    const zoomAttendedSessions = zoomSessions.filter((s) => {
      const rec = attendanceRecords.find((r) => r.session_id === s.id && r.user_id === userId)
      return !!(rec?.check_in || rec?.check_out)
    })
    const zoomParticipationRate = zoomAttendedSessions.length === 0 ? 0 : Math.round(
      zoomAttendedSessions.reduce((sum, s) => {
        const rec = attendanceRecords.find((r) => r.session_id === s.id && r.user_id === userId)
        return sum + calcAttendancePct(rec, s)
      }, 0) / zoomAttendedSessions.length
    )
    const zoomOverallRate = zoomSessions.length === 0 ? 0 : Math.round(
      zoomSessions.reduce((sum, s) => {
        const rec = attendanceRecords.find((r) => r.session_id === s.id && r.user_id === userId)
        return sum + calcAttendancePct(rec, s)
      }, 0) / zoomSessions.length
    )

    return {
      user_id: userId,
      name: profile?.name ?? profile?.email ?? '알 수 없음',
      email: profile?.email ?? '',
      avatar_url: profile?.avatar_url ?? null,
      submitted: completed,
      total: totalItems,
      percentage: totalItems > 0 ? Math.round((completed / totalItems) * 100) : 0,
      submitted_assignment_ids: [...(subByUserAssignment[userId] ?? [])],
      responded_survey_ids: [...(responsesByUser[userId] ?? [])],
      // 출석
      sessions_attended: sessionsAttended,
      total_sessions: sessions.length,
      participation_rate: participationRate,
      overall_attendance_rate: overallAttendanceRate,
      // 오프라인
      offline_sessions_attended: offlineAttendedSessions.length,
      total_offline_sessions: offlineSessions.length,
      offline_participation_rate: offlineParticipationRate,
      offline_overall_rate: offlineOverallRate,
      // zoom
      zoom_sessions_attended: zoomAttendedSessions.length,
      total_zoom_sessions: zoomSessions.length,
      zoom_participation_rate: zoomParticipationRate,
      zoom_overall_rate: zoomOverallRate,
      // 과제 진행률
      active_completed: activeCompleted,
      active_total: activeItemsCount,
      active_percentage: activePercentage,
    }
  }).sort((a, b) => b.percentage - a.percentage)

  const surveyStats = allSurveyRows.map((s) => {
    const respondedUserIds = studentMembers
      .map((m) => (m.profile as unknown as ProfileRow | null)?.id ?? m.user_id)
      .filter((uid) => responsesByUser[uid]?.has(s.id))
    return {
      id: s.id,
      title: s.title,
      chartTitle: s.title.length > 14 ? s.title.slice(0, 14) + '…' : s.title,
      response_count: respondedUserIds.length,
      total_members: totalMembers,
      percentage: totalMembers > 0 ? Math.round((respondedUserIds.length / totalMembers) * 100) : 0,
      responded_user_ids: respondedUserIds,
      is_active: s.is_published,
    }
  })

  const avgRate = memberStats.length > 0
    ? Math.round(memberStats.reduce((s, m) => s + m.percentage, 0) / memberStats.length)
    : 0

  const avgAttendance = memberStats.length > 0 && sessions.length > 0
    ? Math.round(memberStats.reduce((s, m) => s + m.overall_attendance_rate, 0) / memberStats.length)
    : null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900">통계</h1>
        </div>
        <p className="text-sm text-gray-500">기수 활동 현황을 한눈에 확인하세요.</p>
      </div>

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
          <p className="text-2xl font-bold text-orange-500">
            {avgAttendance !== null ? `${avgAttendance}%` : '-'}
          </p>
          <p className="text-xs text-gray-500 mt-1">평균 출석률</p>
        </div>
      </div>

      <StatsClientWrapper
        assignmentStats={assignmentStats}
        memberStats={memberStats}
        surveyStats={surveyStats}
        totalMembers={totalMembers}
        isAdmin={isAdmin}
        allAssignments={(assignmentsData ?? []).map((a: { id: string; title: string }) => ({ id: a.id, title: a.title }))}
        allSurveys={(surveysData ?? []).map((s: { id: string; title: string }) => ({ id: s.id, title: s.title }))}
        totalSessions={sessions.length}
        totalOfflineSessions={offlineSessions.length}
        totalZoomSessions={zoomSessions.length}
      />
    </div>
  )
}
