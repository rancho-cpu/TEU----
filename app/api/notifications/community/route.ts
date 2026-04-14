import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/notifications/community
// 인증된 모든 유저가 커뮤니티 알림을 보낼 수 있음 (댓글/좋아요/반응)
// Body: { cohortId, recipientId, title, body, relatedId }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cohortId, recipientId, title, body, relatedId } = await req.json()
  if (!cohortId || !recipientId || !title?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 자기 자신에게는 알림 안 보냄
  if (recipientId === user.id) {
    return NextResponse.json({ success: true, skipped: true })
  }

  const serviceSupabase = createServiceClient()
  const { error } = await serviceSupabase.from('notifications').insert({
    cohort_id: cohortId,
    user_id: recipientId,
    title: title.trim(),
    body: body?.trim() || null,
    type: 'community',
    related_id: relatedId || null,
    sender_id: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
