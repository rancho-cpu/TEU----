import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/members?cohortId=xxx  → 기수 멤버 + 전체 플랫폼 유저 목록
export async function GET(req: NextRequest) {
  const cohortId = req.nextUrl.searchParams.get('cohortId')
  const supabase = await createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  // 전체 플랫폼 유저
  const { data: allProfiles } = await supabase
    .from('profiles').select('*').order('created_at', { ascending: false })

  if (!cohortId) return NextResponse.json({ profiles: allProfiles ?? [] })

  // 기수에 이미 들어온 user_id 목록
  const { data: members } = await supabase
    .from('cohort_members').select('user_id').eq('cohort_id', cohortId)

  const memberIds = new Set((members ?? []).map((m) => m.user_id))
  const notYetAdded = (allProfiles ?? []).filter((p) => !memberIds.has(p.id))

  return NextResponse.json({ profiles: notYetAdded })
}

// POST /api/members  → 멤버 추가
export async function POST(req: NextRequest) {
  const { cohortId, userId } = await req.json()
  if (!cohortId || !userId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = await createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { error } = await supabase.from('cohort_members').upsert(
    { cohort_id: cohortId, user_id: userId },
    { onConflict: 'cohort_id,user_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 방금 추가된 멤버 정보 반환
  const { data: newMember } = await supabase
    .from('cohort_members')
    .select('*, profile:profiles(*)')
    .eq('cohort_id', cohortId)
    .eq('user_id', userId)
    .single()

  return NextResponse.json({ member: newMember })
}

// DELETE /api/members  → 멤버 제거
export async function DELETE(req: NextRequest) {
  const { cohortId, userId } = await req.json()
  if (!cohortId || !userId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = await createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { error } = await supabase
    .from('cohort_members')
    .delete()
    .eq('cohort_id', cohortId)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
