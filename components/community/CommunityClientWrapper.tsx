'use client'

import { useState } from 'react'
import type { Post } from '@/types'
import { PostCard } from './PostCard'
import { CreatePostModal } from './CreatePostModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PenLine, Search } from 'lucide-react'

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
  isAdmin: boolean
  currentUserId: string
}

export function CommunityClientWrapper({
  cohortId,
  initialPosts,
  isAdmin,
  currentUserId,
}: CommunityClientWrapperProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category>('전체')
  const [searchQuery, setSearchQuery] = useState('')

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

  // 카테고리 + 검색 필터
  const filtered = posts.filter((p) => {
    const matchCategory = selectedCategory === '전체' || p.category === selectedCategory
    const q = searchQuery.trim().toLowerCase()
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
    return matchCategory && matchSearch
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">커뮤니티</h1>
          <p className="text-sm text-gray-500 mt-1">{posts.length}개의 게시글</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
          <PenLine className="w-4 h-4" />
          글쓰기
        </Button>
      </div>

      {/* 검색 + 카테고리 필터 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* 검색 */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="제목 또는 내용 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        {/* 카테고리 버튼 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat
            const baseStyle = cat === '전체'
              ? (isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
              : (isActive ? CATEGORY_ACTIVE[cat] : CATEGORY_STYLES[cat])
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
              onDeleted={handlePostDeleted}
              onLikeToggled={handleLikeToggled}
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
