import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/admin/sync-profiles?cohortId=xxx
// auth.users → profiles upsert + cohort_members 자동 추가
export async function POST(req: NextRequest) {
  const cohortId = req.nextUrl.searchParams.get('cohortId')

  // 현재 사용자가 admin인지 확인
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  // service role 로 auth.users 전체 조회
  const adminClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // profiles upsert (이미 있으면 무시)
  const profiles = users.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    name: (u.user_metadata?.name as string) ?? u.email?.split('@')[0] ?? '이름없음',
    role: 'student' as const,
  }))

  const { error: profilesError } = await adminClient
    .from('profiles')
    .upsert(profiles, { onConflict: 'id', ignoreDuplicates: true })

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 })

  // cohortId 가 있으면 cohort_members 에도 자동 추가
  let added = 0
  if (cohortId) {
    const members = profiles.map((p) => ({
      cohort_id: cohortId,
      user_id: p.id,
    }))

    const { error: membersError, count } = await adminClient
      .from('cohort_members')
      .upsert(members, { onConflict: 'cohort_id,user_id', ignoreDuplicates: true, count: 'exact' })

    if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })
    added = count ?? profiles.length
  }

  return NextResponse.json({ synced: profiles.length, added })
}
