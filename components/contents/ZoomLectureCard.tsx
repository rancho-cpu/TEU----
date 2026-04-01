'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format, parseISO, isFuture } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { ZoomLecture } from '@/types'
import { Video, ExternalLink, Clock, MoreVertical, Pencil, Trash2 } from 'lucide-react'

interface ZoomLectureCardProps {
  lecture: ZoomLecture
  isAdmin?: boolean
  onDeleted?: (id: string) => void
  onUpdated?: (lecture: ZoomLecture) => void
}

function formatLectureDate(dateStr: string | null): string {
  if (!dateStr) return '날짜 미정'
  try {
    return format(parseISO(dateStr), 'yyyy/MM/dd(EEE) HH:mm', { locale: ko })
  } catch {
    return dateStr
  }
}

function getStatus(startTime: string | null, duration: number | null) {
  if (!startTime) return 'upcoming'
  try {
    const start = parseISO(startTime)
    const end = new Date(start.getTime() + (duration ?? 3600) * 1000)
    const now = new Date()
    if (now >= start && now <= end) return 'live'
    if (isFuture(start)) return 'upcoming'
    return 'ended'
  } catch {
    return 'upcoming'
  }
}

export function ZoomLectureCard({ lecture, isAdmin, onDeleted, onUpdated }: ZoomLectureCardProps) {
  const status = getStatus(lecture.start_time, lecture.duration)
  const hasLink = Boolean(lecture.recording_url)

  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(lecture.title)
  const [editTime, setEditTime] = useState(
    lecture.start_time ? lecture.start_time.slice(0, 16) : ''
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleJoin = () => {
    if (lecture.recording_url) window.open(lecture.recording_url, '_blank', 'noopener,noreferrer')
  }

  const handleDelete = async () => {
    if (!confirm(`"${lecture.title}" 을(를) 목록에서 삭제하시겠습니까?\n(실제 Zoom 회의는 삭제되지 않습니다)`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/zoom/lecture', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lecture.id }),
      })
      if (!res.ok) throw new Error('삭제 실패')
      onDeleted?.(lecture.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  const handleEdit = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/zoom/lecture', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lecture.id,
          title: editTitle,
          start_time: editTime ? new Date(editTime).toISOString() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onUpdated?.(data.lecture as ZoomLecture)
      setEditOpen(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : '수정 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-blue-300 transition-all duration-200">
        {/* Thumbnail */}
        <div className="relative w-full aspect-video bg-[#0f1f3d] flex flex-col items-center justify-center select-none">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(255,255,255,0.1) 24px, rgba(255,255,255,0.1) 25px), repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(255,255,255,0.1) 24px, rgba(255,255,255,0.1) 25px)' }}
          />
          <span className="text-white font-black text-3xl tracking-widest z-10 drop-shadow-lg">TEU</span>
          <span className="text-blue-300 text-xs font-medium mt-1 tracking-wider z-10">교육 플랫폼</span>

          {status === 'live' && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full z-20 animate-pulse">
              <span className="w-1.5 h-1.5 bg-white rounded-full" />LIVE
            </div>
          )}

          {/* 관리자 메뉴 */}
          {isAdmin && (
            <div className="absolute top-2 right-2 z-20" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm"
                    className="h-7 w-7 p-0 bg-black/40 hover:bg-black/60 text-white rounded-full"
                    disabled={deleting}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditTitle(lecture.title); setEditOpen(true) }}>
                    <Pencil className="w-4 h-4 mr-2" />수정
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-red-500 focus:text-red-500">
                    <Trash2 className="w-4 h-4 mr-2" />삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {lecture.duration && (
            <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded z-10">
              {Math.floor(lecture.duration / 60)}분
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-xs px-2 py-0.5 font-medium gap-1">
              <Video className="w-3 h-3" />줌 강의
            </Badge>
            {status === 'live' && (
              <Badge className="bg-red-100 text-red-600 border-0 text-xs px-2 py-0.5 font-medium animate-pulse">진행 중</Badge>
            )}
            {status === 'upcoming' && (
              <Badge className="bg-green-100 text-green-700 border-0 text-xs px-2 py-0.5 font-medium">예정</Badge>
            )}
            {status === 'ended' && (
              <Badge className="bg-gray-100 text-gray-500 border-0 text-xs px-2 py-0.5">종료</Badge>
            )}
          </div>

          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{lecture.title}</h3>

          <p className="text-xs text-gray-400 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatLectureDate(lecture.start_time)}
          </p>

          <Button
            size="sm"
            className={`w-full text-xs gap-1 mt-1 ${
              status === 'live' ? 'bg-red-500 hover:bg-red-600 text-white'
              : status === 'upcoming' ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
            }`}
            onClick={handleJoin}
            disabled={!hasLink}
          >
            <ExternalLink className="w-3 h-3" />
            {status === 'live' ? '지금 참여하기' : status === 'upcoming' ? '회의 참여 링크' : '종료된 회의'}
          </Button>
        </div>
      </div>

      {/* 수정 다이얼로그 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-500" />강의 수정
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">제목</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="강의 제목" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">시작 시간</Label>
              <Input
                type="datetime-local"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>취소</Button>
            <Button onClick={handleEdit} disabled={saving || !editTitle.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
