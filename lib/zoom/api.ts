const ZOOM_API_BASE = 'https://api.zoom.us/v2'

async function getZoomAccessToken(): Promise<string> {
  const accountId = process.env.ZOOM_ACCOUNT_ID!
  const clientId = process.env.ZOOM_CLIENT_ID!
  const clientSecret = process.env.ZOOM_CLIENT_SECRET!

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Zoom 토큰 오류: ${res.status} ${body}`)
  }
  const data = await res.json()
  return data.access_token as string
}

export interface ZoomMeeting {
  id: number
  uuid: string
  topic: string
  start_time: string
  duration: number      // 분 단위
  join_url: string
  agenda?: string
  status?: string
}

/** 예약된 회의 목록 (upcoming + live) */
export async function getZoomMeetings(): Promise<ZoomMeeting[]> {
  const token = await getZoomAccessToken()

  // scheduled: 예약된 회의, type=upcoming: 예정+진행중
  const res = await fetch(
    `${ZOOM_API_BASE}/users/me/meetings?type=scheduled&page_size=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Zoom 회의 목록 오류: ${res.status} ${body}`)
  }

  const data = await res.json()
  return (data.meetings ?? []) as ZoomMeeting[]
}

/** 과거 녹화본 목록 (선택 사항) */
export interface ZoomRecording {
  uuid: string
  id: number
  topic: string
  start_time: string
  duration: number
  recording_files: Array<{
    id: string
    recording_type: string
    play_url: string
    download_url: string
    status: string
  }>
}

/** 회의 참석자 리포트 (회의 종료 후 사용 가능) */
export interface ZoomParticipant {
  name: string
  user_email: string
  join_time: string   // ISO timestamp
  leave_time: string  // ISO timestamp
  duration: number    // 초 단위 (누적)
}

export async function getZoomParticipants(meetingId: string): Promise<ZoomParticipant[]> {
  const token = await getZoomAccessToken()
  const all: ZoomParticipant[] = []
  let nextPageToken = ''

  do {
    const url = `${ZOOM_API_BASE}/report/meetings/${meetingId}/participants?page_size=300${nextPageToken ? `&next_page_token=${nextPageToken}` : ''}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Zoom 참석자 오류: ${res.status} ${body}`)
    }

    const data = await res.json()
    all.push(...(data.participants ?? []))
    nextPageToken = data.next_page_token ?? ''
  } while (nextPageToken)

  // 동일 유저가 재접속 시 여러 row → 이메일(또는 이름) 기준 집계
  const map = new Map<string, ZoomParticipant>()
  for (const p of all) {
    const key = p.user_email?.trim() || p.name?.trim()
    if (!key) continue
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...p })
    } else {
      existing.duration += p.duration
      if (p.join_time < existing.join_time) existing.join_time = p.join_time
      if (p.leave_time > existing.leave_time) existing.leave_time = p.leave_time
    }
  }

  return Array.from(map.values())
}

export async function getZoomRecordings(from: string, to: string): Promise<ZoomRecording[]> {
  const token = await getZoomAccessToken()

  const res = await fetch(
    `${ZOOM_API_BASE}/users/me/recordings?from=${from}&to=${to}&page_size=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Zoom 녹화 목록 오류: ${res.status} ${body}`)
  }
  const data = await res.json()
  return (data.meetings ?? []) as ZoomRecording[]
}
