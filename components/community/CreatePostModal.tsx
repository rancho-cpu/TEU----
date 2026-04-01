'use client'

import { useState } from 'react'
import type { Post } from '@/types'
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
import { Textarea } from '@/components/ui/textarea'

interface CreatePostModalProps {
  cohortId: string
  open: boolean
  onClose: () => void
  onCreated: (post: Post) => void
}

const CATEGORIES = [
  { value: '일반', label: '일반', color: 'bg-gray-100 text-gray-700' },
  { value: '공지', label: '공지', color: 'bg-blue-100 text-blue-700' },
  { value: '질문', label: '질문', color: 'bg-amber-100 text-amber-700' },
  { value: '자료', label: '자료', color: 'bg-green-100 text-green-700' },
]

export function CreatePostModal({
  cohortId,
  open,
  onClose,
  onCreated,
}: CreatePostModalProps) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('일반')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleClose = () => {
    setTitle('')
    setCategory('일반')
    setContent('')
    setError(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 모두 입력해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('로그인이 필요합니다.')
      setLoading(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('posts')
      .insert({
        cohort_id: cohortId,
        user_id: user.id,
        title: title.trim(),
        category,
        content: content.trim(),
      })
      .select('*, profile:profiles(*)')
      .single()

    if (insertError) {
      setError('게시글 작성 중 오류가 발생했습니다.')
      setLoading(false)
      return
    }

    onCreated({ ...(data as Post), comment_count: 0 })
    handleClose()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
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
            <Label htmlFor="post-title" className="text-sm font-medium text-gray-700">
              제목
            </Label>
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
            <Label htmlFor="post-content" className="text-sm font-medium text-gray-700">
              내용
            </Label>
            <Textarea
              id="post-content"
              placeholder="내용을 자유롭게 작성하세요..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[160px] resize-none text-sm leading-relaxed"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={handleClose}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  게시 중...
                </span>
              ) : (
                '게시하기'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
