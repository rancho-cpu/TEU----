import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/notifications?cohortId=xxx  → 내 알림 목록 (최신 50개)
export async function GET(req: NextRequest) {
  const cohortId = req.nextUrl.searchParams.get('cohortId')
  if (!cohortId) return NextResponse.json({ error: 'Missing cohortId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('cohort_id', cohortId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notifications: data ?? [] })
}

// POST /api/notifications  → 관리자가 알림 발송
// Body: { cohortId, userIds: string[], title, body }
export async function POST(req: NextRequest) {
  const supabase = await createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { cohortId, userIds, title, body } = await req.json()
  if (!cohortId || !userIds?.length || !title?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const rows = (userIds as string[]).map((userId) => ({
    cohort_id: cohortId,
    user_id: userId,
    title: title.trim(),
    body: body?.trim() || null,
    type: 'manual',
  }))

  const { error } = await supabase.from('notifications').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, count: rows.length })
}

// PATCH /api/notifications  → 읽음 처리
// Body: { ids: string[] }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await req.json()
  if (!ids?.length) return NextResponse.json({ success: true })

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .in('id', ids as string[])
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
