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
