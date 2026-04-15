import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST: QR 스캔 또는 수동 입력으로 출석 기록
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { sessionId, userId, scanMode = 'auto' } = body as {
    sessionId: string
    userId: string
    scanMode?: 'auto' | 'in' | 'out'
  }

  if (!sessionId || !userId) {
    return NextResponse.json({ error: '필드가 부족합니다' }, { status: 400 })
  }

  const service = createServiceClient()
  const now = new Date().toISOString()

  // 기존 기록 조회
  const { data: existing } = await service
    .from('offline_attendance')
    .select('id, check_in, check_out')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  let actualType: 'in' | 'out'

  if (scanMode === 'in') {
    actualType = 'in'
    if (!existing) {
      await service.from('offline_attendance').insert({
        session_id: sessionId, user_id: userId, check_in: now,
      })
    } else {
      await service.from('offline_attendance').update({ check_in: now }).eq('id', existing.id)
    }
  } else if (scanMode === 'out') {
    actualType = 'out'
    if (!existing) {
      await service.from('offline_attendance').insert({
        session_id: sessionId, user_id: userId, check_out: now,
      })
    } else {
      await service.from('offline_attendance').update({ check_out: now }).eq('id', existing.id)
    }
  } else {
    // auto: 첫 스캔 → 입실, 두 번째 스캔 → 퇴실
    if (!existing) {
      actualType = 'in'
      await service.from('offline_attendance').insert({
        session_id: sessionId, user_id: userId, check_in: now,
      })
    } else if (!existing.check_in) {
      actualType = 'in'
      await service.from('offline_attendance').update({ check_in: now }).eq('id', existing.id)
    } else if (!existing.check_out) {
      actualType = 'out'
      await service.from('offline_attendance').update({ check_out: now }).eq('id', existing.id)
    } else {
      // 이미 입퇴실 모두 기록됨
      const { data: targetProfile } = await service
        .from('profiles').select('name, email').eq('id', userId).single()
      return NextResponse.json({
        alreadyComplete: true,
        userName: targetProfile?.name ?? targetProfile?.email ?? userId,
      })
    }
  }

  const { data: targetProfile } = await service
    .from('profiles').select('name, email').eq('id', userId).single()

  return NextResponse.json({
    success: true,
    userName: targetProfile?.name ?? targetProfile?.email ?? userId,
    time: now,
    type: actualType,
  })
}

// PUT: 관리자 수동 출석 수정 (직접 시간 지정)
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sessionId, userId, checkIn, checkOut } = await req.json()
  const service = createServiceClient()

  const { error } = await service.from('offline_attendance').upsert(
    { session_id: sessionId, user_id: userId, check_in: checkIn ?? null, check_out: checkOut ?? null },
    { onConflict: 'session_id,user_id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE: 출석 기록 삭제
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const userId = searchParams.get('userId')
  if (!sessionId || !userId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service
    .from('offline_attendance')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
