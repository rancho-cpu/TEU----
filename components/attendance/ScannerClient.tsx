'use client'

import { useState, useEffect, useRef } from 'react'
import type { AttendanceSession } from '@/types'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ScanLine, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface ScannerClientProps {
  cohortId: string
  sessions: AttendanceSession[]
}

interface ScanLog {
  id: string
  userName: string
  time: string
  type: 'in' | 'out'
  success: boolean
  message?: string
}

// UUID 형식 검증 (플랫폼 user_id)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ScannerClient({ cohortId, sessions }: ScannerClientProps) {
  const [selectedSession, setSelectedSession] = useState(sessions[0]?.id ?? '')
  const [scanMode, setScanMode] = useState<'auto' | 'in' | 'out'>('auto')
  const [logs, setLogs] = useState<ScanLog[]>([])
  const [feedback, setFeedback] = useState<ScanLog | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [processing, setProcessing] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cooldownMap = useRef(new Map<string, number>())

  // 항상 input에 포커스 유지
  useEffect(() => {
    inputRef.current?.focus()
    const onDocClick = () => inputRef.current?.focus()
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  const processUserId = async (userId: string) => {
    if (!UUID_RE.test(userId)) return          // UUID 아니면 무시
    if (!selectedSession || processing) return

    const now = Date.now()
    if ((cooldownMap.current.get(userId) ?? 0) + 2500 > now) return // 쿨다운
    cooldownMap.current.set(userId, now)

    setProcessing(true)
    try {
      const res  = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSession, userId, scanMode }),
      })
      const data = await res.json()

      const log: ScanLog = {
        id: `${now}-${userId}`,
        userName: data.userName ?? userId,
        time: data.time ? new Date(data.time).toLocaleTimeString('ko-KR') : '',
        type: data.type ?? 'in',
        success: !!(res.ok && data.success),
        message: data.alreadyComplete ? '이미 입퇴실 완료' : data.error,
      }
      setLogs((prev) => [log, ...prev.slice(0, 29)])
      setFeedback(log)
      clearTimeout(feedbackTimer.current)
      feedbackTimer.current = setTimeout(() => setFeedback(null), 2500)
    } finally {
      setProcessing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = inputValue.trim()
      setInputValue('')
      if (val) processUserId(val)
    }
  }

  const resetLog = () => {
    setLogs([])
    setFeedback(null)
  }

  const offlineSessions = sessions.filter((s) => s.type === 'offline' || s.type === 'hybrid')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href={`/${cohortId}/attendance`} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900">QR 출석 스캔</h1>
          <p className="text-xs text-gray-400">USB 바코드 리더기 전용</p>
        </div>
        <button
          onClick={resetLog}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          초기화
        </button>
      </div>

      {/* 세션 선택 + 모드 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 space-y-3">
        {offlineSessions.length === 0 ? (
          <p className="text-sm text-amber-600 py-1">
            오프라인/혼합 세션이 없습니다. 먼저 세션을 추가하세요.
          </p>
        ) : (
          <>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                세션
              </label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              >
                {offlineSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} · {s.session_date}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              {(['auto', 'in', 'out'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setScanMode(mode)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    scanMode === mode
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {mode === 'auto' ? '🔄 자동' : mode === 'in' ? '✅ 입실' : '🚪 퇴실'}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 스캔 영역 */}
      <div className="flex-1 p-4 space-y-4">
        {/* 리더기 입력 캡처 영역 */}
        <div className="relative">
          <div
            className={cn(
              'rounded-2xl border-2 p-8 text-center transition-all cursor-default',
              processing
                ? 'border-blue-300 bg-blue-50'
                : 'border-dashed border-gray-300 bg-white'
            )}
          >
            <ScanLine
              className={cn(
                'w-12 h-12 mx-auto mb-3',
                processing ? 'text-blue-400 animate-pulse' : 'text-indigo-300'
              )}
            />
            <p className="text-sm font-semibold text-gray-700">
              {processing ? 'QR 처리 중...' : 'QR 코드를 스캔하세요'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              USB 리더기로 학생의 QR 코드를 스캔하면 자동으로 출석이 기록됩니다
            </p>
            {/* 현재 입력값 표시 (디버그용, 리더기가 타이핑 중일 때만 잠깐 보임) */}
            {inputValue && (
              <p className="text-xs text-indigo-400 mt-2 font-mono">{inputValue}</p>
            )}
          </div>
          {/* 보이지 않는 input이 실제 키보드 입력을 받음 */}
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 opacity-0 cursor-default"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {/* 스캔 피드백 */}
        {feedback && (
          <div
            className={cn(
              'rounded-xl p-4 flex items-center gap-3 animate-in fade-in duration-150',
              feedback.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-amber-50 border border-amber-200'
            )}
          >
            <span className="text-3xl flex-shrink-0">
              {feedback.success
                ? feedback.type === 'in' ? '✅' : '🚪'
                : '⚠️'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-lg">{feedback.userName}</p>
              <p className="text-sm text-gray-500">
                {feedback.message
                  ? feedback.message
                  : `${feedback.type === 'in' ? '입실' : '퇴실'} · ${feedback.time}`}
              </p>
            </div>
          </div>
        )}

        {/* 스캔 기록 */}
        {logs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <span>스캔 기록</span>
              <span className="bg-indigo-100 text-indigo-600 rounded-full px-2 py-0.5">
                {logs.length}명
              </span>
            </p>
            <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {logs.map((log) => (
                <li key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-base flex-shrink-0">
                    {log.success ? (log.type === 'in' ? '✅' : '🚪') : '⚠️'}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                    {log.userName}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {log.message ?? `${log.type === 'in' ? '입실' : '퇴실'} ${log.time}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
