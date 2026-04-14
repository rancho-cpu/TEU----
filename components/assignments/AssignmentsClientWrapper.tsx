'use client'

import { useState, useRef } from 'react'
import type { Assignment, AssignmentSubmission, AssignmentAttachment, Survey } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  ClipboardList, Plus, Trash2, CheckCircle2, Circle,
  Calendar, Loader2, Paperclip, X, FileText, FileImage,
  FileVideo, File, ChevronDown, ChevronUp, Users, PenLine, ClipboardCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SurveyCard } from '@/components/contents/SurveyCard'
import { CreateSurveyModal } from '@/components/contents/CreateSurveyModal'

interface Props {
  cohortId: string
  initialAssignments: Assignment[]
  initialSurveys: Survey[]
  surveyResponseCountMap: Record<string, number>
  myRespondedSurveyIds: string[]
  isAdmin: boolean
  currentUserId: string
  attBaseUrl: string
}

function getFileIcon(type: string | null) {
  if (!type) return File
  if (type.startsWith('image/')) return FileImage
  if (type.startsWith('video/')) return FileVideo
  if (type.includes('pdf') || type.includes('word') || type.includes('text')) return FileText
  return File
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatDeadline(deadline: string | null) {
  if (!deadline) return null
  const d = new Date(deadline)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const days = Math.ceil(diff / 86400_000)
  const str = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  if (diff < 0) return { str, label: '마감됨', color: 'text-red-500' }
  if (days <= 1) return { str, label: '오늘 마감', color: 'text-orange-500' }
  if (days <= 3) return { str, label: `${days}일 남음`, color: 'text-amber-500' }
  return { str, label: `${days}일 남음`, color: 'text-gray-500' }
}

export function AssignmentsClientWrapper({
  cohortId, initialAssignments, initialSurveys, surveyResponseCountMap,
  myRespondedSurveyIds, isAdmin, currentUserId, attBaseUrl,
}: Props) {
  const supabase = createClient()
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments)
  const [surveys, setSurveys] = useState<Survey[]>(initialSurveys)
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>(surveyResponseCountMap)
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set(myRespondedSurveyIds))

  // 탭
  const [tab, setTab] = useState<'write' | 'survey'>('write')

  // 과제 생성
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // 설문 생성
  const [surveyModalOpen, setSurveyModalOpen] = useState(false)

  // 제출 모달
  const [submitTarget, setSubmitTarget] = useState<Assignment | null>(null)
  const [submitContent, setSubmitContent] = useState('')
  const [submitFiles, setSubmitFiles] = useState<{ file: File; objectUrl: string | null }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 관리자 제출 현황
  const [viewTarget, setViewTarget] = useState<Assignment | null>(null)
  const [viewSubs, setViewSubs] = useState<(AssignmentSubmission & { profile?: { name?: string | null; avatar_url?: string | null } })[]>([])
  const [loadingView, setLoadingView] = useState(false)
  const [expandedSub, setExpandedSub] = useState<string | null>(null)

  // 내 제출 열기
  const [myViewTarget, setMyViewTarget] = useState<Assignment | null>(null)

  const getUrl = (path: string) => `${attBaseUrl}${path}`

  // 통합 달성률 (학생용)
  const totalItems = assignments.length + surveys.length
  const completedItems = assignments.filter(a => a.user_submitted).length + respondedIds.size
  const unifiedRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  // ── 과제 생성 ─────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    setCreateError(null)
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        cohort_id: cohortId,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        deadline: newDeadline || null,
        order_index: assignments.length,
      })
      .select().single()
    if (error) {
      setCreateError(error.message)
    } else if (data) {
      setAssignments((prev) => [...prev, { ...data, submission_count: 0, user_submitted: false, my_submission: null }])
      setNewTitle(''); setNewDesc(''); setNewDeadline('')
      setCreateOpen(false)
    }
    setCreating(false)
  }

  // ── 과제 삭제 ─────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('이 과제를 삭제하시겠습니까?')) return
    await supabase.from('assignments').delete().eq('id', id)
    setAssignments((prev) => prev.filter((a) => a.id !== id))
  }

  // ── 설문 삭제 ─────────────────────────────────────────────
  const handleSurveyDeleted = (id: string) => {
    setSurveys((prev) => prev.filter((s) => s.id !== id))
  }

  // ── 설문 응답 ─────────────────────────────────────────────
  const handleSurveyResponded = (surveyId: string) => {
    setRespondedIds((prev) => new Set([...prev, surveyId]))
    if (isAdmin) {
      setResponseCounts((prev) => ({ ...prev, [surveyId]: (prev[surveyId] ?? 0) + 1 }))
    }
  }

  // ── 제출 모달 열기 ────────────────────────────────────────
  const openSubmit = (a: Assignment) => {
    setSubmitTarget(a)
    setSubmitContent(a.my_submission?.content ?? '')
    setSubmitFiles([])
    setSubmitError(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    const previews = selected.map((f) => ({
      file: f,
      objectUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }))
    setSubmitFiles((prev) => [...prev, ...previews].slice(0, 5))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (idx: number) => {
    setSubmitFiles((prev) => {
      if (prev[idx].objectUrl) URL.revokeObjectURL(prev[idx].objectUrl!)
      return prev.filter((_, i) => i !== idx)
    })
  }

  // ── 과제 제출 ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!submitTarget) return
    setSubmitting(true)
    setSubmitError(null)

    const { data: sub, error: subErr } = await supabase
      .from('assignment_submissions')
      .upsert(
        { assignment_id: submitTarget.id, user_id: currentUserId, content: submitContent.trim() || null },
        { onConflict: 'assignment_id,user_id' }
      )
      .select().single()

    if (subErr || !sub) { setSubmitError(subErr?.message ?? '제출 실패'); setSubmitting(false); return }

    const attachments: AssignmentAttachment[] = []
    for (const fp of submitFiles) {
      const ext = fp.file.name.split('.').pop() ?? 'bin'
      const path = `${cohortId}/${submitTarget.id}/${currentUserId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('assignment-attachments').upload(path, fp.file)
      if (upErr) continue
      const { data: att } = await supabase.from('assignment_attachments')
        .insert({ submission_id: sub.id, storage_path: path, file_name: fp.file.name, file_type: fp.file.type, file_size: fp.file.size })
        .select().single()
      if (att) attachments.push({ ...att, public_url: getUrl(att.storage_path) })
    }

    // 기존 첨부파일 보존 (수정 시 새 파일만 추가, 기존 파일은 유지)
    const existingAttachments = submitTarget.my_submission?.attachments ?? []
    const updatedSub: AssignmentSubmission = { ...sub, attachments: [...existingAttachments, ...attachments] }
    setAssignments((prev) => prev.map((a) =>
      a.id === submitTarget.id
        ? { ...a, user_submitted: true, my_submission: updatedSub, submission_count: (a.submission_count ?? 0) + (a.user_submitted ? 0 : 1) }
        : a
    ))
    setSubmitTarget(null)
    setSubmitting(false)
  }

  // ── 관리자: 제출 현황 보기 ────────────────────────────────
  const openView = async (a: Assignment) => {
    setViewTarget(a)
    setLoadingView(true)
    const { data } = await supabase
      .from('assignment_submissions')
      .select('*, profile:profiles!user_id(name, avatar_url, email), attachments:assignment_attachments(*)')
      .eq('assignment_id', a.id)
      .order('submitted_at', { ascending: true })
    setViewSubs((data ?? []) as typeof viewSubs)
    setLoadingView(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-500" />
            과제 제출
          </h1>
          {!isAdmin && totalItems > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {completedItems} / {totalItems}개 완료 · 달성률 {unifiedRate}%
            </p>
          )}
          {isAdmin && (
            <p className="text-sm text-gray-500 mt-1">
              글쓰기 {assignments.length}개 · 설문 {surveys.length}개
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setSurveyModalOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> 설문 추가
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> 과제 추가
            </Button>
          </div>
        )}
      </div>

      {/* 통합 제출률 바 (학생용) */}
      {!isAdmin && totalItems > 0 && (
        <div className="mb-6 bg-indigo-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-indigo-700">내 달성률</span>
            <span className="text-sm font-bold text-indigo-700">{unifiedRate}%</span>
          </div>
          <div className="w-full bg-indigo-100 rounded-full h-2">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${unifiedRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-indigo-500">
            <span>글쓰기 {assignments.filter(a => a.user_submitted).length}/{assignments.length}</span>
            <span>설문 {respondedIds.size}/{surveys.length}</span>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 mb-5 border border-gray-200 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setTab('write')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'write' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <PenLine className="w-4 h-4" />
          글쓰기 과제
          {assignments.length > 0 && (
            <span className={cn('text-xs rounded-full px-1.5 py-0.5 ml-0.5',
              tab === 'write' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            )}>{assignments.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('survey')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'survey' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <ClipboardCheck className="w-4 h-4" />
          설문
          {surveys.length > 0 && (
            <span className={cn('text-xs rounded-full px-1.5 py-0.5 ml-0.5',
              tab === 'survey' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            )}>{surveys.length}</span>
          )}
        </button>
      </div>

      {/* ── 글쓰기 과제 탭 ── */}
      {tab === 'write' && (
        <>
          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <PenLine className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-base font-medium">아직 글쓰기 과제가 없습니다</p>
              {isAdmin && (
                <p className="text-sm mt-1 cursor-pointer text-indigo-400 hover:underline" onClick={() => setCreateOpen(true)}>
                  + 첫 번째 과제를 추가해보세요
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => {
                const dl = formatDeadline(a.deadline)
                return (
                  <div key={a.id} className={cn(
                    'bg-white rounded-xl border transition-all',
                    a.user_submitted ? 'border-green-200' : 'border-gray-200'
                  )}>
                    {/* 카드 상단 — 제목 + 관리자 버튼 */}
                    <div className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {a.user_submitted
                            ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                            : <Circle className="w-5 h-5 text-gray-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900">{a.title}</h3>
                              {a.description && (
                                <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{a.description}</p>
                              )}
                              {dl && (
                                <p className={cn('text-xs mt-2 flex items-center gap-1', dl.color)}>
                                  <Calendar className="w-3.5 h-3.5" />
                                  {dl.str} · <span className="font-medium">{dl.label}</span>
                                </p>
                              )}
                            </div>
                            {/* 관리자 버튼만 오른쪽 상단에 */}
                            {isAdmin && (
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => openView(a)}
                                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                  {a.submission_count}명 제출
                                </button>
                                <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 학생용 — 카드 하단 제출 버튼 (크고 명확하게) */}
                    {!isAdmin && (
                      <div className="px-5 pb-4">
                        {a.user_submitted ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setMyViewTarget(a)}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-sm font-medium text-green-700 transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              내 제출물 보기
                            </button>
                            <button
                              onClick={() => openSubmit(a)}
                              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-sm font-medium text-indigo-700 transition-colors"
                            >
                              <PenLine className="w-4 h-4" />
                              수정
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openSubmit(a)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-medium text-white transition-colors"
                          >
                            <PenLine className="w-4 h-4" />
                            작성하고 제출하기
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── 설문 탭 ── */}
      {tab === 'survey' && (
        <>
          {surveys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <ClipboardCheck className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-base font-medium">아직 설문이 없습니다</p>
              {isAdmin && (
                <p className="text-sm mt-1 cursor-pointer text-indigo-400 hover:underline" onClick={() => setSurveyModalOpen(true)}>
                  + 첫 번째 설문을 추가해보세요
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {surveys.map((s) => (
                <div key={s.id} className="relative">
                  {/* 응답 완료 배지 (학생) */}
                  {!isAdmin && respondedIds.has(s.id) && (
                    <div className="absolute -top-2 -right-2 z-10 bg-green-500 text-white text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> 완료
                    </div>
                  )}
                  <SurveyCard
                    survey={s}
                    responseCount={isAdmin ? (responseCounts[s.id] ?? 0) : undefined}
                    isAdmin={isAdmin}
                    alreadyResponded={!isAdmin && respondedIds.has(s.id)}
                    onDeleted={handleSurveyDeleted}
                    onResponded={handleSurveyResponded}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── 과제 생성 모달 ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>새 글쓰기 과제 추가</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">과제명</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="과제 제목을 입력하세요" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">설명 <span className="text-gray-400 font-normal">(선택)</span></Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="과제 내용, 제출 방법 등을 설명해주세요" className="resize-none min-h-[80px] text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">마감일 <span className="text-gray-400 font-normal">(선택)</span></Label>
              <Input type="datetime-local" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} className="text-sm" />
            </div>
            {createError && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{createError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
              <Button type="submit" disabled={creating || !newTitle.trim()}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : '추가'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 설문 생성 모달 ── */}
      <CreateSurveyModal
        cohortId={cohortId}
        open={surveyModalOpen}
        onClose={() => setSurveyModalOpen(false)}
        onCreated={(s) => {
          setSurveys((prev) => [...prev, s])
          setResponseCounts((prev) => ({ ...prev, [s.id]: 0 }))
          setSurveyModalOpen(false)
          setTab('survey')
        }}
      />

      {/* ── 학생 제출 모달 ── */}
      <Dialog open={!!submitTarget} onOpenChange={() => setSubmitTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <PenLine className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              {submitTarget?.title}
            </DialogTitle>
          </DialogHeader>

          {/* 과제 설명 (있는 경우) */}
          {submitTarget?.description && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 -mt-1">
              <p className="text-xs font-semibold text-indigo-500 mb-1">과제 안내</p>
              <p className="text-sm text-indigo-900 whitespace-pre-wrap leading-relaxed">{submitTarget.description}</p>
            </div>
          )}

          {/* 마감일 */}
          {submitTarget && (() => {
            const dl = formatDeadline(submitTarget.deadline)
            return dl ? (
              <p className={cn('text-xs flex items-center gap-1 -mt-1', dl.color)}>
                <Calendar className="w-3.5 h-3.5" />
                마감: {dl.str} · <span className="font-medium">{dl.label}</span>
              </p>
            ) : null
          })()}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                제출 내용
                <span className="text-red-400 ml-1">*</span>
                <span className="text-xs text-gray-400 font-normal ml-1">(텍스트 또는 파일 중 하나 이상 필수)</span>
              </Label>
              <Textarea
                value={submitContent}
                onChange={(e) => setSubmitContent(e.target.value)}
                placeholder={`여기에 과제 내용을 작성하거나, 아래에 파일을 첨부하세요.\n\n예) 구글 문서 링크, 내용 요약, 소감 등`}
                className="resize-none min-h-[140px] text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">파일 첨부 <span className="text-gray-400 font-normal">(최대 5개)</span></Label>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={submitFiles.length >= 5}
                  className="text-xs text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5" /> 파일 선택
                </button>
              </div>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              {submitFiles.length === 0 ? (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full h-12 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors flex items-center justify-center gap-2">
                  <Paperclip className="w-4 h-4" /> 클릭해서 파일 첨부 (이미지, PDF, 문서 등)
                </button>
              ) : (
                <div className="space-y-1.5">
                  {submitFiles.map((fp, i) => {
                    const Icon = getFileIcon(fp.file.type)
                    return (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                        {fp.objectUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={fp.objectUrl} alt="" className="w-8 h-8 object-cover rounded flex-shrink-0" />
                          : <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        }
                        <span className="text-sm text-gray-700 truncate flex-1">{fp.file.name}</span>
                        <span className="text-xs text-gray-400">{formatBytes(fp.file.size)}</span>
                        <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {submitError && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{submitError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setSubmitTarget(null)}>취소</Button>
              <Button
                type="submit"
                disabled={submitting || (!submitContent.trim() && submitFiles.length === 0)}
                className="gap-1.5"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />제출 중...</>
                  : <><CheckCircle2 className="w-4 h-4" />제출하기</>
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 내 제출 확인 모달 ── */}
      <Dialog open={!!myViewTarget} onOpenChange={() => setMyViewTarget(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{myViewTarget?.title} — 내 제출</DialogTitle></DialogHeader>
          {myViewTarget?.my_submission && (
            <div className="space-y-4 mt-2">
              <div className="text-sm text-gray-500">
                제출일: {new Date(myViewTarget.my_submission.submitted_at).toLocaleString('ko-KR')}
              </div>
              {myViewTarget.my_submission.content && (
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                  {myViewTarget.my_submission.content}
                </div>
              )}
              {(myViewTarget.my_submission.attachments ?? []).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500">첨부파일</p>
                  {myViewTarget.my_submission.attachments!.map((att) => {
                    const Icon = getFileIcon(att.file_type)
                    return (
                      <a key={att.id} href={att.public_url ?? att.storage_path} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
                        <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700 flex-1 truncate">{att.file_name ?? '파일'}</span>
                        {att.file_size && <span className="text-xs text-gray-400">{formatBytes(att.file_size)}</span>}
                      </a>
                    )
                  })}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => { setMyViewTarget(null); openSubmit(myViewTarget!) }}>
                수정하기
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 관리자 제출 현황 모달 ── */}
      <Dialog open={!!viewTarget} onOpenChange={() => { setViewTarget(null); setViewSubs([]) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>{viewTarget?.title} — 제출 현황</DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              {loadingView ? '불러오는 중...' : `${viewSubs.length}명 제출`}
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loadingView ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : viewSubs.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">아직 제출한 멤버가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {viewSubs.map((sub) => (
                  <div key={sub.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                      onClick={() => setExpandedSub(expandedSub === sub.id ? null : sub.id)}
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {(sub.profile?.name ?? 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{sub.profile?.name ?? '알 수 없음'}</p>
                        <p className="text-xs text-gray-400">{new Date(sub.submitted_at).toLocaleString('ko-KR')}</p>
                      </div>
                      {(sub.attachments?.length ?? 0) > 0 && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />{sub.attachments!.length}
                        </span>
                      )}
                      {expandedSub === sub.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    {expandedSub === sub.id && (
                      <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
                        {sub.content && (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{sub.content}</p>
                        )}
                        {(sub.attachments ?? []).length > 0 && (
                          <div className="space-y-1.5">
                            {sub.attachments!.map((att) => {
                              const Icon = getFileIcon(att.file_type)
                              return (
                                <a key={att.id} href={att.public_url ?? att.storage_path} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors">
                                  <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                  <span className="text-sm text-gray-700 flex-1 truncate">{att.file_name ?? '파일'}</span>
                                  {att.file_size && <span className="text-xs text-gray-400">{formatBytes(att.file_size)}</span>}
                                </a>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
