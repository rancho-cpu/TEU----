'use client'

import { useState } from 'react'

// datetime-local 입력값(로컬 시간)을 UTC ISO 문자열로 변환
const toUTC = (localStr: string) => new Date(localStr).toISOString()
// UTC ISO 문자열을 datetime-local 입력값(로컬 시간)으로 변환
const toLocalInput = (utcStr: string) => {
  const d = new Date(utcStr)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import type { Survey, SurveyQuestion } from '@/types'
import { Plus, Trash2, GripVertical, X, Eye, EyeOff } from 'lucide-react'

type QuestionType = 'text' | 'rating' | 'choice'

interface DraftQuestion {
  id: string
  type: QuestionType
  label: string
  max?: number
  options?: string[]
}

const MAX_QUESTIONS = 20

interface CreateSurveyModalProps {
  cohortId: string
  open: boolean
  onClose: () => void
  onCreated?: (survey: Survey) => void
  editingSurvey?: Survey
  onUpdated?: (survey: Survey) => void
}

export function CreateSurveyModal({
  cohortId,
  open,
  onClose,
  onCreated,
  editingSurvey,
  onUpdated,
}: CreateSurveyModalProps) {
  const isEditMode = !!editingSurvey
  const [title, setTitle] = useState(editingSurvey?.title ?? '')
  const [description, setDescription] = useState(editingSurvey?.description ?? '')
  const [openAt, setOpenAt] = useState(
    editingSurvey?.open_at ? toLocalInput(editingSurvey.open_at) : ''
  )
  const [deadline, setDeadline] = useState(
    editingSurvey?.deadline ? toLocalInput(editingSurvey.deadline) : ''
  )
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    editingSurvey?.questions?.length
      ? editingSurvey.questions.map((q) => ({ id: crypto.randomUUID(), ...q }))
      : [{ id: crypto.randomUUID(), type: 'text', label: '' }]
  )
  const [isPublished, setIsPublished] = useState(editingSurvey?.is_published ?? false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setOpenAt('')
    setDeadline('')
    setQuestions([{ id: crypto.randomUUID(), type: 'text', label: '' }])
    setIsPublished(false)
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const addQuestion = () => {
    if (questions.length >= MAX_QUESTIONS) return
    setQuestions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: 'text', label: '' },
    ])
  }

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  const updateQuestion = (id: string, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
    )
  }

  const addOption = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, options: [...(q.options ?? []), ''] } : q
      )
    )
  }

  const updateOption = (id: string, optIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q
        const newOptions = [...(q.options ?? [])]
        newOptions[optIndex] = value
        return { ...q, options: newOptions }
      })
    )
  }

  const removeOption = (id: string, optIndex: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q
        const newOptions = (q.options ?? []).filter((_, i) => i !== optIndex)
        return { ...q, options: newOptions }
      })
    )
  }

  const handleSubmit = async () => {
    setError(null)

    if (!title.trim()) {
      setError('설문 제목을 입력해주세요.')
      return
    }
    if (questions.length === 0) {
      setError('최소 1개의 질문을 추가해주세요.')
      return
    }
    for (const q of questions) {
      if (!q.label.trim()) {
        setError('모든 질문의 내용을 입력해주세요.')
        return
      }
      if (q.type === 'choice' && (!q.options || q.options.length < 2)) {
        setError('선택형 질문은 최소 2개의 옵션이 필요합니다.')
        return
      }
    }

    setSubmitting(true)
    try {
      const supabase = createClient()

      const builtQuestions: SurveyQuestion[] = questions.map((q) => {
        if (q.type === 'text') return { type: 'text', label: q.label }
        if (q.type === 'rating') return { type: 'rating', label: q.label, max: q.max ?? 5 }
        return { type: 'choice', label: q.label, options: q.options ?? [] }
      })

      if (isEditMode && editingSurvey) {
        const { data, error: updateError } = await supabase
          .from('surveys')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            questions: builtQuestions,
            open_at: openAt ? toUTC(openAt) : null,
            deadline: deadline ? toUTC(deadline) : null,
            is_published: isPublished,
          })
          .eq('id', editingSurvey.id)
          .select()
          .single()
        if (updateError) throw updateError
        onUpdated?.(data as Survey)
      } else {
        const { data, error: insertError } = await supabase
          .from('surveys')
          .insert({
            cohort_id: cohortId,
            title: title.trim(),
            description: description.trim() || null,
            questions: builtQuestions,
            open_at: openAt ? toUTC(openAt) : null,
            deadline: deadline ? toUTC(deadline) : null,
            is_published: openAt ? false : isPublished,
          })
          .select()
          .single()
        if (insertError) throw insertError
        onCreated?.(data as Survey)
      }

      handleClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (isEditMode ? '설문 수정 중 오류가 발생했습니다.' : '설문 생성 중 오류가 발생했습니다.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900">{isEditMode ? '설문 수정' : '설문 추가'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="survey-title" className="text-sm font-medium">
              제목 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="survey-title"
              placeholder="설문 제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="survey-desc" className="text-sm font-medium">
              설명
            </Label>
            <Textarea
              id="survey-desc"
              placeholder="설문에 대한 간단한 설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm min-h-[72px] resize-none"
            />
          </div>

          {/* Open at / Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="survey-open-at" className="text-sm font-medium">
                시작일시 <span className="text-gray-400 font-normal text-xs">(자동 공개)</span>
              </Label>
              <Input
                id="survey-open-at"
                type="datetime-local"
                value={openAt}
                onChange={(e) => setOpenAt(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="survey-deadline" className="text-sm font-medium">
                마감일시
              </Label>
              <Input
                id="survey-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          {openAt && (
            <p className="text-xs text-violet-500 bg-violet-50 px-3 py-2 rounded-lg -mt-1">
              시작일이 설정되면 비공개로 생성되고, 해당 시간에 자동으로 공개됩니다.
            </p>
          )}

          {/* Publish toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <Label className="text-sm font-medium">공개 여부</Label>
              <p className="text-xs text-gray-400 mt-0.5">공개된 설문만 학생에게 표시되고 진행분으로 집계됩니다</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublished((v) => !v)}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                isPublished
                  ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-200 hover:text-indigo-600'
              }`}
            >
              {isPublished ? <><Eye className="w-4 h-4" /> 공개</> : <><EyeOff className="w-4 h-4" /> 비공개</>}
            </button>
          </div>

          <Separator />

          {/* Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                질문 목록{' '}
                <span className="text-gray-400 font-normal">
                  ({questions.length}/{MAX_QUESTIONS})
                </span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addQuestion}
                disabled={questions.length >= MAX_QUESTIONS}
                className="gap-1.5 text-xs h-8"
              >
                <Plus className="w-3.5 h-3.5" />
                질문 추가
              </Button>
            </div>

            <div className="space-y-4">
              {questions.map((question, index) => (
                <QuestionBuilder
                  key={question.id}
                  index={index}
                  question={question}
                  onUpdate={(patch) => updateQuestion(question.id, patch)}
                  onRemove={() => removeQuestion(question.id)}
                  onAddOption={() => addOption(question.id)}
                  onUpdateOption={(optIdx, val) => updateOption(question.id, optIdx, val)}
                  onRemoveOption={(optIdx) => removeOption(question.id, optIdx)}
                  canRemove={questions.length > 1}
                />
              ))}
            </div>
          </div>

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
            {submitting ? '저장 중...' : (isEditMode ? '수정 완료' : '설문 저장')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface QuestionBuilderProps {
  index: number
  question: DraftQuestion
  onUpdate: (patch: Partial<DraftQuestion>) => void
  onRemove: () => void
  onAddOption: () => void
  onUpdateOption: (optIdx: number, val: string) => void
  onRemoveOption: (optIdx: number) => void
  canRemove: boolean
}

function QuestionBuilder({
  index,
  question,
  onUpdate,
  onRemove,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  canRemove,
}: QuestionBuilderProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <span className="text-xs font-semibold text-indigo-600 flex-shrink-0">Q{index + 1}</span>

        <Input
          placeholder="질문 내용을 입력하세요"
          value={question.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="text-sm flex-1 bg-white"
        />

        <Select
          value={question.type}
          onValueChange={(val) =>
            onUpdate({
              type: val as QuestionType,
              options: val === 'choice' ? ['', ''] : undefined,
              max: val === 'rating' ? 5 : undefined,
            })
          }
        >
          <SelectTrigger className="w-28 text-xs bg-white flex-shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">텍스트</SelectItem>
            <SelectItem value="rating">별점</SelectItem>
            <SelectItem value="choice">선택형</SelectItem>
          </SelectContent>
        </Select>

        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="w-8 h-8 p-0 text-gray-400 hover:text-red-500 flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Rating max config */}
      {question.type === 'rating' && (
        <div className="flex items-center gap-2 pl-8">
          <Label className="text-xs text-gray-500 whitespace-nowrap">최대 점수</Label>
          <Select
            value={String(question.max ?? 5)}
            onValueChange={(v) => onUpdate({ max: Number(v) })}
          >
            <SelectTrigger className="w-20 text-xs bg-white h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[3, 4, 5, 7, 10].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}점
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Choice options */}
      {question.type === 'choice' && (
        <div className="pl-8 space-y-2">
          {(question.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
              <Input
                placeholder={`옵션 ${i + 1}`}
                value={opt}
                onChange={(e) => onUpdateOption(i, e.target.value)}
                className="text-sm bg-white h-8"
              />
              <button
                type="button"
                onClick={() => onRemoveOption(i)}
                className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAddOption}
            className="gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 h-8 pl-0"
          >
            <Plus className="w-3.5 h-3.5" />
            옵션 추가
          </Button>
        </div>
      )}
    </div>
  )
}
