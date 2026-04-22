import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServiceClient } from '@/lib/supabase/server'
import { sendPushToUsers } from '@/lib/push'

// POST /api/push/notice — 공지 게시글 생성 시 전체 멤버에게 푸시 + 인앱 알림 저장
// Body: { cohortId, title, postId }
export async function POST(req: NextRequest) {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { cohortId, title, postId } = await req.json()
  if (!cohortId || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: members } = await supabase
    .from('cohort_members')
    .select('user_id')
    .eq('cohort_id', cohortId)

  const userIds = (members ?? [])
    .map((m) => m.user_id as string)
    .filter((id) => id !== user.id)

  if (userIds.length > 0) {
    const serviceSupabase = createServiceClient()
    const rows = userIds.map((userId) => ({
      cohort_id: cohortId,
      user_id: userId,
      title: `📢 새 공지사항`,
      body: title,
      type: 'announcement',
      sender_id: user.id,
      related_id: postId ?? null,
    }))
    await serviceSupabase.from('notifications').insert(rows)

    const url = postId
      ? `/${cohortId}/community?post=${postId}`
      : `/${cohortId}/community`
    await sendPushToUsers(userIds, `📢 새 공지사항`, title, url)
  }

  return NextResponse.json({ success: true })
}
