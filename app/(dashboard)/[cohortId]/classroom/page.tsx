import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClassroomHubClientWrapper } from '@/components/classroom/ClassroomHubClientWrapper'

export default async function ClassroomHubPage({
  params,
}: {
  params: Promise<{ cohortId: string }>
}) {
  const { cohortId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <ClassroomHubClientWrapper cohortId={cohortId} />
}
