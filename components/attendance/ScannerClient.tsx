'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { AttendanceSession } from '@/types'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Camera, CameraOff } from 'lucide-react'
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

export function ScannerClient({ cohortId, sessions }: ScannerClientProps) {
  const [selectedSession, setSelectedSession] = useState<string>(
    sessions[0]?.id ?? ''
  )
  const [scanMode, setScanMode] = useState<'auto' | 'in' | 'out'>('auto')
  const [scanning, setScanning] = useState(false)
  const [logs, setLogs] = useState<ScanLog[]>([])
  const [feedback, setFeedback] = useState<ScanLog | null>(null)

  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const processingRef = useRef(false)
  const cooldownMap   = useRef<Map<string, number>>(new Map())

  // ── 카메라 시작 ────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)
    } catch {
      alert('카메라 접근 권한을 허용해주세요.\n(설정 → 브라우저 → 카메라 허용)')
    }
  }, [])

  // ── 카메라 중지 ────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  // ── QR 스캔 루프 ───────────────────────────────────────────
  useEffect(() => {
    if (!scanning) return

    let jsQR: ((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | null = null
    let mounted = true

    async function init() {
      const mod = await import('jsqr')
      if (!mounted) return
      jsQR = mod.default as typeof jsQR
      requestFrame()
    }

    function requestFrame() {
      animRef.current = requestAnimationFrame(tick)
    }

    function tick() {
      if (!mounted || !jsQR) return
      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        requestFrame()
        return
      }

      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0)

      const img  = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(img.data, img.width, img.height)

      if (code?.data && !processingRef.current) {
        const userId = code.data.trim()
        const now    = Date.now()
        const last   = cooldownMap.current.get(userId) ?? 0

        if (now - last > 2500) {
          cooldownMap.current.set(userId, now)
          handleScan(userId)
        }
      }

      requestFrame()
    }

    init()
    return () => {
      mounted = false
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, selectedSession, scanMode])

  // ── QR 처리 ────────────────────────────────────────────────
  const handleScan = async (userId: string) => {
    if (!selectedSession || processingRef.current) return
    processingRef.current = true

    try {
      const res  = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSession, userId, scanMode }),
      })
      const data = await res.json()

      const log: ScanLog = {
        id: `${Date.now()}-${userId}`,
        userName: data.userName ?? userId,
        time: data.time ? new Date(data.time).toLocaleTimeString('ko-KR') : '',
        type: data.type ?? 'in',
        success: res.ok && data.success,
        message: data.alreadyComplete ? '이미 입퇴실 완료' : data.error,
      }

      setLogs((prev) => [log, ...prev.slice(0, 29)])
      setFeedback(log)
      setTimeout(() => setFeedback(null), 2200)
    } finally {
      processingRef.current = false
    }
  }

  const selectedSessionData = sessions.find((s) => s.id === selectedSession)

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col select-none">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 shrink-0">
        <Link href={`/${cohortId}/attendance`} className="text-gray-300 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-base font-bold">QR 출석 스캔</h1>
      </div>

      {/* 세션 선택 + 모드 */}
      <div className="px-4 py-3 bg-gray-800 border-t border-gray-700 shrink-0 space-y-2">
        <div>
          <label className="text-[11px] text-gray-400 uppercase tracking-wider block mb-1">
            세션
          </label>
          {sessions.length === 0 ? (
            <p className="text-sm text-amber-400">
              먼저 출석 페이지에서 세션을 추가하세요
            </p>
          ) : (
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-indigo-400"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} · {s.session_date}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="text-[11px] text-gray-400 uppercase tracking-wider block mb-1">
            스캔 모드
          </label>
          <div className="flex gap-2">
            {(['auto', 'in', 'out'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setScanMode(mode)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  scanMode === mode
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                )}
              >
                {mode === 'auto' ? '🔄 자동' : mode === 'in' ? '✅ 입실' : '🚪 퇴실'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 카메라 영역 */}
      <div className="relative flex-1 bg-black overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* QR 가이드 프레임 */}
        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-56 h-56">
              {/* 네 모서리 */}
              {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map(
                (pos, i) => (
                  <div
                    key={i}
                    className={cn(
                      'absolute w-8 h-8 border-white',
                      pos,
                      i === 0 && 'border-t-2 border-l-2 rounded-tl-lg',
                      i === 1 && 'border-t-2 border-r-2 rounded-tr-lg',
                      i === 2 && 'border-b-2 border-l-2 rounded-bl-lg',
                      i === 3 && 'border-b-2 border-r-2 rounded-br-lg'
                    )}
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* 피드백 오버레이 */}
        {feedback && (
          <div
            className={cn(
              'absolute inset-x-3 top-3 p-4 rounded-2xl text-center shadow-2xl transition-all',
              feedback.success
                ? 'bg-green-600'
                : feedback.message
                ? 'bg-amber-500'
                : 'bg-red-600'
            )}
          >
            <div className="text-3xl mb-1">
              {feedback.success
                ? feedback.type === 'in' ? '✅' : '🚪'
                : feedback.message ? '⚠️' : '❌'}
            </div>
            <p className="font-bold text-lg leading-tight">{feedback.userName}</p>
            <p className="text-sm opacity-90 mt-0.5">
              {feedback.message
                ? feedback.message
                : feedback.success
                ? `${feedback.type === 'in' ? '입실' : '퇴실'} · ${feedback.time}`
                : '오류 발생'}
            </p>
          </div>
        )}

        {/* 시작 버튼 (카메라 꺼진 상태) */}
        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
            <Camera className="w-12 h-12 text-gray-400" />
            <Button
              onClick={startCamera}
              disabled={!selectedSession}
              className="bg-indigo-600 hover:bg-indigo-700 px-6"
            >
              카메라 시작
            </Button>
            {!selectedSession && (
              <p className="text-xs text-gray-400">세션을 먼저 선택하세요</p>
            )}
          </div>
        )}
      </div>

      {/* 카메라 중지 버튼 */}
      {scanning && (
        <div className="px-4 py-3 bg-gray-800 flex justify-center shrink-0 border-t border-gray-700">
          <Button
            onClick={stopCamera}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 text-sm"
          >
            <CameraOff className="w-4 h-4 mr-2" />
            카메라 중지
          </Button>
        </div>
      )}

      {/* 스캔 기록 */}
      <div className="bg-gray-800 border-t border-gray-700 shrink-0 max-h-48 overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-4">스캔 기록이 없습니다</p>
        ) : (
          <ul className="divide-y divide-gray-700">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xl flex-shrink-0">
                  {log.success ? (log.type === 'in' ? '✅' : '🚪') : '⚠️'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{log.userName}</p>
                  <p className="text-xs text-gray-400">
                    {log.time}
                    {log.message && ` · ${log.message}`}
                    {!log.message && ` · ${log.type === 'in' ? '입실' : '퇴실'}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
