'use client'

import { useState } from 'react'
import type { Profile, AttendanceSession, OfflineAttendance } from '@/types'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CalendarCheck, QrCode, ScanLine, Plus, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Pencil, Trash2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SessionFormModal } from './SessionFormModal'
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

  const from = record.check_in
    ? Math.max(new Date(record.check_in).getTime(), sessionStart)
    : sessionStart
  const to = record.check_out
    ? Math.min(new Date(record.check_out).getTime(), sessionEnd)
    : sessionEnd

  return Math.min(100, Math.max(0, Math.round(((to - from) / duration) * 100)))
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
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState<AttendanceSession | null>(null)
  const [showMyQR, setShowMyQR] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 기록 조회 헬퍼
  const getRecord = (sessionId: string, userId: string) =>
    records.find((r) => r.session_id === sessionId && r.user_id === userId)

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

  // 내 전체 출석률 (student)
  const myOverallPct =
    sessions.length === 0
      ? null
      : Math.round(
          sessions.reduce(
            (sum, s) => sum + calcAttendancePct(getRecord(s.id, currentUserId), s),
            0
          ) / sessions.length
        )

  return (
    <div className="p-6 max-w-3xl mx-auto">
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
      {sessions.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CalendarCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">아직 세션이 없습니다</p>
          {isAdmin && <p className="text-sm mt-1">새 세션을 추가하여 출석을 관리하세요</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, idx) => {
            const isExpanded = expanded === session.id
            const sessionRecs = records.filter((r) => r.session_id === session.id)
            const presentCount = sessionRecs.filter((r) => r.check_in || r.check_out).length
            const totalCount = members.length
            const sessionPct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0

            const myRecord = getRecord(session.id, currentUserId)
            const myPct = calcAttendancePct(myRecord, session)

            const typeLabel =
              session.type === 'offline' ? '오프라인'
              : session.type === 'zoom' ? 'Zoom'
              : '혼합'
            const typeBg =
              session.type === 'offline' ? 'bg-indigo-500'
              : session.type === 'zoom' ? 'bg-emerald-500'
              : 'bg-amber-500'

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
                    {sessions.length - idx}
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
                        <div className="p-3 bg-gray-50 flex items-center gap-2 justify-end border-t border-gray-100">
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
    </div>
  )
}
