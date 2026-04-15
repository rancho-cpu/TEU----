import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Profile, AttendanceSession, OfflineAttendance } from '@/types'
import { AttendanceClientWrapper } from '@/components/attendance/AttendanceClientWrapper'

export default async function AttendancePage({
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
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null
  const isAdmin = profile?.role === 'admin'

  const service = createServiceClient()

  const [{ data: sessionsData }, { data: membersData }] = await Promise.all([
    service
      .from('attendance_sessions')
      .select('*')
      .eq('cohort_id', cohortId)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false }),
    service
      .from('cohort_members')
      .select('profile:profiles!user_id(id, name, email, avatar_url)')
      .eq('cohort_id', cohortId),
  ])

  const sessions = (sessionsData ?? []) as AttendanceSession[]
  const members = (membersData ?? [])
    .map((m) => (m.profile as unknown) as Profile | null)
    .filter((p): p is Profile => !!p)

  const sessionIds = sessions.map((s) => s.id)
  let attendanceRecords: OfflineAttendance[] = []

  if (sessionIds.length > 0) {
    const { data: recordsData } = await service
      .from('offline_attendance')
      .select('*, profile:profiles!user_id(id, name, email, avatar_url)')
      .in('session_id', sessionIds)
    attendanceRecords = (recordsData ?? []) as OfflineAttendance[]
  }

  return (
    <AttendanceClientWrapper
      cohortId={cohortId}
      currentUserId={user.id}
      isAdmin={isAdmin}
      sessions={sessions}
      members={members}
      attendanceRecords={attendanceRecords}
    />
  )
}
