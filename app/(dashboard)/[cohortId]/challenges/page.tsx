import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Challenge, Profile } from '@/types'
import { ChallengesClientWrapper } from '@/components/challenges/ChallengesClientWrapper'

export default async function ChallengesPage({
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

  const [{ data: profileData }, { data: challengesData }, { data: submissionsData }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('challenges')
        .select('*')
        .eq('cohort_id', cohortId)
        .order('created_at', { ascending: false }),
      supabase
        .from('challenge_submissions')
        .select('challenge_id')
        .eq('user_id', user.id),
    ])

  const profile = profileData as Profile | null
  const isAdmin = profile?.role === 'admin'

  const submittedChallengeIds = new Set(
    (submissionsData ?? []).map((s: { challenge_id: string }) => s.challenge_id)
  )

  // Attach submission count and user_submitted flag
  const challenges: Challenge[] = (challengesData ?? []).map((c) => ({
    ...c,
    user_submitted: submittedChallengeIds.has(c.id),
  }))

  // Fetch submission counts
  const challengeIds = challenges.map((c) => c.id)
  let submissionCounts: Record<string, number> = {}

  if (challengeIds.length > 0) {
    const { data: countData } = await supabase
      .from('challenge_submissions')
      .select('challenge_id')
      .in('challenge_id', challengeIds)

    if (countData) {
      for (const row of countData as { challenge_id: string }[]) {
        submissionCounts[row.challenge_id] = (submissionCounts[row.challenge_id] ?? 0) + 1
      }
    }
  }

  const challengesWithCounts: Challenge[] = challenges.map((c) => ({
    ...c,
    submission_count: submissionCounts[c.id] ?? 0,
  }))

  const totalParticipants = new Set(
    Object.values(submissionCounts).length > 0
      ? Object.keys(submissionCounts)
      : []
  ).size

  return (
    <ChallengesClientWrapper
      cohortId={cohortId}
      challenges={challengesWithCounts}
      isAdmin={isAdmin}
      totalParticipants={totalParticipants}
    />
  )
}
