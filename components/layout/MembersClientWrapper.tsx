'use client'

import { useState } from 'react'
import type { CohortMember, Profile } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Search, UserPlus, Shield, User, Users, UserMinus, Plus, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface MembersClientWrapperProps {
  cohortId: string
  members: CohortMember[]
  isAdmin: boolean
  currentUserId: string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getInitials(name: string | null | undefined) {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}

export function MembersClientWrapper({
  cohortId,
  members: initialMembers,
  isAdmin,
  currentUserId,
}: MembersClientWrapperProps) {
  const [members, setMembers] = useState<CohortMember[]>(initialMembers)
  const [search, setSearch] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [notYetAdded, setNotYetAdded] = useState<Profile[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [candidateSearch, setCandidateSearch] = useState('')

  const supabase = createClient()

  const filtered = members.filter((m) => {
    const q = search.toLowerCase()
    return (
      m.profile?.name?.toLowerCase().includes(q) ||
      m.profile?.email?.toLowerCase().includes(q)
    )
  })

  // ── 멤버 초대 다이얼로그 열기 ───────────────────────────
  const openInvite = async () => {
    setInviteOpen(true)
    setLoadingCandidates(true)
    setCandidateSearch('')
    try {
      const res = await fetch(`/api/members?cohortId=${cohortId}`)
      const data = await res.json()
      setNotYetAdded(data.profiles ?? [])
    } catch {
      setNotYetAdded([])
    } finally {
      setLoadingCandidates(false)
    }
  }

  // ── 멤버 추가 ───────────────────────────────────────────
  const handleAdd = async (profile: Profile) => {
    setAddingId(profile.id)
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohortId, userId: profile.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const m = data.member
      setMembers((prev) => [
        ...prev,
        { user_id: m.user_id, cohort_id: m.cohort_id, joined_at: m.joined_at, profile: m.profile as Profile },
      ])
      setNotYetAdded((prev) => prev.filter((p) => p.id !== profile.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : '추가 실패')
    } finally {
      setAddingId(null)
    }
  }

  // ── 멤버 제거 ───────────────────────────────────────────
  const handleRemove = async (member: CohortMember) => {
    if (!confirm(`${member.profile?.name ?? '이 멤버'}를 기수에서 제거하시겠습니까?`)) return
    setRemovingId(member.user_id)
    try {
      const res = await fetch('/api/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohortId, userId: member.user_id }),
      })
      if (!res.ok) throw new Error('제거 실패')
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id))
    } catch (e) {
      alert(e instanceof Error ? e.message : '제거 실패')
    } finally {
      setRemovingId(null)
    }
  }

  // ── 역할 변경 ───────────────────────────────────────────
  const handleToggleRole = async (member: CohortMember) => {
    if (!member.profile) return
    const newRole = member.profile.role === 'admin' ? 'student' : 'admin'
    if (!confirm(`${member.profile.name}님을 ${newRole === 'admin' ? '관리자' : '학생'}으로 변경하시겠습니까?`)) return
    setTogglingId(member.user_id)
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', member.user_id)
    if (!error) {
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === member.user_id && m.profile
            ? { ...m, profile: { ...m.profile, role: newRole } }
            : m
        )
      )
    }
    setTogglingId(null)
  }

  const filteredCandidates = notYetAdded.filter((p) => {
    const q = candidateSearch.toLowerCase()
    return p.name?.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-6 h-6 text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-900">멤버</h1>
          </div>
          <p className="text-sm text-gray-500">총 {members.length}명</p>
        </div>
        {isAdmin && (
          <Button onClick={openInvite} className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            멤버 추가
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="이름 또는 이메일로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div className="col-span-4">이름</div>
          <div className="col-span-4">이메일</div>
          <div className="col-span-2">역할</div>
          <div className="col-span-2">가입일</div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {search ? '검색 결과가 없습니다.' : '멤버가 없습니다.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((member) => (
              <div
                key={member.user_id}
                className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-gray-50 transition-colors"
              >
                <div className="col-span-4 flex items-center gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-medium">
                      {getInitials(member.profile?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-medium text-gray-900">
                    {member.profile?.name ?? '이름 없음'}
                    {member.user_id === currentUserId && (
                      <span className="ml-2 text-xs text-blue-500">(나)</span>
                    )}
                  </p>
                </div>

                <div className="col-span-4">
                  <p className="text-sm text-gray-500 truncate">{member.profile?.email ?? '-'}</p>
                </div>

                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`text-xs ${
                        member.profile?.role === 'admin'
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {member.profile?.role === 'admin' ? (
                        <span className="flex items-center gap-1"><Shield className="w-3 h-3" />관리자</span>
                      ) : (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />학생</span>
                      )}
                    </Badge>
                    {isAdmin && member.user_id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-gray-400 hover:text-gray-700"
                        onClick={() => handleToggleRole(member)}
                        disabled={togglingId === member.user_id}
                      >
                        {togglingId === member.user_id ? '...' : '변경'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="col-span-2 flex items-center justify-between">
                  <p className="text-xs text-gray-400">{formatDate(member.joined_at)}</p>
                  {isAdmin && member.user_id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-gray-300 hover:text-red-500"
                      onClick={() => handleRemove(member)}
                      disabled={removingId === member.user_id}
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 멤버 추가 Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-500" />
              멤버 추가
            </DialogTitle>
          </DialogHeader>
          <Separator />

          <div className="flex items-center gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="이름 또는 이메일 검색..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={openInvite}
              disabled={loadingCandidates}
            >
              <RefreshCw className={`w-4 h-4 ${loadingCandidates ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto mt-2 space-y-1 min-h-0">
            {loadingCandidates ? (
              <p className="py-8 text-center text-sm text-gray-400">불러오는 중...</p>
            ) : filteredCandidates.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                {candidateSearch ? '검색 결과 없음' : '추가할 수 있는 사용자가 없습니다.'}
              </p>
            ) : (
              filteredCandidates.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={profile.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                        {getInitials(profile.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{profile.name ?? '이름 없음'}</p>
                      <p className="text-xs text-gray-400">{profile.email}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 px-3 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => handleAdd(profile)}
                    disabled={addingId === profile.id}
                  >
                    <Plus className="w-3 h-3" />
                    {addingId === profile.id ? '추가 중...' : '추가'}
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t">
            <Button variant="outline" className="w-full" onClick={() => setInviteOpen(false)}>
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
