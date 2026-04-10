'use client'

import { useState } from 'react'
import type { Post } from '@/types'
import { PostCard } from './PostCard'
import { CreatePostModal } from './CreatePostModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PenLine, Search, Pin, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORIES = ['전체', '공지', '소개', '출결', '자유', '질문', '자료'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_INACTIVE: Record<string, string> = {
  전체:  'bg-gray-100 text-gray-700 hover:bg-gray-200',
  공지:  'bg-blue-100 text-blue-700 hover:bg-blue-200',
  소개:  'bg-purple-100 text-purple-700 hover:bg-purple-200',
  출결:  'bg-rose-100 text-rose-700 hover:bg-rose-200',
  자유:  'bg-gray-100 text-gray-700 hover:bg-gray-200',
  질문:  'bg-amber-100 text-amber-700 hover:bg-amber-200',
  자료:  'bg-green-100 text-green-700 hover:bg-green-200',
}

const CATEGORY_ACTIVE: Record<string, string> = {
  전체:  'bg-gray-900 text-white',
  공지:  'bg-blue-600 text-white',
  소개:  'bg-purple-600 text-white',
  출결:  'bg-rose-500 text-white',
  자유:  'bg-gray-700 text-white',
  질문:  'bg-amber-500 text-white',
  자료:  'bg-green-600 text-white',
}

interface Member {
  id: string
  name: string
  email: string
}

interface CommunityClientWrapperProps {
  cohortId: string
  initialPosts: Post[]
  isAdmin: boolean
  currentUserId: string
  members?: Member[]
}

export function CommunityClientWrapper({
  cohortId,
  initialPosts,
  isAdmin,
  currentUserId,
  members = [],
}: CommunityClientWrapperProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category>('전체')
  const [searchQuery, setSearchQuery] = useState('')
  const [myPostsOnly, setMyPostsOnly] = useState(false)
  const [selectedMember, setSelectedMember] = useState<string>('') // admin: filter by user_id

  const handlePostCreated = (newPost: Post) => setPosts((prev) => [newPost, ...prev])
  const handlePostDeleted = (postId: string) => setPosts((prev) => prev.filter((p) => p.id !== postId))
  const handlePostUpdated = (postId: string, updates: Partial<Post>) =>
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...updates } : p)))

  const handleLikeToggled = (postId: string, liked: boolean, newCount: number) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, user_liked: liked, likes_count: newCount } : p))
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

  const pinnedPosts = posts.filter((p) => p.is_pinned)

  const filtered = posts.filter((p) => {
    if (p.is_pinned) return false
    const matchCategory = selectedCategory === '전체' || p.category === selectedCategory
    const q = searchQuery.trim().toLowerCase()
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
    const matchMine = !myPostsOnly || p.user_id === currentUserId
    const matchMember = !selectedMember || p.user_id === selectedMember
    return matchCategory && matchSearch && matchMine && matchMember
  })

  // 멤버별 글 수 (관리자용)
  const postCountByMember = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.id] = posts.filter((p) => p.user_id === m.id).length
    return acc
  }, {})

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">커뮤니티</h1>
          <p className="text-sm text-gray-500 mt-1">전체 {posts.length}개의 게시글</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
          <PenLine className="w-4 h-4" />
          글쓰기
        </Button>
      </div>

      {/* 관리자 멤버별 필터 */}
      {isAdmin && members.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            멤버별 글 확인
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedMember('')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                !selectedMember
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
              )}
            >
              전체 멤버
            </button>
            {members.map((m) => {
              const count = postCountByMember[m.id] ?? 0
              const isSelected = selectedMember === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMember(isSelected ? '' : m.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1',
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : count === 0
                      ? 'bg-white border border-gray-200 text-gray-400 hover:border-indigo-300'
                      : 'bg-white border border-gray-200 text-gray-700 hover:border-indigo-300'
                  )}
                >
                  {m.name || m.email}
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold',
                      isSelected ? 'bg-white/30 text-white' : count === 0 ? 'bg-gray-100 text-gray-400' : 'bg-indigo-100 text-indigo-700'
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Search + Category filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                selectedCategory === cat ? CATEGORY_ACTIVE[cat] : CATEGORY_INACTIVE[cat]
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 내 글 필터 (일반 유저) */}
      {!isAdmin && (
        <div className="mb-5">
          <button
            onClick={() => setMyPostsOnly((v) => !v)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5',
              myPostsOnly
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <User className="w-3 h-3" />
            내 글만 보기
            {myPostsOnly && (
              <span className="ml-0.5">({posts.filter((p) => p.user_id === currentUserId).length})</span>
            )}
          </button>
        </div>
      )}

      {/* 고정글 섹션 */}
      {pinnedPosts.length > 0 && !myPostsOnly && !selectedMember && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Pin className="w-3.5 h-3.5 text-red-500" />
            고정글
          </h3>
          <div className="space-y-2">
            {pinnedPosts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                isAdmin={isAdmin}
                cohortId={cohortId}
                currentUserId={currentUserId}
                onDeleted={handlePostDeleted}
                onLikeToggled={handleLikeToggled}
                onReactionToggled={handleReactionToggled}
                onUpdated={handlePostUpdated}
              />
            ))}
          </div>
        </div>
      )}

      {/* Posts */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <PenLine className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">
            {searchQuery || selectedCategory !== '전체' || myPostsOnly || selectedMember
              ? '게시글이 없습니다.'
              : '아직 게시글이 없습니다'}
          </p>
          {!searchQuery && selectedCategory === '전체' && !myPostsOnly && !selectedMember && (
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
              onDeleted={handlePostDeleted}
              onLikeToggled={handleLikeToggled}
              onReactionToggled={handleReactionToggled}
              onUpdated={handlePostUpdated}
            />
          ))}
        </div>
      )}

      <CreatePostModal
        cohortId={cohortId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handlePostCreated}
      />
    </div>
  )
}
