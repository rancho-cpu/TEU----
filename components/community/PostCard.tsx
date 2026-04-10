'use client'

import { useState } from 'react'
import type { Post, Comment } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MessageCircle, Trash2, Send, Calendar, ChevronRight,
  Heart, Star, HandMetal, Pin, PinOff, MoreHorizontal,
  File, FileText, FileImage, FileVideo, Paperclip,
} from 'lucide-react'

interface PostCardProps {
  post: Post
  isAdmin: boolean
  cohortId: string
  currentUserId: string
  onDeleted: (postId: string) => void
  onLikeToggled?: (postId: string, liked: boolean, newCount: number) => void
  onReactionToggled?: (
    postId: string,
    type: 'star' | 'clap',
    active: boolean,
    newCount: number
  ) => void
  onUpdated?: (postId: string, updates: Partial<Post>) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  공지: 'bg-blue-100 text-blue-700',
  소개: 'bg-purple-100 text-purple-700',
  출결: 'bg-rose-100 text-rose-700',
  자유: 'bg-gray-100 text-gray-700',
  일반: 'bg-gray-100 text-gray-700',
  질문: 'bg-amber-100 text-amber-700',
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

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleString('ko-KR', {
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
  onLikeToggled,
  onReactionToggled,
  onUpdated,
}: PostCardProps) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [deletingPost, setDeletingPost] = useState(false)

  const [liked, setLiked] = useState(post.user_liked ?? false)
  const [likeCount, setLikeCount] = useState(post.likes_count ?? 0)
  const [likePending, setLikePending] = useState(false)

  const [starred, setStarred] = useState(post.user_starred ?? false)
  const [starCount, setStarCount] = useState(post.star_count ?? 0)
  const [clapped, setClapped] = useState(post.user_clapped ?? false)
  const [clapCount, setClapCount] = useState(post.clap_count ?? 0)
  const [reactionPending, setReactionPending] = useState<'star' | 'clap' | null>(null)

  const supabase = createClient()
  const canDelete = isAdmin || post.user_id === currentUserId

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const newPinned = !post.is_pinned
    const { error } = await supabase
      .from('posts')
      .update({ is_pinned: newPinned })
      .eq('id', post.id)
    if (!error) onUpdated?.(post.id, { is_pinned: newPinned })
  }

  // ── Dialog ──────────────────────────────────────────────────
  const handleOpenDialog = async () => {
    setOpen(true)
    setLoadingComments(true)
    const { data } = await supabase
      .from('comments')
      .select('*, profile:profiles!user_id(*)')
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
      .insert({ post_id: post.id, user_id: currentUserId, content: commentText.trim() })
      .select('*, profile:profiles!user_id(*)')
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
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (!error) {
      setOpen(false)
      onDeleted(post.id)
    }
    setDeletingPost(false)
  }

  // ── Like ────────────────────────────────────────────────────
  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (likePending) return
    setLikePending(true)
    const newLiked = !liked
    const newCount = newLiked ? likeCount + 1 : likeCount - 1
    setLiked(newLiked)
    setLikeCount(newCount)
    if (newLiked) {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUserId })
    } else {
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', currentUserId)
    }
    onLikeToggled?.(post.id, newLiked, newCount)
    setLikePending(false)
  }

  // ── Reactions ────────────────────────────────────────────────
  const handleReaction = async (e: React.MouseEvent, type: 'star' | 'clap') => {
    e.stopPropagation()
    if (reactionPending) return
    setReactionPending(type)

    const isActive = type === 'star' ? starred : clapped
    const currentCount = type === 'star' ? starCount : clapCount
    const newActive = !isActive
    const newCount = newActive ? currentCount + 1 : currentCount - 1

    if (type === 'star') { setStarred(newActive); setStarCount(newCount) }
    else { setClapped(newActive); setClapCount(newCount) }

    if (newActive) {
      await supabase
        .from('post_reactions')
        .insert({ post_id: post.id, user_id: currentUserId, type })
    } else {
      await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', currentUserId)
        .eq('type', type)
    }

    onReactionToggled?.(post.id, type, newActive, newCount)
    setReactionPending(null)
  }

  return (
    <>
      {/* Card */}
      <div
        className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group"
        onClick={handleOpenDialog}
      >
        <div className="flex items-start gap-4">
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
              {post.is_pinned && (
                <span className="flex items-center gap-0.5 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-medium">
                  <Pin className="w-2.5 h-2.5" />고정
                </span>
              )}
              <span
                className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                  CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {post.category}
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

            {/* 첨부 파일 미리보기 */}
            {post.attachments && post.attachments.length > 0 && (
              <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                {/* 이미지 썸네일 (최대 3장) */}
                {(() => {
                  const imgs = post.attachments!.filter((a) => a.file_type?.startsWith('image/') ?? false)
                  if (imgs.length === 0) return null
                  return (
                    <div className="flex gap-2">
                      {imgs.slice(0, 3).map((att, idx) => (
                        <div key={att.id} className="relative rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 w-[72px] h-[72px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={att.public_url ?? att.storage_path} alt="" className="w-full h-full object-cover" loading="lazy" />
                          {idx === 2 && imgs.length > 3 && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <span className="text-white text-sm font-semibold">+{imgs.length - 3}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}
                {/* 일반 파일 칩 */}
                {(() => {
                  const others = post.attachments!.filter((a) => !(a.file_type?.startsWith('image/') ?? false))
                  if (others.length === 0) return null
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {others.slice(0, 3).map((att) => {
                        const Icon = getFileIcon(att.file_type)
                        return (
                          <a
                            key={att.id}
                            href={att.public_url ?? att.storage_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-600 transition-colors max-w-[180px]"
                          >
                            <Icon className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                            <span className="truncate">{att.file_name ?? '파일'}</span>
                            {att.file_size && <span className="text-gray-400 flex-shrink-0">{formatBytes(att.file_size)}</span>}
                          </a>
                        )
                      })}
                      {others.length > 3 && (
                        <span className="flex items-center px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-500">
                          <Paperclip className="w-3 h-3 mr-1" />+{others.length - 3}
                        </span>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-3 mt-3">
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MessageCircle className="w-3.5 h-3.5" />
                {post.comment_count ?? 0}
              </span>

              <button
                onClick={handleLikeToggle}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-red-500' : ''}`} />
                {likeCount > 0 && likeCount}
              </button>

              <button
                onClick={(e) => handleReaction(e, 'star')}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  starred ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-400'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${starred ? 'fill-yellow-500' : ''}`} />
                {starCount > 0 && starCount}
              </button>

              <button
                onClick={(e) => handleReaction(e, 'clap')}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  clapped ? 'text-indigo-500' : 'text-gray-400 hover:text-indigo-400'
                }`}
              >
                <HandMetal className={`w-3.5 h-3.5 ${clapped ? 'fill-indigo-500' : ''}`} />
                {clapCount > 0 && clapCount}
              </button>

              {isAdmin ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="ml-auto flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={handleTogglePin} className="gap-2 text-sm cursor-pointer">
                      {post.is_pinned
                        ? <><PinOff className="w-3.5 h-3.5" /> 고정 해제</>
                        : <><Pin className="w-3.5 h-3.5" /> 상단 고정</>}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); handleDeletePost() }}
                      className="gap-2 text-sm text-red-500 focus:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="ml-auto flex items-center gap-1 text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  자세히 보기
                  <ChevronRight className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between gap-3">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {post.category}
              </span>
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

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {post.content}
            </div>

            {/* 첨부 파일 전체 */}
            {post.attachments && post.attachments.length > 0 && (() => {
              const imgs = post.attachments.filter((a) => a.file_type?.startsWith('image/') ?? false)
              const others = post.attachments.filter((a) => !(a.file_type?.startsWith('image/') ?? false))
              return (
                <div className="space-y-3">
                  {imgs.length > 0 && (
                    <div className={`grid gap-2 ${imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {imgs.map((att) => (
                        <a key={att.id} href={att.public_url ?? att.storage_path} target="_blank" rel="noopener noreferrer"
                          className="rounded-xl overflow-hidden bg-gray-100 block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={att.public_url ?? att.storage_path} alt="" className="w-full object-cover max-h-72 hover:opacity-90 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  )}
                  {others.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-500 flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" />첨부파일</p>
                      {others.map((att) => {
                        const Icon = getFileIcon(att.file_type)
                        return (
                          <a key={att.id} href={att.public_url ?? att.storage_path} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
                            <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <span className="text-sm text-gray-700 flex-1 truncate">{att.file_name ?? '파일'}</span>
                            {att.file_size && <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(att.file_size)}</span>}
                          </a>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Reactions */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <button
                onClick={handleLikeToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  liked
                    ? 'border-red-200 bg-red-50 text-red-500'
                    : 'border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-400'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-red-500' : ''}`} />
                좋아요 {likeCount > 0 && likeCount}
              </button>
              <button
                onClick={(e) => handleReaction(e, 'star')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  starred
                    ? 'border-yellow-200 bg-yellow-50 text-yellow-600'
                    : 'border-gray-200 text-gray-500 hover:border-yellow-200 hover:text-yellow-500'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${starred ? 'fill-yellow-500' : ''}`} />
                관심있어요 {starCount > 0 && starCount}
              </button>
              <button
                onClick={(e) => handleReaction(e, 'clap')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  clapped
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                    : 'border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-indigo-500'
                }`}
              >
                <HandMetal className={`w-3.5 h-3.5 ${clapped ? 'fill-indigo-500' : ''}`} />
                짝짝 {clapCount > 0 && clapCount}
              </button>
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
                        <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
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
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitComment()
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
