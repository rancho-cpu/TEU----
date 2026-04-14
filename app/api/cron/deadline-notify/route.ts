import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/cron/deadline-notify
// Vercel Cron이 30분마다 호출 (vercel.json 설정)
// Authorization: Bearer ${CRON_SECRET} 헤더 필수
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()
  // 매일 오전 8시(KST) 실행 → 오늘~내일 오전 8시 사이 마감 과제 알림
  const windowStart = now
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60_000)

  // 1. 마감 임박 과제 조회
  const { data: assignments, error: aErr } = await supabase
    .from('assignments')
    .select('id, cohort_id, title, deadline')
    .gte('deadline', windowStart.toISOString())
    .lte('deadline', windowEnd.toISOString())

  if (aErr || !assignments?.length) {
    return NextResponse.json({ message: 'No upcoming deadlines', count: 0 })
  }

  let totalSent = 0

  for (const assignment of assignments) {
    // 2. 이미 이 과제에 대해 deadline 알림을 보낸 적 있으면 skip
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('related_id', assignment.id)
      .eq('type', 'deadline')
      .limit(1)

    if (existing && existing.length > 0) continue

    // 3. 해당 기수 student 멤버 조회
    const { data: members } = await supabase
      .from('cohort_members')
      .select('user_id, profile:profiles!user_id(role)')
      .eq('cohort_id', assignment.cohort_id)

    const studentIds = (members ?? [])
      .filter((m) => {
        const p = (m.profile as unknown) as { role: string } | null
        return p?.role !== 'admin'
      })
      .map((m) => m.user_id as string)

    if (!studentIds.length) continue

    // 4. 미제출자 조회
    const { data: submissions } = await supabase
      .from('assignment_submissions')
      .select('user_id')
      .eq('assignment_id', assignment.id)
      .in('user_id', studentIds)

    const submittedIds = new Set((submissions ?? []).map((s) => s.user_id as string))
    const unsubmittedIds = studentIds.filter((id) => !submittedIds.has(id))

    if (!unsubmittedIds.length) continue

    // 5. 알림 일괄 INSERT
    const deadline = (assignment as { deadline?: string }).deadline
    const deadlineStr = deadline
      ? new Date(deadline).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '오늘'

    const rows = unsubmittedIds.map((userId) => ({
      cohort_id: assignment.cohort_id,
      user_id: userId,
      title: '⏰ 오늘 마감 과제 알림',
      body: `"${assignment.title}" 과제가 ${deadlineStr}에 마감됩니다. 아직 제출하지 않으셨다면 서두르세요!`,
      type: 'deadline',
      related_id: assignment.id,
    }))

    await supabase.from('notifications').insert(rows)
    totalSent += rows.length
  }

  return NextResponse.json({ message: 'Done', count: totalSent })
}
