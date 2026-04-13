import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ZoomLecture, Profile } from '@/types'
import { ContentsClientWrapper } from '@/components/contents/ContentsClientWrapper'

export default async function ContentsPage({
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

  const [{ data: profileData }, { data: lecturesData }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('zoom_lectures')
        .select('*')
        .eq('cohort_id', cohortId)
        .order('start_time', { ascending: false }),
    ])

  const profile = profileData as Profile | null
  const lectures = (lecturesData ?? []) as ZoomLecture[]
  const isAdmin = profile?.role === 'admin'

  return (
    <ContentsClientWrapper
      cohortId={cohortId}
      lectures={lectures}
      isAdmin={isAdmin}
    />
  )
}
