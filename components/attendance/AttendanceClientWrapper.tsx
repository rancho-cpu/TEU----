'use client'

import { useState } from 'react'
import type { Profile, AttendanceSession, OfflineAttendance } from '@/types'
import type { ZoomImportResult } from '@/app/api/attendance/zoom-import/route'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CalendarCheck, QrCode, ScanLine, Plus, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Pencil, Trash2, X, Download, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SessionFormModal } from './SessionFormModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Link from 'next/link'

interface AttendanceClientWrapperProps {
  cohortId: string
  currentUserId: string
  isAdmin: boolean
  sessions: AttendanceSession[]
  members: Profile[]
  attendanceRecords: OfflineAttendance[]
}

/** 출석 % 계산: 실제 체류 시간 / 세션 진행 시간 */
function calcAttendancePct(
  record: OfflineAttendance | undefined,
  session: AttendanceSession
): number {
  if (!record?.check_in && !record?.check_out) return 0

  const sessionStart = new Date(session.start_time).getTime()
  const sessionEnd   = new Date(session.end_time).getTime()
  const duration     = sessionEnd - sessionStart
  if (duration <= 0) return 100

  const checkIn  = record.check_in  ? new Date(record.check_in).getTime()  : null
  const checkOut = record.check_out ? new Date(record.check_out).getTime() : null

  // 세션 구간과의 실제 겹침 계산
  const from = checkIn  ? Math.max(checkIn,  sessionStart) : sessionStart
  const to   = checkOut ? Math.min(checkOut, sessionEnd)   : sessionEnd
  const overlap = Math.max(0, to - from)

  if (overlap > 0) {
    return Math.min(100, Math.round((overlap / duration) * 100))
  }

  // 겹침이 없지만 기록은 존재 (세션 시간 오차 or 잘못된 세션에 스캔)
  // → 실제 체류 시간(check_in ~ check_out)을 기준으로 계산
  if (checkIn && checkOut && checkOut > checkIn) {
    return Math.min(100, Math.round(((checkOut - checkIn) / duration) * 100))
  }

  // 한 쪽 기록만 있는 경우 출석으로 인정
  return 100
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(dateStr: string) {
  // session_date is YYYY-MM-DD (no time zone shift needed)
  const [y, m, d] = dateStr.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
  })
}

function PctBadge({ pct }: { pct: number }) {
  return (
    <span
      className={cn(
        'text-sm font-bold',
        pct >= 80 ? 'text-green-600' : pct > 0 ? 'text-amber-500' : 'text-gray-400'
      )}
    >
      {pct}%
    </span>
  )
}

export function AttendanceClientWrapper({
  cohortId,
  currentUserId,
  isAdmin,
  sessions: initialSessions,
  members,
  attendanceRecords: initialRecords,
}: AttendanceClientWrapperProps) {
  const [sessions, setSessions] = useState<AttendanceSession[]>(initialSessions)
  const [records, setRecords] = useState<OfflineAttendance[]>(initialRecords)
  const [sessionTab, setSessionTab] = useState<'offline' | 'zoom'>('offline')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState<AttendanceSession | null>(null)
  const [showMyQR, setShowMyQR] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Zoom import 상태
  const [importingSessionId, setImportingSessionId] = useState<string | null>(null)
  const [zoomImportResult, setZoomImportResult] = useState<ZoomImportResult | null>(null)
  const [zoomMappingSessionId, setZoomMappingSessionId] = useState<string | null>(null)
  // 이름 매핑: zoomName → userId (선택 중)
  const [pendingMappings, setPendingMappings] = useState<
    Record<string, string>
  >({})
  const [savingMappings, setSavingMappings] = useState(false)

  // 기록 조회 헬퍼
  const getRecord = (sessionId: string, userId: string) =>
    records.find((r) => r.session_id === sessionId && r.user_id === userId)

  // Zoom 데이터 가져오기
  const handleZoomImport = async (sessionId: string) => {
    setImportingSessionId(sessionId)
    try {
      const res  = await fetch('/api/attendance/zoom-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (!res.ok) { alert(`가져오기 실패: ${data.error}`); return }

      const result = data as ZoomImportResult
      // 매칭된 참석자 → records에 반영
      const newRecs: OfflineAttendance[] = result.matched.map((m) => ({
        id: `zoom-${sessionId}-${m.userId}`,
        session_id: sessionId,
        user_id: m.userId,
        check_in: m.checkIn,
        check_out: m.checkOut,
        note: `zoom:${m.zoomName}`,
        created_at: new Date().toISOString(),
      }))
      setRecords((prev) => [
        ...prev.filter((r) => r.session_id !== sessionId || !newRecs.find((nr) => nr.user_id === r.user_id)),
        ...newRecs,
      ])

      if (result.unmatched.length > 0) {
        setZoomImportResult(result)
        setZoomMappingSessionId(sessionId)
        setPendingMappings({})
      } else {
        alert(`✅ ${result.matched.length}명 자동 매핑 완료`)
      }
    } finally {
      setImportingSessionId(null)
    }
  }

  // 이름 매핑 저장
  const handleSaveMappings = async () => {
    if (!zoomMappingSessionId || !zoomImportResult) return
    setSavingMappings(true)

    const session = sessions.find((s) => s.id === zoomMappingSessionId)
    const mappingsToSave = zoomImportResult.unmatched
      .filter((u) => pendingMappings[u.zoomName])
      .map((u) => ({
        zoomName: u.zoomName,
        zoomEmail: u.zoomEmail,
        userId: pendingMappings[u.zoomName],
        checkIn: u.checkIn,
        checkOut: u.checkOut,
      }))

    const res = await fetch('/api/attendance/zoom-import', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: zoomMappingSessionId,
        cohortId: session?.cohort_id,
        mappings: mappingsToSave,
      }),
    })

    if (res.ok) {
      const newRecs: OfflineAttendance[] = mappingsToSave.map((m) => ({
        id: `zoom-mapped-${zoomMappingSessionId}-${m.userId}`,
        session_id: zoomMappingSessionId,
        user_id: m.userId,
        check_in: m.checkIn,
        check_out: m.checkOut,
        note: `zoom:${m.zoomName}`,
        created_at: new Date().toISOString(),
      }))
      setRecords((prev) => [...prev, ...newRecs])
    }
    setSavingMappings(false)
    setZoomImportResult(null)
    setZoomMappingSessionId(null)
    setPendingMappings({})
  }

  // 세션 삭제
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('이 세션을 삭제하면 출석 기록도 모두 삭제됩니다. 계속하시겠습니까?')) return
    setDeletingId(sessionId)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error } = await supabase.from('attendance_sessions').delete().eq('id', sessionId)
    if (!error) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      setRecords((prev) => prev.filter((r) => r.session_id !== sessionId))
      if (expanded === sessionId) setExpanded(null)
    }
    setDeletingId(null)
  }

  // 탭 기준 필터링
  const offlineSessions = sessions.filter((s) => s.type === 'offline' || s.type === 'hybrid')
  const zoomSessions    = sessions.filter((s) => s.type === 'zoom'    || s.type === 'hybrid')
  const tabSessions     = sessionTab === 'offline' ? offlineSessions : zoomSessions

  // 내 전체 출석률 (student, 현재 탭 기준)
  const myOverallPct =
    tabSessions.length === 0
      ? null
      : Math.round(
          tabSessions.reduce(
            (sum, s) => sum + calcAttendancePct(getRecord(s.id, currentUserId), s),
            0
          ) / tabSessions.length
        )

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">출석</h1>
          <p className="text-sm text-gray-500 mt-1">총 {sessions.length}개 세션</p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <Button
              variant="outline"
              onClick={() => setShowMyQR((v) => !v)}
              className="flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              내 QR
            </Button>
          )}
          {isAdmin && (
            <>
              <Link href={`/${cohortId}/attendance/scan`}>
                <Button variant="outline" className="flex items-center gap-2">
                  <ScanLine className="w-4 h-4" />
                  QR 스캔
                </Button>
              </Link>
              <Button
                onClick={() => { setEditingSession(null); setShowForm(true) }}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                새 세션
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 탭: 오프라인 / 온라인(Zoom) */}
      <div className="flex gap-1 border border-gray-200 rounded-xl p-1 mb-5 bg-white">
        <button
          onClick={() => { setSessionTab('offline'); setExpanded(null) }}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
            sessionTab === 'offline'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          오프라인
          {offlineSessions.length > 0 && (
            <span className={cn('ml-1.5 text-xs', sessionTab === 'offline' ? 'opacity-70' : 'text-gray-400')}>
              {offlineSessions.length}회
            </span>
          )}
        </button>
        <button
          onClick={() => { setSessionTab('zoom'); setExpanded(null) }}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
            sessionTab === 'zoom'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          온라인 (Zoom)
          {zoomSessions.length > 0 && (
            <span className={cn('ml-1.5 text-xs', sessionTab === 'zoom' ? 'opacity-70' : 'text-gray-400')}>
              {zoomSessions.length}회
            </span>
          )}
        </button>
      </div>

      {/* 내 QR 코드 패널 (student) */}
      {!isAdmin && showMyQR && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 relative">
          <button
            onClick={() => setShowMyQR(false)}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-indigo-500" />
            내 출석 QR 코드
          </h2>
          <div className="flex justify-center mb-3">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-inner inline-block">
              <QRCode value={currentUserId} size={180} />
            </div>
          </div>
          <p className="text-xs text-center text-gray-400 mt-2">
            관리자의 리더기에 이 QR을 보여 출석을 기록합니다
          </p>
        </div>
      )}

      {/* 내 전체 출석률 요약 (student) */}
      {!isAdmin && myOverallPct !== null && sessions.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-4 mb-6">
          <p className="text-sm font-medium text-gray-600 mb-1">전체 출석률</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-indigo-700">{myOverallPct}%</span>
            <span className="text-sm text-gray-500">({sessions.length}개 세션 평균)</span>
          </div>
          <div className="h-2 bg-white rounded-full overflow-hidden border border-indigo-100">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${myOverallPct}%` }}
            />
          </div>
        </div>
      )}

      {/* 세션 목록 */}
      {tabSessions.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CalendarCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">
            {sessionTab === 'offline' ? '오프라인' : '온라인'} 세션이 없습니다
          </p>
          {isAdmin && (
            <p className="text-sm mt-1">새 세션 버튼으로 추가하세요</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tabSessions.map((session, idx) => {
            const isExpanded = expanded === session.id
            const sessionRecs = records.filter((r) => r.session_id === session.id)
            const presentCount = sessionRecs.filter((r) => r.check_in || r.check_out).length
            const totalCount = members.length
            const sessionPct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0

            const myRecord = getRecord(session.id, currentUserId)
            const myPct = calcAttendancePct(myRecord, session)

            const typeLabel = session.type === 'hybrid' ? '혼합' : sessionTab === 'offline' ? '오프라인' : 'Zoom'
            const typeBg = sessionTab === 'zoom' ? 'bg-emerald-500' : 'bg-indigo-500'

            return (
              <div key={session.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* 세션 헤더 */}
                <button
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setExpanded(isExpanded ? null : session.id)}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0',
                      typeBg
                    )}
                  >
                    {tabSessions.length - idx}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 truncate">{session.title}</p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {typeLabel}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {fmtDate(session.session_date)}
                      &nbsp;·&nbsp;
                      {fmtTime(session.start_time)} ~ {fmtTime(session.end_time)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 mr-1">
                    {isAdmin ? (
                      <>
                        <p className="text-lg font-bold text-indigo-600">{sessionPct}%</p>
                        <p className="text-xs text-gray-400">
                          {presentCount}/{totalCount}명
                        </p>
                      </>
                    ) : (
                      <>
                        <PctBadge pct={myPct} />
                        <p className="text-xs text-gray-400">내 출석</p>
                      </>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {/* 상세 펼치기 */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {isAdmin ? (
                      <>
                        {/* 관리자: 전체 멤버 출석 현황 */}
                        {members.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-6">
                            코호트 멤버가 없습니다
                          </p>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {members.map((member) => {
                              const rec = getRecord(session.id, member.id)
                              const pct = calcAttendancePct(rec, session)
                              const isPresent = !!(rec?.check_in || rec?.check_out)

                              return (
                                <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                                  <div
                                    className={cn(
                                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                                      isPresent
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-400'
                                    )}
                                  >
                                    {(member.name ?? member.email ?? '?')
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">
                                      {member.name ?? member.email}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      {rec?.check_in
                                        ? `입실 ${fmtTime(rec.check_in)}`
                                        : '입실 없음'}
                                      &nbsp;·&nbsp;
                                      {rec?.check_out
                                        ? `퇴실 ${fmtTime(rec.check_out)}`
                                        : '퇴실 없음'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <PctBadge pct={pct} />
                                    {isPresent ? (
                                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-gray-300" />
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* 관리자 액션 */}
                        <div className="p-3 bg-gray-50 flex items-center gap-2 flex-wrap border-t border-gray-100">
                          {/* Zoom 전용: 데이터 가져오기 */}
                          {(session.type === 'zoom' || session.type === 'hybrid') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-emerald-600 border-emerald-200 hover:border-emerald-400 hover:text-emerald-700"
                              disabled={importingSessionId === session.id}
                              onClick={() => handleZoomImport(session.id)}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              {importingSessionId === session.id
                                ? 'Zoom 데이터 불러오는 중...'
                                : 'Zoom 참석 데이터 가져오기'}
                            </Button>
                          )}
                          {!session.zoom_meeting_id && (session.type === 'zoom' || session.type === 'hybrid') && (
                            <span className="text-xs text-amber-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Meeting ID 없음
                            </span>
                          )}
                          <div className="flex-1" />
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => {
                              setEditingSession(session)
                              setShowForm(true)
                            }}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            세션 수정
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-red-500 hover:text-red-600 border-red-200 hover:border-red-300"
                            disabled={deletingId === session.id}
                            onClick={() => handleDeleteSession(session.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            {deletingId === session.id ? '삭제 중...' : '세션 삭제'}
                          </Button>
                        </div>
                      </>
                    ) : (
                      /* 학생: 내 출석 상세 */
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1.5">
                            <p className="text-sm text-gray-700">
                              {myRecord?.check_in ? (
                                <span className="text-green-600">
                                  ✅ 입실: {fmtTime(myRecord.check_in)}
                                </span>
                              ) : (
                                <span className="text-gray-400">❌ 입실 기록 없음</span>
                              )}
                            </p>
                            <p className="text-sm text-gray-700">
                              {myRecord?.check_out ? (
                                <span className="text-blue-600">
                                  🚪 퇴실: {fmtTime(myRecord.check_out)}
                                </span>
                              ) : (
                                <span className="text-gray-400">🚪 퇴실 기록 없음</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={cn(
                                'text-3xl font-bold',
                                myPct >= 80
                                  ? 'text-green-600'
                                  : myPct > 0
                                  ? 'text-amber-500'
                                  : 'text-gray-400'
                              )}
                            >
                              {myPct}%
                            </p>
                            <p className="text-xs text-gray-400">출석률</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 세션 생성/수정 모달 */}
      {showForm && (
        <SessionFormModal
          cohortId={cohortId}
          editing={editingSession}
          onClose={() => {
            setShowForm(false)
            setEditingSession(null)
          }}
          onSaved={(s) => {
            if (editingSession) {
              setSessions((prev) => prev.map((x) => (x.id === s.id ? s : x)))
            } else {
              setSessions((prev) => [s, ...prev])
            }
            setShowForm(false)
            setEditingSession(null)
          }}
        />
      )}

      {/* Zoom 이름 매핑 모달 */}
      {zoomImportResult && zoomMappingSessionId && (
        <Dialog
          open
          onOpenChange={() => {
            setZoomImportResult(null)
            setZoomMappingSessionId(null)
            setPendingMappings({})
          }}
        >
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Zoom 참석자 매핑
              </DialogTitle>
            </DialogHeader>

            {/* 자동 매핑 완료 */}
            {zoomImportResult.matched.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                <p className="font-semibold text-green-700 mb-1">
                  ✅ 자동 매핑 완료: {zoomImportResult.matched.length}명
                </p>
                <p className="text-green-600 text-xs">
                  {zoomImportResult.matched.map((m) => m.userName).join(', ')}
                </p>
              </div>
            )}

            {/* 미매핑 참석자 */}
            <div className="space-y-2 mt-1">
              <p className="text-sm font-semibold text-gray-700">
                미매핑 참석자 {zoomImportResult.unmatched.length}명 — 플랫폼 사용자를 연결하세요
              </p>
              <p className="text-xs text-gray-400">
                한 번 설정하면 다음번에 같은 Zoom 이름을 자동으로 인식합니다
              </p>
              {zoomImportResult.unmatched.map((u) => {
                const sessionData = sessions.find((s) => s.id === zoomMappingSessionId)
                const durationMin = Math.round(u.durationSec / 60)
                const sessionDurationMin = Math.round(
                  (zoomImportResult.sessionDurationSec ?? 0) / 60
                )
                return (
                  <div
                    key={u.zoomName}
                    className="border border-gray-200 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{u.zoomName}</p>
                        {u.zoomEmail && (
                          <p className="text-xs text-gray-400">{u.zoomEmail}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          참여 {durationMin}분 / {sessionDurationMin}분
                        </p>
                      </div>
                      <select
                        value={pendingMappings[u.zoomName] ?? ''}
                        onChange={(e) =>
                          setPendingMappings((prev) => ({
                            ...prev,
                            [u.zoomName]: e.target.value,
                          }))
                        }
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400 min-w-[140px]"
                      >
                        <option value="">-- 매핑 안 함</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name ?? m.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setZoomImportResult(null)
                  setZoomMappingSessionId(null)
                  setPendingMappings({})
                }}
              >
                닫기
              </Button>
              <Button
                onClick={handleSaveMappings}
                disabled={
                  savingMappings ||
                  Object.values(pendingMappings).filter(Boolean).length === 0
                }
              >
                {savingMappings
                  ? '저장 중...'
                  : `매핑 저장 (${Object.values(pendingMappings).filter(Boolean).length}명)`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
