'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Users } from 'lucide-react'
import type { Challenge } from '@/types'
import { ChallengeCard } from './ChallengeCard'
import { CreateChallengeModal } from './CreateChallengeModal'

interface ChallengesClientWrapperProps {
  cohortId: string
  challenges: Challenge[]
  isAdmin: boolean
  totalParticipants: number
}

export function ChallengesClientWrapper({
  cohortId,
  challenges,
  isAdmin,
  totalParticipants,
}: ChallengesClientWrapperProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [localChallenges, setLocalChallenges] = useState<Challenge[]>(challenges)

  const handleCreated = (newChallenge: Challenge) => {
    setLocalChallenges((prev) => [{ ...newChallenge, submission_count: 0, user_submitted: false }, ...prev])
  }

  const handleDeleted = (id: string) => {
    setLocalChallenges((prev) => prev.filter((c) => c.id !== id))
  }

  const handleUpdated = (updated: Challenge) => {
    setLocalChallenges((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">챌린지 구경하기</h1>
          <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-0 gap-1.5 px-2.5 py-1 text-xs font-medium">
            <Users className="w-3.5 h-3.5" />
            {totalParticipants}명 참가
          </Badge>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            챌린지 추가
          </Button>
        )}
      </div>

      {/* Challenge list */}
      {localChallenges.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <p className="text-4xl mb-4">🔥</p>
          <p className="text-sm font-medium">아직 진행 중인 챌린지가 없습니다.</p>
          {isAdmin && (
            <p className="text-xs mt-1">위의 버튼으로 첫 챌린지를 만들어보세요!</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {localChallenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              isAdmin={isAdmin}
              cohortId={cohortId}
              onDeleted={handleDeleted}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateChallengeModal
        cohortId={cohortId}
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}
