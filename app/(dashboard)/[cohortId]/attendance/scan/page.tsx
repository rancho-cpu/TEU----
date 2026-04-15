import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Profile, AttendanceSession } from '@/types'
import { ScannerClient } from '@/components/attendance/ScannerClient'

export default async function AttendanceScanPage({
  params,
}: {
  params: Promise<{ cohortId: string }>
}) {
  const { cohortId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileData as Pick<Profile, 'role'> | null
  if (profile?.role !== 'admin') redirect(`/${cohortId}/attendance`)

  const service = createServiceClient()
  const { data: sessionsData } = await service
    .from('attendance_sessions')
    .select('*')
    .eq('cohort_id', cohortId)
    .order('session_date', { ascending: false })

  const sessions = (sessionsData ?? []) as AttendanceSession[]

  return <ScannerClient cohortId={cohortId} sessions={sessions} />
}
