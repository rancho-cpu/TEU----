import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Assignment, AssignmentSubmission, Profile } from '@/types'
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

  const [{ data: profileData }, { data: assignmentsData }, { data: mySubmissionsData }] =
    await Promise.all([
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
    ])

  const profile = profileData as Profile | null
  const isAdmin = profile?.role === 'admin'

  const assignmentIds = (assignmentsData ?? []).map((a: { id: string }) => a.id)
  let submissionCountMap: Record<string, number> = {}

  // 관리자는 전체 제출 수 조회
  if (isAdmin && assignmentIds.length > 0) {
    const { data: allSubs } = await supabase
      .from('assignment_submissions')
      .select('assignment_id')
      .in('assignment_id', assignmentIds)
    for (const s of (allSubs ?? []) as { assignment_id: string }[]) {
      submissionCountMap[s.assignment_id] = (submissionCountMap[s.assignment_id] ?? 0) + 1
    }
  }

  const mySubMap: Record<string, AssignmentSubmission> = {}
  for (const s of (mySubmissionsData ?? []) as AssignmentSubmission[]) {
    mySubMap[s.assignment_id] = s
  }

  const { data: { publicUrl: attBaseUrl } } = supabase.storage
    .from('assignment-attachments').getPublicUrl('')

  const assignments: Assignment[] = (assignmentsData ?? []).map((a) => ({
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

  return (
    <AssignmentsClientWrapper
      cohortId={cohortId}
      initialAssignments={assignments}
      isAdmin={isAdmin}
      currentUserId={user.id}
      attBaseUrl={attBaseUrl}
    />
  )
}
