'use client'

import { useState } from 'react'
import type { Post, Comment } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  MessageCircle,
  Trash2,
  Send,
  Calendar,
  ChevronRight,
} from 'lucide-react'

interface PostCardProps {
  post: Post
  isAdmin: boolean
  cohortId: string
  currentUserId: string
  onDeleted: (postId: string) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  일반: '일반',
  공지: '공지',
  질문: '질문',
  자료: '자료',
}

const CATEGORY_COLORS: Record<string, string> = {
  일반: 'bg-gray-100 text-gray-700',
  공지: 'bg-blue-100 text-blue-700',
  질문: 'bg-amber-100 text-amber-700',
  자료: 'bg-green-100 text-green-700',
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}

export function PostCard({
  post,
  isAdmin,
  cohortId,
  currentUserId,
  onDeleted,
}: PostCardProps) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [deletingPost, setDeletingPost] = useState(false)
  const supabase = createClient()

  const canDelete = isAdmin || post.user_id === currentUserId

  const handleOpenDialog = async () => {
    setOpen(true)
    setLoadingComments(true)
    const { data } = await supabase
      .from('comments')
      .select('*, profile:profiles(*)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setComments((data as Comment[]) ?? [])
    setLoadingComments(false)
  }

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return
    setSubmittingComment(true)

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: post.id,
        user_id: currentUserId,
        content: commentText.trim(),
      })
      .select('*, profile:profiles(*)')
      .single()

    if (!error && data) {
      setComments((prev) => [...prev, data as Comment])
      setCommentText('')
    }
    setSubmittingComment(false)
  }

  const handleDeletePost = async () => {
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return
    setDeletingPost(true)

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', post.id)

    if (!error) {
      setOpen(false)
      onDeleted(post.id)
    }
    setDeletingPost(false)
  }

  return (
    <>
      {/* Card */}
      <div
        className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group"
        onClick={handleOpenDialog}
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar className="w-9 h-9 flex-shrink-0">
            <AvatarImage src={post.profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-medium">
              {getInitials(post.profile?.name ?? null)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            {/* Meta */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-800">
                {post.profile?.name ?? '알 수 없음'}
              </span>
              <span className="text-xs text-gray-400">{formatDate(post.created_at)}</span>
              <span
                className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                  CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {CATEGORY_LABELS[post.category] ?? post.category}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
              {post.title}
            </h3>

            {/* Content Preview */}
            <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">
              {post.content}
            </p>

            {/* Footer */}
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MessageCircle className="w-3.5 h-3.5" />
                댓글 {post.comment_count ?? 0}
              </span>
              <span className="ml-auto flex items-center gap-1 text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                자세히 보기
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {CATEGORY_LABELS[post.category] ?? post.category}
                </span>
              </div>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 -mt-1 flex-shrink-0"
                  onClick={handleDeletePost}
                  disabled={deletingPost}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  삭제
                </Button>
              )}
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900 mt-2 text-left">
              {post.title}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-2">
              <Avatar className="w-7 h-7">
                <AvatarImage src={post.profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                  {getInitials(post.profile?.name ?? null)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-gray-700">
                {post.profile?.name ?? '알 수 없음'}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatTime(post.created_at)}
              </span>
            </div>
          </DialogHeader>

          <Separator />

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Post Content */}
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {post.content}
            </div>

            <Separator />

            {/* Comments */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                댓글 {comments.length}개
              </h4>

              {loadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  첫 번째 댓글을 작성해보세요.
                </p>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="w-7 h-7 flex-shrink-0">
                        <AvatarImage src={comment.profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                          {getInitials(comment.profile?.name ?? null)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-800">
                            {comment.profile?.name ?? '알 수 없음'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatTime(comment.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Comment Input */}
          <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl">
            <div className="flex gap-2">
              <Textarea
                placeholder="댓글을 작성하세요..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 min-h-[60px] max-h-[120px] resize-none text-sm bg-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSubmitComment()
                  }
                }}
              />
              <Button
                onClick={handleSubmitComment}
                disabled={submittingComment || !commentText.trim()}
                size="sm"
                className="self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Ctrl+Enter로 전송</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
