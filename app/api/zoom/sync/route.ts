import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getZoomMeetings } from '@/lib/zoom/api'

export async function POST(req: NextRequest) {
  try {
    const { cohortId } = await req.json()
    if (!cohortId) {
      return NextResponse.json({ error: 'cohortId required' }, { status: 400 })
    }

    // 인증 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: '관리자만 사용할 수 있습니다.' }, { status: 403 })
    }

    // Zoom 환경변수 확인
    if (!process.env.ZOOM_ACCOUNT_ID || !process.env.ZOOM_CLIENT_ID || !process.env.ZOOM_CLIENT_SECRET) {
      return NextResponse.json({ error: 'Zoom 환경변수가 설정되지 않았습니다.' }, { status: 500 })
    }

    // Zoom 예약 회의 목록 가져오기
    let meetings
    try {
      meetings = await getZoomMeetings()
    } catch (zoomErr: unknown) {
      const msg = zoomErr instanceof Error ? zoomErr.message : 'Zoom API 오류'
      return NextResponse.json({ error: `Zoom 연결 실패: ${msg}` }, { status: 502 })
    }

    if (meetings.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: '예약된 회의가 없습니다. Zoom에서 회의를 먼저 예약해주세요.',
      })
    }

    // DB 저장 (join_url을 recording_url 컬럼에 저장)
    const adminSupabase = await createAdminClient()
    let synced = 0

    for (const meeting of meetings) {
      const { error: upsertError } = await adminSupabase.from('zoom_lectures').upsert(
        {
          cohort_id: cohortId,
          zoom_meeting_id: String(meeting.id),
          title: meeting.topic,
          recording_url: meeting.join_url,   // join_url 저장
          start_time: meeting.start_time,
          duration: meeting.duration * 60,   // 분 → 초
        },
        { onConflict: 'cohort_id,zoom_meeting_id' }
      )

      if (!upsertError) synced++
    }

    return NextResponse.json({ synced, total: meetings.length })
  } catch (err) {
    console.error('[zoom/sync]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '알 수 없는 오류' },
      { status: 500 }
    )
  }
}
