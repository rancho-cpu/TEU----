import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendPushToUsers } from '@/lib/push'

// GET /api/cron/deadline-1h
// 30분마다 실행 — 마감 55~75분 전 과제 미제출자에게 웹 푸시 전송
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() + 55 * 60_000)
  const windowEnd = new Date(now.getTime() + 75 * 60_000)

  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, cohort_id, title, deadline')
    .gte('deadline', windowStart.toISOString())
    .lte('deadline', windowEnd.toISOString())

  if (!assignments?.length) {
    return NextResponse.json({ message: 'No 1h deadlines', count: 0 })
  }

  let totalSent = 0

  for (const assignment of assignments) {
    const { data: members } = await supabase
      .from('cohort_members')
      .select('user_id, profile:profiles!user_id(role)')
      .eq('cohort_id', assignment.cohort_id)

    const studentIds = (members ?? [])
      .filter((m) => (m.profile as unknown as { role: string } | null)?.role !== 'admin')
      .map((m) => m.user_id as string)

    if (!studentIds.length) continue

    const { data: submissions } = await supabase
      .from('assignment_submissions')
      .select('user_id')
      .eq('assignment_id', assignment.id)
      .in('user_id', studentIds)

    const submittedIds = new Set((submissions ?? []).map((s) => s.user_id as string))
    const unsubmittedIds = studentIds.filter((id) => !submittedIds.has(id))

    if (!unsubmittedIds.length) continue

    const rows = unsubmittedIds.map((userId) => ({
      cohort_id: assignment.cohort_id,
      user_id: userId,
      title: '⏰ 마감 1시간 전!',
      body: `"${assignment.title}" 과제 마감이 1시간 남았습니다. 아직 제출 전이라면 서두르세요!`,
      type: 'deadline',
      related_id: assignment.id,
    }))
    await supabase.from('notifications').insert(rows)

    await sendPushToUsers(
      unsubmittedIds,
      '⏰ 마감 1시간 전!',
      `"${assignment.title}" 과제 마감이 1시간 남았습니다. 아직 제출 전이라면 서두르세요!`,
      `/${assignment.cohort_id}/assignments`
    )
    totalSent += unsubmittedIds.length
  }

  return NextResponse.json({ message: 'Done', count: totalSent })
}
