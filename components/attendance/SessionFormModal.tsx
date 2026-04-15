'use client'

import { useState } from 'react'
import type { AttendanceSession } from '@/types'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface SessionFormModalProps {
  cohortId: string
  editing: AttendanceSession | null
  onClose: () => void
  onSaved: (session: AttendanceSession) => void
}

const TYPE_OPTIONS = [
  { value: 'offline', label: '오프라인' },
  { value: 'zoom',    label: 'Zoom' },
  { value: 'hybrid',  label: '혼합' },
] as const

function toLocalTime(iso: string) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function SessionFormModal({
  cohortId,
  editing,
  onClose,
  onSaved,
}: SessionFormModalProps) {
  const isEdit = !!editing
  const supabase = createClient()

  const [title, setTitle] = useState(editing?.title ?? '')
  const [type, setType] = useState<'offline' | 'zoom' | 'hybrid'>(
    editing?.type ?? 'offline'
  )
  const [sessionDate, setSessionDate] = useState(editing?.session_date ?? '')
  const [startTime, setStartTime] = useState(
    editing?.start_time ? toLocalTime(editing.start_time) : ''
  )
  const [endTime, setEndTime] = useState(
    editing?.end_time ? toLocalTime(editing.end_time) : ''
  )
  const [zoomMeetingId, setZoomMeetingId] = useState(editing?.zoom_meeting_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !sessionDate || !startTime || !endTime) {
      setError('모든 필드를 입력해주세요')
      return
    }

    const startISO = new Date(`${sessionDate}T${startTime}:00`).toISOString()
    const endISO   = new Date(`${sessionDate}T${endTime}:00`).toISOString()

    if (new Date(endISO) <= new Date(startISO)) {
      setError('종료 시간은 시작 시간보다 늦어야 합니다')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      title: title.trim(),
      type,
      session_date: sessionDate,
      start_time: startISO,
      end_time: endISO,
      zoom_meeting_id: type === 'zoom' || type === 'hybrid' ? (zoomMeetingId.trim() || null) : null,
    }

    if (isEdit) {
      const { data, error: err } = await supabase
        .from('attendance_sessions')
        .update(payload)
        .eq('id', editing!.id)
        .select('*')
        .single()
      if (err) { setError(err.message); setSaving(false); return }
      onSaved(data as AttendanceSession)
    } else {
      const { data, error: err } = await supabase
        .from('attendance_sessions')
        .insert({ ...payload, cohort_id: cohortId })
        .select('*')
        .single()
      if (err) { setError(err.message); setSaving(false); return }
      onSaved(data as AttendanceSession)
    }

    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '세션 수정' : '새 출석 세션 추가'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 제목 */}
          <div className="space-y-1.5">
            <Label>세션 제목</Label>
            <Input
              placeholder="예: 1회차 오프라인 강의"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* 유형 */}
          <div className="space-y-1.5">
            <Label>유형</Label>
            <div className="flex gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium transition-colors border',
                    type === opt.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 날짜 */}
          <div className="space-y-1.5">
            <Label>날짜</Label>
            <Input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>

          {/* 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>시작 시간</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>종료 시간</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Zoom Meeting ID (줌/혼합 유형일 때만 표시) */}
          {(type === 'zoom' || type === 'hybrid') && (
            <div className="space-y-1.5">
              <Label>
                Zoom Meeting ID{' '}
                <span className="text-gray-400 font-normal text-xs">(데이터 가져오기에 필요)</span>
              </Label>
              <Input
                placeholder="예: 123 456 7890"
                value={zoomMeetingId}
                onChange={(e) => setZoomMeetingId(e.target.value.replace(/\s/g, ''))}
              />
              <p className="text-xs text-gray-400">
                Zoom 회의실 하단 &quot;회의 ID&quot; 숫자를 입력하세요
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? '저장 중...' : isEdit ? '수정 완료' : '세션 추가'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
