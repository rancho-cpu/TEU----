'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { format, parseISO, isPast } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { Survey, SurveyQuestion, SurveyResponse } from '@/types'
import { ClipboardList, Users, Star, BarChart2, Trash2, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SurveyCardProps {
  survey: Survey
  responseCount?: number
  isAdmin?: boolean
  onDeleted?: (id: string) => void
}

function formatDeadline(dateStr: string | null): string {
  if (!dateStr) return '마감일 미정'
  try {
    const date = parseISO(dateStr)
    return format(date, 'yyyy/MM/dd HH:mm까지 제출', { locale: ko })
  } catch {
    return dateStr
  }
}

type AnswerMap = Record<number, string | number>

// ────────────────────────────────────────────────────────────
// Results helpers
// ────────────────────────────────────────────────────────────
function ResultsView({ survey, responses }: { survey: Survey; responses: SurveyResponse[] }) {
  if (responses.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400">아직 응답이 없습니다.</p>
  }

  return (
    <div className="space-y-6 py-2">
      <p className="text-sm text-gray-500 font-medium">총 {responses.length}명 응답</p>
      {survey.questions.map((q, i) => (
        <QuestionResult key={`qr-${i}`} index={i} question={q} responses={responses} />
      ))}
    </div>
  )
}

function QuestionResult({
  index,
  question,
  responses,
}: {
  index: number
  question: SurveyQuestion
  responses: SurveyResponse[]
}) {
  const key = `q${index}`
  const answers = responses.map((r) => r.responses[key]).filter((a) => a !== undefined && a !== '')

  return (
    <div className="space-y-2 bg-gray-50 rounded-xl p-4">
      <p className="text-sm font-semibold text-gray-800">
        <span className="text-indigo-500 font-bold mr-1">Q{index + 1}.</span>
        {question.label}
      </p>

      {question.type === 'rating' && (
        <RatingResult answers={answers as number[]} max={question.max} />
      )}
      {question.type === 'choice' && (
        <ChoiceResult answers={answers as string[]} options={question.options} />
      )}
      {question.type === 'text' && (
        <TextResult answers={answers as string[]} />
      )}
    </div>
  )
}

function RatingResult({ answers, max }: { answers: number[]; max: number }) {
  if (answers.length === 0) return <p className="text-xs text-gray-400">응답 없음</p>
  const avg = answers.reduce((s, v) => s + Number(v), 0) / answers.length
  const dist = Array.from({ length: max }, (_, i) => ({
    star: i + 1,
    count: answers.filter((a) => Number(a) === i + 1).length,
  }))
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        <span className="text-sm font-bold text-gray-800">{avg.toFixed(1)} / {max}</span>
        <span className="text-xs text-gray-400">({answers.length}명)</span>
      </div>
      <div className="space-y-1">
        {dist.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-8 shrink-0">{star}점</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 bg-yellow-400 rounded-full transition-all"
                style={{ width: answers.length ? `${(count / answers.length) * 100}%` : '0%' }}
              />
            </div>
            <span className="w-8 text-right">{count}명</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChoiceResult({ answers, options }: { answers: string[]; options: string[] }) {
  if (answers.length === 0) return <p className="text-xs text-gray-400">응답 없음</p>
  return (
    <div className="space-y-1">
      {options.map((opt) => {
        const count = answers.filter((a) => a === opt).length
        const pct = answers.length ? (count / answers.length) * 100 : 0
        return (
          <div key={opt} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-28 shrink-0 truncate">{opt}</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 bg-indigo-400 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-14 text-right">{count}명 ({Math.round(pct)}%)</span>
          </div>
        )
      })}
    </div>
  )
}

function TextResult({ answers }: { answers: string[] }) {
  if (answers.length === 0) return <p className="text-xs text-gray-400">응답 없음</p>
  return (
    <ul className="space-y-1 max-h-40 overflow-y-auto">
      {answers.map((a, i) => (
        <li key={`ans-${i}`} className="text-xs text-gray-700 bg-white rounded-lg px-3 py-2 border border-gray-100">
          {a}
        </li>
      ))}
    </ul>
  )
}

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────
export function SurveyCard({ survey, responseCount, isAdmin, onDeleted }: SurveyCardProps) {
  const [mode, setMode] = useState<'idle' | 'submit' | 'results'>('idle')
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  // results state
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [loadingResults, setLoadingResults] = useState(false)

  const isExpired = survey.deadline ? isPast(parseISO(survey.deadline)) : false

  const openSubmit = () => {
    setMode('submit')
    setError(null)
  }

  const openResults = async () => {
    setMode('results')
    setLoadingResults(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('survey_id', survey.id)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      setResponses((data as SurveyResponse[]) ?? [])
    } catch {
      setResponses([])
    } finally {
      setLoadingResults(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`"${survey.title}" 설문을 삭제하시겠습니까?`)) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('surveys').delete().eq('id', survey.id)
      if (error) throw error
      onDeleted?.(survey.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  const handleExcelExport = async () => {
    setExporting(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*, profile:profiles(name, email)')
        .eq('survey_id', survey.id)
        .order('submitted_at', { ascending: true })
      if (error) throw error

      const rows = (data ?? []).map((r) => {
        const row: Record<string, string | number> = {
          '이름': (r.profile as { name?: string } | null)?.name ?? '',
          '이메일': (r.profile as { email?: string } | null)?.email ?? '',
          '응답 시간': r.submitted_at
            ? format(parseISO(r.submitted_at), 'yyyy/MM/dd HH:mm', { locale: ko })
            : '',
        }
        survey.questions.forEach((q, i) => {
          row[`Q${i + 1}. ${q.label}`] = (r.responses as Record<string, string | number>)[`q${i}`] ?? ''
        })
        return row
      })

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '설문결과')
      XLSX.writeFile(wb, `${survey.title}_결과.xlsx`)
    } catch (e) {
      alert(e instanceof Error ? e.message : '내보내기 실패')
    } finally {
      setExporting(false)
    }
  }

  const handleAnswer = (index: number, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [index]: value }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다.')

      const responsesPayload: Record<string, string | number> = {}
      survey.questions.forEach((q, i) => {
        responsesPayload[`q${i}`] = answers[i] ?? ''
      })

      const { error: insertError } = await supabase.from('survey_responses').insert({
        survey_id: survey.id,
        user_id: user.id,
        responses: responsesPayload,
      })

      if (insertError) throw insertError
      setSubmitted(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '제출 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setMode('idle')
    setSubmitted(false)
    setError(null)
    setAnswers({})
  }

  return (
    <>
      {/* Card */}
      <div className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md hover:border-pink-300 transition-all duration-200">
        {/* Admin delete button */}
        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete() }}
            disabled={deleting}
            className="absolute top-3 right-3 z-10 p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="h-1.5 bg-gradient-to-r from-pink-400 to-rose-400" />
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100 border-0 text-xs px-2 py-0.5 font-medium gap-1">
              <ClipboardList className="w-3 h-3" />
              설문
            </Badge>
            {isExpired && (
              <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 border-0 text-xs px-2 py-0.5">
                마감
              </Badge>
            )}
            {responseCount !== undefined && (
              <Badge className="bg-indigo-50 text-indigo-600 hover:bg-indigo-50 border-0 text-xs px-2 py-0.5 gap-1 ml-auto">
                <Users className="w-3 h-3" />
                {responseCount}명 응답
              </Badge>
            )}
          </div>

          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
            {survey.title}
          </h3>
          <p className={`text-xs font-medium ${isExpired ? 'text-gray-400' : 'text-rose-500'}`}>
            {formatDeadline(survey.deadline)}
          </p>
          <p className="text-xs text-gray-400">{survey.questions.length}개 문항</p>

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            {isAdmin ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs gap-1"
                  onClick={openResults}
                >
                  <BarChart2 className="w-3 h-3" />
                  결과 보기
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={openSubmit}
                  disabled={isExpired}
                >
                  응답하기
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={openSubmit}
                disabled={isExpired}
              >
                {isExpired ? '마감됨' : '응답하기'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Submit Dialog */}
      <Dialog open={mode === 'submit'} onOpenChange={(open) => { if (!open) handleClose() }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">{survey.title}</DialogTitle>
            {survey.description && (
              <p className="text-sm text-gray-500 mt-1">{survey.description}</p>
            )}
          </DialogHeader>

          {submitted ? (
            <div className="flex flex-col items-center py-10 gap-3 text-center">
              <div className="text-4xl">✅</div>
              <p className="text-base font-semibold text-gray-800">설문이 제출되었습니다!</p>
              <p className="text-sm text-gray-500">참여해 주셔서 감사합니다.</p>
              <Button variant="outline" size="sm" onClick={handleClose} className="mt-2">
                닫기
              </Button>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {survey.questions.map((question, index) => (
                <QuestionField
                  key={`qf-${index}`}
                  index={index}
                  question={question}
                  value={answers[index]}
                  onChange={(val) => handleAnswer(index, val)}
                />
              ))}
              {error && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={handleClose} disabled={submitting}>
                  취소
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || isExpired}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {submitting ? '제출 중...' : '제출하기'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Results Dialog (admin only) */}
      <Dialog open={mode === 'results'} onOpenChange={(open) => { if (!open) handleClose() }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-500" />
              {survey.title} — 결과
            </DialogTitle>
          </DialogHeader>
          {loadingResults ? (
            <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : (
            <ResultsView survey={survey} responses={responses} />
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExcelExport}
              disabled={exporting}
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? '내보내는 중...' : '엑셀 다운로드'}
            </Button>
            <Button variant="outline" onClick={handleClose}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ────────────────────────────────────────────────────────────
// Question input field (for submit dialog)
// ────────────────────────────────────────────────────────────
interface QuestionFieldProps {
  index: number
  question: SurveyQuestion
  value: string | number | undefined
  onChange: (val: string | number) => void
}

function QuestionField({ index, question, value, onChange }: QuestionFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-800">
        <span className="text-indigo-500 font-bold mr-1">Q{index + 1}.</span>
        {question.label}
      </Label>

      {question.type === 'text' && (
        <Textarea
          placeholder="답변을 입력하세요"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[80px] text-sm resize-none"
        />
      )}

      {question.type === 'rating' && (
        <div className="flex items-center gap-1">
          {Array.from({ length: question.max }, (_, i) => i + 1).map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={`w-7 h-7 transition-colors ${
                  (value as number) >= star
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
          {value && (
            <span className="ml-2 text-sm text-gray-500">
              {value} / {question.max}
            </span>
          )}
        </div>
      )}

      {question.type === 'choice' && (
        <div className="space-y-2">
          {question.options.map((option, i) => (
            <label
              key={i}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                value === option
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <input
                type="radio"
                name={`q-${index}`}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                className="accent-indigo-600 w-4 h-4"
              />
              <span className="text-sm">{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
