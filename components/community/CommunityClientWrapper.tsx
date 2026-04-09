'use client'

import { useState } from 'react'
import type { Post, Channel } from '@/types'
import { PostCard } from './PostCard'
import { CreatePostModal } from './CreatePostModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PenLine, Search, Hash, Plus, Pin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const CATEGORIES = ['전체', '일반', '공지', '질문', '자료'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_STYLES: Record<string, string> = {
  전체: 'bg-gray-900 text-white',
  일반: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  공지: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  질문: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  자료: 'bg-green-100 text-green-700 hover:bg-green-200',
}

const CATEGORY_ACTIVE: Record<string, string> = {
  일반: 'bg-gray-700 text-white',
  공지: 'bg-blue-600 text-white',
  질문: 'bg-amber-500 text-white',
  자료: 'bg-green-600 text-white',
}

interface CommunityClientWrapperProps {
  cohortId: string
  initialPosts: Post[]
  initialChannels: Channel[]
  isAdmin: boolean
  currentUserId: string
}

export function CommunityClientWrapper({
  cohortId,
  initialPosts,
  initialChannels,
  isAdmin,
  currentUserId,
}: CommunityClientWrapperProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [channels, setChannels] = useState<Channel[]>(initialChannels)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category>('전체')
  const [searchQuery, setSearchQuery] = useState('')
  const [createChannelOpen, setCreateChannelOpen] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [creatingChannel, setCreatingChannel] = useState(false)
  const supabase = createClient()

  // ── Post callbacks ──────────────────────────────────────────
  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev])
  }
  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }
  const handleLikeToggled = (postId: string, liked: boolean, newCount: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, user_liked: liked, likes_count: newCount } : p
      )
    )
  }
  const handleReactionToggled = (
    postId: string,
    type: 'star' | 'clap',
    active: boolean,
    newCount: number
  ) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              ...(type === 'star' ? { user_starred: active, star_count: newCount } : {}),
              ...(type === 'clap' ? { user_clapped: active, clap_count: newCount } : {}),
            }
          : p
      )
    )
  }
  const handlePostUpdated = (postId: string, updates: Partial<Post>) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...updates } : p)))
  }

  // ── Channel creation ────────────────────────────────────────
  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return
    setCreatingChannel(true)
    const { data, error } = await supabase
      .from('channels')
      .insert({
        cohort_id: cohortId,
        name: newChannelName.trim(),
        order_index: channels.length,
      })
      .select()
      .single()
    if (!error && data) {
      setChannels((prev) => [...prev, data as Channel])
    }
    setNewChannelName('')
    setCreatingChannel(false)
    setCreateChannelOpen(false)
  }

  // ── Filtering ───────────────────────────────────────────────
  const pinnedPosts = posts.filter((p) => p.is_pinned)
  const nonPinnedPosts = posts.filter((p) => !p.is_pinned)

  const filtered = nonPinnedPosts.filter((p) => {
    const matchChannel = !selectedChannelId || p.channel_id === selectedChannelId
    const matchCategory = selectedCategory === '전체' || p.category === selectedCategory
    const q = searchQuery.trim().toLowerCase()
    const matchSearch =
      !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
    return matchChannel && matchCategory && matchSearch
  })

  const selectedChannel = channels.find((c) => c.id === selectedChannelId)

  return (
    <div className="flex min-h-screen">
      {/* ── Left: Channel Panel ──────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 border-r border-gray-100 bg-white p-3 sticky top-0 h-screen overflow-y-auto">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
          채널
        </p>
        <div className="space-y-0.5">
          {/* 전체 */}
          <button
            onClick={() => setSelectedChannelId(null)}
            className={cn(
              'flex items-center gap-2 px-2 py-2 w-full rounded-lg text-sm text-left transition-colors',
              !selectedChannelId
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Hash className="w-3.5 h-3.5 flex-shrink-0" />
            전체
            <span className="ml-auto text-xs text-gray-400">{nonPinnedPosts.length}</span>
          </button>

          {/* Custom channels */}
          {channels.map((ch) => {
            const count = nonPinnedPosts.filter((p) => p.channel_id === ch.id).length
            return (
              <button
                key={ch.id}
                onClick={() => setSelectedChannelId(ch.id)}
                className={cn(
                  'flex items-center gap-2 px-2 py-2 w-full rounded-lg text-sm text-left transition-colors',
                  selectedChannelId === ch.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Hash className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate flex-1">{ch.name}</span>
                {count > 0 && (
                  <span className="text-xs text-gray-400 flex-shrink-0">{count}</span>
                )}
              </button>
            )
          })}

          {/* 채널 추가 (admin only) */}
          {isAdmin && (
            <button
              onClick={() => setCreateChannelOpen(true)}
              className="flex items-center gap-2 px-2 py-2 w-full rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              채널 추가
            </button>
          )}
        </div>
      </aside>

      {/* ── Right: Main Content ──────────────────────────────── */}
      <div className="flex-1 p-6">
        <div className="max-w-3xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedChannel ? `# ${selectedChannel.name}` : '커뮤니티'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {filtered.length}개의 게시글
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
              <PenLine className="w-4 h-4" />
              글쓰기
            </Button>
          </div>

          {/* Search + Category filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="제목 또는 내용 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat
                const baseStyle =
                  cat === '전체'
                    ? isActive
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : isActive
                    ? CATEGORY_ACTIVE[cat]
                    : CATEGORY_STYLES[cat]
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${baseStyle}`}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pinned posts */}
          {pinnedPosts.length > 0 && !selectedChannelId && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5 text-red-500" />
                고정글
              </h3>
              <div className="space-y-1.5">
                {pinnedPosts.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                      고정
                    </span>
                    <span className="text-sm text-gray-700 truncate">{p.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Posts List */}
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <PenLine className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">
                {searchQuery || selectedCategory !== '전체'
                  ? '검색 결과가 없습니다.'
                  : '아직 게시글이 없습니다'}
              </p>
              {!searchQuery && selectedCategory === '전체' && (
                <p className="text-sm mt-1">첫 번째 글을 작성해보세요!</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isAdmin={isAdmin}
                  cohortId={cohortId}
                  currentUserId={currentUserId}
                  channels={channels}
                  onDeleted={handlePostDeleted}
                  onLikeToggled={handleLikeToggled}
                  onReactionToggled={handleReactionToggled}
                  onUpdated={handlePostUpdated}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        cohortId={cohortId}
        channels={channels}
        defaultChannelId={selectedChannelId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handlePostCreated}
        isAdmin={isAdmin}
      />

      {/* Create Channel Dialog */}
      <Dialog open={createChannelOpen} onOpenChange={setCreateChannelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">채널 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">채널 이름</Label>
              <Input
                placeholder="예: 공지, 자유토론, Q&A"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateChannel()
                }}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateChannelOpen(false)}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleCreateChannel}
              disabled={creatingChannel || !newChannelName.trim()}
            >
              {creatingChannel ? '추가 중...' : '추가'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
