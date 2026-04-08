import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/admin/sync-profiles
// auth.users 에 있는 모든 사용자를 profiles 테이블에 upsert
export async function POST() {
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

  // profiles 에 upsert
  const profiles = users.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    name: (u.user_metadata?.name as string) ?? u.email?.split('@')[0] ?? '이름없음',
    role: 'student' as const,
  }))

  const { error: upsertError } = await adminClient
    .from('profiles')
    .upsert(profiles, { onConflict: 'id', ignoreDuplicates: true })

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

  return NextResponse.json({ synced: profiles.length })
}
