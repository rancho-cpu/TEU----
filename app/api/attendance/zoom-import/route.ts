import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getZoomParticipants } from '@/lib/zoom/api'
import { NextRequest, NextResponse } from 'next/server'

export interface ZoomImportResult {
  matched: {
    userId: string
    userName: string
    zoomName: string
    zoomEmail: string
    checkIn: string
    checkOut: string
    durationSec: number
  }[]
  unmatched: {
    zoomName: string
    zoomEmail: string
    checkIn: string
    checkOut: string
    durationSec: number
  }[]
  sessionDurationSec: number
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sessionId } = await req.json()
  if (!sessionId) return NextResponse.json({ error: 'sessionId 필요' }, { status: 400 })

  const service = createServiceClient()

  // 세션 조회
  const { data: session } = await service
    .from('attendance_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
  if (!session.zoom_meeting_id) {
    return NextResponse.json({ error: '세션에 Zoom Meeting ID가 없습니다' }, { status: 400 })
  }

  // Zoom API 참석자 리포트 가져오기
  let participants
  try {
    participants = await getZoomParticipants(session.zoom_meeting_id)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }

  const cohortId = session.cohort_id
  const sessionStart = new Date(session.start_time).getTime()
  const sessionEnd   = new Date(session.end_time).getTime()
  const sessionDurationSec = Math.max(1, (sessionEnd - sessionStart) / 1000)

  // 코호트 멤버 이메일 맵 (email → user_id)
  const { data: membersData } = await service
    .from('cohort_members')
    .select('profile:profiles!user_id(id, name, email)')
    .eq('cohort_id', cohortId)

  const emailToUser = new Map<string, { id: string; name: string | null }>()
  for (const m of membersData ?? []) {
    const p = (m.profile as unknown) as { id: string; name: string | null; email: string } | null
    if (p?.email) emailToUser.set(p.email.toLowerCase(), { id: p.id, name: p.name })
  }

  // 저장된 이름 매핑 가져오기
  const { data: nameMappings } = await service
    .from('zoom_name_mappings')
    .select('zoom_name, user_id')
    .eq('cohort_id', cohortId)

  const nameToUserId = new Map<string, string>()
  for (const m of nameMappings ?? []) {
    nameToUserId.set(m.zoom_name.toLowerCase(), m.user_id)
  }

  const result: ZoomImportResult = {
    matched: [],
    unmatched: [],
    sessionDurationSec,
  }

  for (const p of participants) {
    const email = p.user_email?.trim().toLowerCase()
    const name  = p.name ?? ''

    // 1차: 이메일 매핑
    let matchedUser = email ? emailToUser.get(email) : undefined
    // 2차: 저장된 이름 매핑
    if (!matchedUser) {
      const savedUserId = nameToUserId.get(name.toLowerCase())
      if (savedUserId) {
        matchedUser = { id: savedUserId, name: null }
      }
    }

    if (matchedUser) {
      result.matched.push({
        userId: matchedUser.id,
        userName: matchedUser.name ?? name,
        zoomName: name,
        zoomEmail: p.user_email ?? '',
        checkIn: p.join_time,
        checkOut: p.leave_time,
        durationSec: p.duration,
      })
      // offline_attendance에 upsert
      await service.from('offline_attendance').upsert(
        {
          session_id: sessionId,
          user_id: matchedUser.id,
          check_in: p.join_time,
          check_out: p.leave_time,
          note: `zoom:${name}`,
        },
        { onConflict: 'session_id,user_id' }
      )
    } else {
      result.unmatched.push({
        zoomName: name,
        zoomEmail: p.user_email ?? '',
        checkIn: p.join_time,
        checkOut: p.leave_time,
        durationSec: p.duration,
      })
    }
  }

  return NextResponse.json(result)
}

// 이름 매핑 저장 + 해당 참석자 출석 반영
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sessionId, cohortId, mappings } = await req.json() as {
    sessionId: string
    cohortId: string
    mappings: { zoomName: string; zoomEmail: string; userId: string; checkIn: string; checkOut: string }[]
  }

  const service = createServiceClient()

  for (const m of mappings) {
    if (!m.userId) continue
    // 이름 매핑 저장
    await service.from('zoom_name_mappings').upsert(
      { cohort_id: cohortId, zoom_name: m.zoomName, user_id: m.userId },
      { onConflict: 'cohort_id,zoom_name' }
    )
    // 출석 기록 저장
    await service.from('offline_attendance').upsert(
      { session_id: sessionId, user_id: m.userId, check_in: m.checkIn, check_out: m.checkOut, note: `zoom:${m.zoomName}` },
      { onConflict: 'session_id,user_id' }
    )
  }

  return NextResponse.json({ success: true })
}
