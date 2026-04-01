import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Profile } from '@/types'
import { MembersClientWrapper } from '@/components/layout/MembersClientWrapper'

export default async function MembersPage({
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

  const [{ data: profileData }, { data: membersData }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('cohort_members')
      .select('*, profile:profiles(*)')
      .eq('cohort_id', cohortId)
      .order('joined_at', { ascending: true }),
  ])

  const currentProfile = profileData as Profile | null
  const isAdmin = currentProfile?.role === 'admin'

  const members = (membersData ?? []).map((m) => ({
    user_id: m.user_id as string,
    cohort_id: m.cohort_id as string,
    joined_at: m.joined_at as string,
    profile: m.profile as Profile | undefined,
  }))

  return (
    <MembersClientWrapper
      cohortId={cohortId}
      members={members}
      isAdmin={isAdmin}
      currentUserId={user.id}
    />
  )
}
