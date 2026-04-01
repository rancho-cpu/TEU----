'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { format, parseISO, isPast } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { Challenge } from '@/types'
import { MoreHorizontal, Users, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ChallengeCardProps {
  challenge: Challenge
  isAdmin: boolean
  cohortId: string
  onDeleted?: (id: string) => void
  onUpdated?: (challenge: Challenge) => void
}

function formatDateRange(start: string, end: string): string {
  try {
    const startDate = parseISO(start)
    const endDate = parseISO(end)
    const fmt = 'yyyy/MM/dd HH:mm'
    return `${format(startDate, fmt, { locale: ko })} ~ ${format(endDate, fmt, { locale: ko })}`
  } catch {
    return `${start} ~ ${end}`
  }
}

function isChallengeExpired(challenge: Challenge): boolean {
  return challenge.is_closed || isPast(parseISO(challenge.end_at))
}

export function ChallengeCard({
  challenge,
  isAdmin,
  cohortId,
  onDeleted,
  onUpdated,
}: ChallengeCardProps) {
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [userSubmitted, setUserSubmitted] = useState(challenge.user_submitted ?? false)
  const [deleting, setDeleting] = useState(false)

  const expired = isChallengeExpired(challenge)

  const handleSubmit = async () => {
    if (!content.trim()) {
      setSubmitError('내용을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다.')

      const { error } = await supabase.from('challenge_submissions').insert({
        challenge_id: challenge.id,
        user_id: user.id,
        content: content.trim(),
      })
      if (error) throw error

      setUserSubmitted(true)
      setSubmitDialogOpen(false)
      setContent('')
      onUpdated?.({
        ...challenge,
        user_submitted: true,
        submission_count: (challenge.submission_count ?? 0) + 1,
      })
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : '제출 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('challenges')
        .delete()
        .eq('id', challenge.id)
      if (error) throw error
      onDeleted?.(challenge.id)
      setDeleteDialogOpen(false)
    } catch (e: unknown) {
      console.error('Failed to delete challenge:', e)
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleClosed = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('challenges')
        .update({ is_closed: !challenge.is_closed })
        .eq('id', challenge.id)
        .select()
        .single()
      if (error) throw error
      onUpdated?.(data as Challenge)
    } catch (e: unknown) {
      console.error('Failed to toggle challenge:', e)
    }
  }

  return (
    <>
      <div
        className={`
          bg-white rounded-xl border transition-all duration-200
          ${expired ? 'border-gray-200 opacity-80' : 'border-gray-200 hover:border-indigo-200 hover:shadow-sm'}
        `}
      >
        <div className="p-4 flex items-start gap-4">
          {/* Emoji */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center text-2xl border border-indigo-100">
            {challenge.emoji}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Title + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {expired && (
                <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 border-0 text-xs px-2 py-0.5">
                  종료
                </Badge>
              )}
              <h3
                className={`text-sm font-semibold leading-snug ${
                  expired ? 'text-gray-500' : 'text-gray-900'
                }`}
              >
                {challenge.title}
              </h3>
              {userSubmitted && (
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              )}
            </div>

            {/* Description */}
            {challenge.description && (
              <p className="text-xs text-gray-500 line-clamp-2">{challenge.description}</p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
              {challenge.submission_count !== undefined && (
                <span className="flex items-center gap-1 font-medium text-indigo-500">
                  <Users className="w-3.5 h-3.5" />
                  {challenge.submission_count}명 참가
                </span>
              )}
              <span className="text-gray-300">·</span>
              <span>{formatDateRange(challenge.start_at, challenge.end_at)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Submit button */}
            {!expired && !userSubmitted && (
              <Button
                size="sm"
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3"
                onClick={() => setSubmitDialogOpen(true)}
              >
                제출하기
              </Button>
            )}
            {userSubmitted && !expired && (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                제출완료
              </span>
            )}

            {/* Admin menu */}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={handleToggleClosed}
                    className="gap-2 text-sm cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                    {challenge.is_closed ? '재개하기' : '종료하기'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="gap-2 text-sm text-red-500 focus:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    삭제하기
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Submit Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={(v) => { if (!v) { setSubmitDialogOpen(false); setContent(''); setSubmitError(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <span>{challenge.emoji}</span>
              <span>{challenge.title}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {challenge.description && (
              <p className="text-sm text-gray-500">{challenge.description}</p>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                제출 내용 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="챌린지 참여 내용을 입력하세요"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[120px] text-sm resize-none"
              />
            </div>
            {submitError && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{submitError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setSubmitDialogOpen(false); setContent(''); setSubmitError(null) }}
              disabled={submitting}
            >
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {submitting ? '제출 중...' : '제출하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">챌린지 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            <span className="font-semibold text-gray-800">"{challenge.emoji} {challenge.title}"</span>을 삭제하시겠습니까?
            <br />
            <span className="text-red-500 text-xs mt-1 block">이 작업은 되돌릴 수 없습니다.</span>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              취소
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleting ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
