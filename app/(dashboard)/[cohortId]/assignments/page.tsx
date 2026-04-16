import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Assignment, AssignmentSubmission, Profile, Survey } from '@/types'
import { AssignmentsClientWrapper } from '@/components/assignments/AssignmentsClientWrapper'

export default async function AssignmentsPage({
  params,
}: {
  params: Promise<{ cohortId: string }>
}) {
  const { cohortId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profileData },
    { data: assignmentsData },
    { data: mySubmissionsData },
    { data: surveysData },
    { data: myResponsesData },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('assignments')
      .select('*')
      .eq('cohort_id', cohortId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('assignment_submissions')
      .select('*, attachments:assignment_attachments(*)')
      .eq('user_id', user.id),
    supabase
      .from('surveys')
      .select('*')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: true }),
    supabase
      .from('survey_responses')
      .select('survey_id')
      .eq('user_id', user.id),
  ])

  const profile = profileData as Profile | null
  const isAdmin = profile?.role === 'admin'

  const assignmentIds = (assignmentsData ?? []).map((a: { id: string }) => a.id)
  let submissionCountMap: Record<string, number> = {}
  let surveyResponseCountMap: Record<string, number> = {}

  if (isAdmin && assignmentIds.length > 0) {
    const { data: allSubs } = await supabase
      .from('assignment_submissions')
      .select('assignment_id')
      .in('assignment_id', assignmentIds)
    for (const s of (allSubs ?? []) as { assignment_id: string }[]) {
      submissionCountMap[s.assignment_id] = (submissionCountMap[s.assignment_id] ?? 0) + 1
    }
  }

  const surveyIds = (surveysData ?? []).map((s: { id: string }) => s.id)
  if (isAdmin && surveyIds.length > 0) {
    const { data: allResponses } = await supabase
      .from('survey_responses')
      .select('survey_id')
      .in('survey_id', surveyIds)
    for (const r of (allResponses ?? []) as { survey_id: string }[]) {
      surveyResponseCountMap[r.survey_id] = (surveyResponseCountMap[r.survey_id] ?? 0) + 1
    }
  }

  const mySubMap: Record<string, AssignmentSubmission> = {}
  for (const s of (mySubmissionsData ?? []) as AssignmentSubmission[]) {
    mySubMap[s.assignment_id] = s
  }

  const myRespondedSurveyIds = (myResponsesData ?? []).map((r: { survey_id: string }) => r.survey_id)

  const { data: { publicUrl: attBaseUrl } } = supabase.storage
    .from('assignment-attachments').getPublicUrl('')

  const assignments: Assignment[] = (assignmentsData ?? [])
    .filter((a) => isAdmin || a.is_published)
    .map((a) => ({
      ...a,
      submission_count: submissionCountMap[a.id] ?? 0,
      user_submitted: !!mySubMap[a.id],
      my_submission: mySubMap[a.id]
        ? {
            ...mySubMap[a.id],
            attachments: (mySubMap[a.id].attachments ?? []).map((att) => ({
              ...att,
              public_url: `${attBaseUrl}${att.storage_path}`,
            })),
          }
        : null,
    }))

  const surveys: Survey[] = (surveysData ?? [])
    .filter((s) => isAdmin || s.is_published)
    .map((s) => ({
      ...s,
      response_count: surveyResponseCountMap[s.id] ?? 0,
    }))

  return (
    <AssignmentsClientWrapper
      cohortId={cohortId}
      initialAssignments={assignments}
      initialSurveys={surveys}
      surveyResponseCountMap={surveyResponseCountMap}
      myRespondedSurveyIds={myRespondedSurveyIds}
      isAdmin={isAdmin}
      currentUserId={user.id}
      attBaseUrl={attBaseUrl}
    />
  )
}
