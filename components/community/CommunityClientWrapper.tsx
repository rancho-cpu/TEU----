'use client'

import { useState } from 'react'
import type { Post } from '@/types'
import { PostCard } from './PostCard'
import { CreatePostModal } from './CreatePostModal'
import { Button } from '@/components/ui/button'
import { PenLine } from 'lucide-react'

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

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev])
  }

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">커뮤니티</h1>
          <p className="text-sm text-gray-500 mt-1">
            {posts.length}개의 게시글
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2"
        >
          <PenLine className="w-4 h-4" />
          글쓰기
        </Button>
      </div>

      {/* Posts List */}
      {posts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <PenLine className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">아직 게시글이 없습니다</p>
          <p className="text-sm mt-1">첫 번째 글을 작성해보세요!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isAdmin={isAdmin}
              cohortId={cohortId}
              currentUserId={currentUserId}
              onDeleted={handlePostDeleted}
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
