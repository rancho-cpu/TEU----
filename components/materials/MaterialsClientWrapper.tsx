'use client'

import { useState, useRef } from 'react'
import type { Material, MaterialAttachment } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  BookMarked, Plus, Trash2, Download, Paperclip, X,
  FileText, FileImage, FileVideo, File, Loader2, Calendar, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  cohortId: string
  initialMaterials: Material[]
  isAdmin: boolean
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
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

interface FilePreview { file: File; objectUrl: string | null }

export function MaterialsClientWrapper({ cohortId, initialMaterials, isAdmin }: Props) {
  const supabase = createClient()
  const [materials, setMaterials] = useState<Material[]>(initialMaterials)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewing, setViewing] = useState<Material | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // 작성 폼
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<FilePreview[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setTitle(''); setContent('')
    files.forEach((f) => { if (f.objectUrl) URL.revokeObjectURL(f.objectUrl) })
    setFiles([]); setFormError(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    const previews: FilePreview[] = selected.map((f) => ({
      file: f,
      objectUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }))
    setFiles((prev) => [...prev, ...previews].slice(0, 10))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setFormError('제목을 입력해주세요.'); return }
    setSaving(true); setFormError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setFormError('로그인이 필요합니다.'); setSaving(false); return }

    const { data, error } = await supabase
      .from('materials')
      .insert({ cohort_id: cohortId, user_id: user.id, title: title.trim(), content: content.trim() || null })
      .select('*')
      .single()

    if (error || !data) { setFormError(`저장 중 오류: ${error?.message ?? '알 수 없는 오류'}`); setSaving(false); return }

    const material = { ...data, profile: null } as Material
    const attachments: MaterialAttachment[] = []
    const { data: { publicUrl: baseUrl } } = supabase.storage.from('materials').getPublicUrl('')

    for (const fp of files) {
      const ext = fp.file.name.split('.').pop() ?? 'bin'
      const path = `${cohortId}/${material.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('materials').upload(path, fp.file)
      if (upErr) continue
      const { data: att } = await supabase
        .from('material_attachments')
        .insert({ material_id: material.id, storage_path: path, file_name: fp.file.name, file_type: fp.file.type, file_size: fp.file.size })
        .select().single()
      if (att) attachments.push({ ...(att as MaterialAttachment), public_url: `${baseUrl}${path}` })
    }

    setMaterials((prev) => [{ ...material, attachments }, ...prev])
    resetForm(); setModalOpen(false); setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 자료를 삭제하시겠습니까?')) return
    setDeleting(id)
    await supabase.from('materials').delete().eq('id', id)
    setMaterials((prev) => prev.filter((m) => m.id !== id))
    if (viewing?.id === id) setViewOpen(false)
    setDeleting(null)
  }

  const handleDownload = async (att: MaterialAttachment) => {
    const url = att.public_url ?? att.storage_path
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = att.file_name ?? 'download'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookMarked className="w-6 h-6 text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-900">강연 자료</h1>
          </div>
          <p className="text-sm text-gray-500">강의에서 사용된 자료들을 확인하세요.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setModalOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> 자료 등록
          </Button>
        )}
      </div>

      {/* 검색 */}
      {materials.length > 0 && (
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="제목 또는 내용으로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      )}

      {/* 자료 목록 */}
      {(() => {
        const filtered = search
          ? materials.filter((m) => {
              const q = search.toLowerCase()
              return m.title.toLowerCase().includes(q) || m.content?.toLowerCase().includes(q)
            })
          : materials
        return filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-20 text-center text-gray-400">
          <BookMarked className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-gray-500">
            {search ? '검색 결과가 없습니다.' : '등록된 자료가 없습니다.'}
          </p>
          {isAdmin && !search && <p className="text-sm mt-1">위의 "자료 등록" 버튼으로 추가하세요.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
              onClick={() => { setViewing(m); setViewOpen(true) }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                    {m.title}
                  </h3>
                  {m.content && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">{m.content}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />{formatDate(m.created_at)}
                    </span>
                    {m.attachments && m.attachments.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Paperclip className="w-3 h-3" />{m.attachments.length}개 파일
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost" size="sm"
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleDelete(m.id) }}
                    disabled={deleting === m.id}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* 첨부 미리보기 */}
              {m.attachments && m.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {m.attachments.slice(0, 4).map((att) => {
                    const Icon = getFileIcon(att.file_type)
                    return (
                      <button
                        key={att.id}
                        onClick={() => handleDownload(att)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded-full text-xs text-gray-600 transition-colors"
                      >
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate max-w-[120px]">{att.file_name ?? '파일'}</span>
                        {att.file_size && <span className="text-gray-400">{formatBytes(att.file_size)}</span>}
                        <Download className="w-3 h-3 flex-shrink-0" />
                      </button>
                    )
                  })}
                  {m.attachments.length > 4 && (
                    <span className="flex items-center px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-500">
                      +{m.attachments.length - 4}개
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )
      })()}

      {/* 자료 상세 다이얼로그 */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        {viewing && (
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <DialogTitle className="text-lg font-bold text-gray-900 text-left flex-1">{viewing.title}</DialogTitle>
                {isAdmin && (
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 flex-shrink-0"
                    onClick={() => handleDelete(viewing.id)} disabled={deleting === viewing.id}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                <Calendar className="w-3 h-3" />{formatDate(viewing.created_at)}
              </p>
            </DialogHeader>
            <Separator />
            <div className="flex-1 overflow-y-auto space-y-4 py-2">
              {viewing.content && (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{viewing.content}</p>
              )}
              {viewing.attachments && viewing.attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" />첨부파일 {viewing.attachments.length}개
                  </p>
                  {viewing.attachments.map((att) => {
                    const Icon = getFileIcon(att.file_type)
                    return (
                      <button key={att.id} onClick={() => handleDownload(att)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors text-left">
                        <Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700 flex-1 truncate">{att.file_name ?? '파일'}</span>
                        {att.file_size && <span className="text-xs text-gray-400">{formatBytes(att.file_size)}</span>}
                        <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* 자료 등록 모달 */}
      <Dialog open={modalOpen} onOpenChange={(v) => { if (!v) resetForm(); setModalOpen(v) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-blue-500" />자료 등록
            </DialogTitle>
          </DialogHeader>
          <Separator />
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">제목</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="자료 제목을 입력하세요" maxLength={100} className="text-sm" autoFocus />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">내용 <span className="text-gray-400 font-normal">(선택)</span></Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="자료에 대한 설명을 입력하세요..." className="min-h-[100px] resize-none text-sm" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700">파일 첨부 <span className="text-gray-400 font-normal">(최대 10개)</span></Label>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={files.length >= 10}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed">
                  <Paperclip className="w-3.5 h-3.5" />파일 선택
                </button>
              </div>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              {files.length === 0 ? (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full h-14 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors">
                  <Paperclip className="w-4 h-4" />클릭해서 파일 첨부 (PDF, 문서, 이미지 등)
                </button>
              ) : (
                <div className="space-y-2">
                  {files.map((fp, i) => {
                    const Icon = getFileIcon(fp.file.type)
                    return (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                        <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate flex-1">{fp.file.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(fp.file.size)}</span>
                        <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                  {files.length < 10 && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />파일 추가
                    </button>
                  )}
                </div>
              )}
            </div>
            {formError && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => { resetForm(); setModalOpen(false) }}>취소</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />업로드 중...</span> : '등록하기'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
