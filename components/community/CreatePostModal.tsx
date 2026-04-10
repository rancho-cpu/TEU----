'use client'

import { useState, useRef } from 'react'
import type { Post, PostAttachment } from '@/types'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImagePlus, X, Loader2 } from 'lucide-react'

interface CreatePostModalProps {
  cohortId: string
  open: boolean
  onClose: () => void
  onCreated: (post: Post) => void
}

const CATEGORIES = [
  { value: '공지', label: '공지', color: 'bg-blue-100 text-blue-700' },
  { value: '소개', label: '소개', color: 'bg-purple-100 text-purple-700' },
  { value: '출결', label: '출결', color: 'bg-rose-100 text-rose-700' },
  { value: '자유', label: '자유', color: 'bg-gray-100 text-gray-700' },
  { value: '질문', label: '질문', color: 'bg-amber-100 text-amber-700' },
  { value: '자료', label: '자료', color: 'bg-green-100 text-green-700' },
]

interface ImagePreview {
  file: File
  objectUrl: string
}

export function CreatePostModal({ cohortId, open, onClose, onCreated }: CreatePostModalProps) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('자유')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<ImagePreview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleClose = () => {
    setTitle('')
    setCategory('자유')
    setContent('')
    images.forEach((img) => URL.revokeObjectURL(img.objectUrl))
    setImages([])
    setError(null)
    onClose()
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
    const previews: ImagePreview[] = files.map((f) => ({ file: f, objectUrl: URL.createObjectURL(f) }))
    setImages((prev) => [...prev, ...previews].slice(0, 5)) // 최대 5장
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (idx: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].objectUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 모두 입력해주세요.')
      return
    }
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인이 필요합니다.'); setLoading(false); return }

    // 1. 게시글 insert
    const { data, error: insertError } = await supabase
      .from('posts')
      .insert({ cohort_id: cohortId, user_id: user.id, title: title.trim(), category, content: content.trim() })
      .select('*, profile:profiles!user_id(*)')
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    const post = data as Post

    // 2. 이미지 업로드 & attachments insert
    const attachments: PostAttachment[] = []
    const { data: { publicUrl: baseUrl } } = supabase.storage.from('post-attachments').getPublicUrl('')

    for (const img of images) {
      const ext = img.file.name.split('.').pop() ?? 'jpg'
      const path = `${cohortId}/${post.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('post-attachments').upload(path, img.file)
      if (upErr) continue
      const { data: att } = await supabase
        .from('post_attachments')
        .insert({ post_id: post.id, storage_path: path })
        .select()
        .single()
      if (att) attachments.push({ ...att, public_url: `${baseUrl}${att.storage_path}` })
    }

    onCreated({ ...post, comment_count: 0, likes_count: 0, star_count: 0, clap_count: 0, attachments })
    handleClose()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">새 게시글 작성</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Category */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">카테고리</Label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
                    category === cat.value
                      ? `${cat.color} border-current`
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="post-title" className="text-sm font-medium text-gray-700">제목</Label>
            <Input
              id="post-title"
              placeholder="게시글 제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="text-sm"
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="post-content" className="text-sm font-medium text-gray-700">내용</Label>
            <Textarea
              id="post-content"
              placeholder="내용을 자유롭게 작성하세요..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[140px] resize-none text-sm leading-relaxed"
            />
          </div>

          {/* Image attach */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">사진 첨부 (최대 5장)</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= 5}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                사진 추가
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />

            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.objectUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors flex-shrink-0"
                  >
                    <ImagePlus className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {images.length === 0 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                클릭해서 사진 첨부
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={handleClose}>취소</Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {images.length > 0 ? '업로드 중...' : '게시 중...'}
                </span>
              ) : '게시하기'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
