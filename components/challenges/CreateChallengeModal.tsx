'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import type { Challenge } from '@/types'

interface CreateChallengeModalProps {
  cohortId: string
  open: boolean
  onClose: () => void
  onCreated?: (challenge: Challenge) => void
}

export function CreateChallengeModal({
  cohortId,
  open,
  onClose,
  onCreated,
}: CreateChallengeModalProps) {
  const [emoji, setEmoji] = useState('🔥')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setEmoji('🔥')
    setTitle('')
    setDescription('')
    setStartAt('')
    setEndAt('')
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async () => {
    setError(null)

    if (!title.trim()) {
      setError('챌린지 제목을 입력해주세요.')
      return
    }
    if (!startAt) {
      setError('시작일을 설정해주세요.')
      return
    }
    if (!endAt) {
      setError('종료일을 설정해주세요.')
      return
    }
    if (new Date(endAt) <= new Date(startAt)) {
      setError('종료일은 시작일보다 이후여야 합니다.')
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()

      const { data, error: insertError } = await supabase
        .from('challenges')
        .insert({
          cohort_id: cohortId,
          emoji: emoji.trim() || '🔥',
          title: title.trim(),
          description: description.trim() || null,
          start_at: startAt,
          end_at: endAt,
          is_closed: false,
        })
        .select()
        .single()

      if (insertError) throw insertError

      onCreated?.(data as Challenge)
      handleClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '챌린지 생성 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900">챌린지 추가</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Emoji + Title row */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              제목 <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="🔥"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-16 text-center text-lg"
                maxLength={2}
              />
              <Input
                placeholder="챌린지 제목을 입력하세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 text-sm"
              />
            </div>
            <p className="text-xs text-gray-400">왼쪽에 이모지, 오른쪽에 제목을 입력하세요</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="challenge-desc" className="text-sm font-medium">
              설명
            </Label>
            <Textarea
              id="challenge-desc"
              placeholder="챌린지에 대한 설명을 입력하세요 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm min-h-[80px] resize-none"
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="challenge-start" className="text-sm font-medium">
                시작일시 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="challenge-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="challenge-end" className="text-sm font-medium">
                종료일시 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="challenge-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Preview */}
          {(title || emoji) && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">미리보기</p>
              <div className="flex items-center gap-2">
                <span className="text-xl">{emoji || '🔥'}</span>
                <span className="text-sm font-semibold text-gray-800">
                  {title || '챌린지 제목'}
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {submitting ? '저장 중...' : '챌린지 추가'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
