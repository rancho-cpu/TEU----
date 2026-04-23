import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ScheduleSession } from '@/types'
import { HomeClientWrapper } from '@/components/home/HomeClientWrapper'

export default async function HomePage({
  params,
}: {
  params: Promise<{ cohortId: string }>
}) {
  const { cohortId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const [
    { data: profileData },
    { data: assignmentsData },
    { data: mySubmissionsData },
    { data: surveysData },
    { data: myResponsesData },
    { data: sessionsData },
  ] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('assignments')
      .select('id, title, deadline, is_published')
      .eq('cohort_id', cohortId)
      .eq('is_published', true)
      .gte('deadline', todayStart.toISOString())
      .lte('deadline', todayEnd.toISOString()),
    supabase
      .from('assignment_submissions')
      .select('assignment_id')
      .eq('user_id', user.id),
    supabase
      .from('surveys')
      .select('id, title, deadline, is_published')
      .eq('cohort_id', cohortId)
      .eq('is_published', true)
      .gte('deadline', todayStart.toISOString())
      .lte('deadline', todayEnd.toISOString()),
    supabase
      .from('survey_responses')
      .select('survey_id')
      .eq('user_id', user.id),
    supabase
      .from('schedule_sessions')
      .select('*')
      .eq('cohort_id', cohortId)
      .order('week_num', { ascending: true })
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true }),
  ])

  const isAdmin = profileData?.role === 'admin'
  const submittedIds = new Set((mySubmissionsData ?? []).map((s: { assignment_id: string }) => s.assignment_id))
  const respondedIds = new Set((myResponsesData ?? []).map((r: { survey_id: string }) => r.survey_id))

  const dueItems = [
    ...(assignmentsData ?? []).map((a: { id: string; title: string; deadline: string }) => ({
      id: a.id,
      kind: 'assignment' as const,
      title: a.title,
      deadline: a.deadline,
      submitted: submittedIds.has(a.id),
    })),
    ...(surveysData ?? []).map((s: { id: string; title: string; deadline: string }) => ({
      id: s.id,
      kind: 'survey' as const,
      title: s.title,
      deadline: s.deadline,
      submitted: respondedIds.has(s.id),
    })),
  ].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())

  return (
    <HomeClientWrapper
      cohortId={cohortId}
      isAdmin={isAdmin}
      dueItems={dueItems}
      sessions={(sessionsData ?? []) as ScheduleSession[]}
    />
  )
}
