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
import { Search, UserPlus, Shield, User, Users, UserMinus, Plus, RefreshCw, UserCheck, Phone, Download, Tag, Link2, Mail, Calendar } from 'lucide-react'
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
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [notYetAdded, setNotYetAdded] = useState<Profile[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [candidateSearch, setCandidateSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [exporting, setExporting] = useState(false)

  // 멤버 프로필 모달
  const [profileMember, setProfileMember] = useState<CohortMember | null>(null)

  const supabase = createClient()

  const handleExport = async () => {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      const rows = members.map((m) => {
        const p = m.profile as (Profile & { phone?: string | null }) | undefined
        const base = {
          '이름': p?.name ?? '이름 없음',
          '이메일': p?.email ?? '',
          '역할': p?.role === 'admin' ? '관리자' : '수강생',
          '가입일': new Date(m.joined_at).toLocaleDateString('ko-KR'),
        }
        if (isAdmin) {
          return { ...{ '이름': base['이름'], '이메일': base['이메일'], '휴대폰': p?.phone ?? '' }, ...{ '역할': base['역할'], '가입일': base['가입일'] } }
        }
        return base
      })

      const ws = XLSX.utils.json_to_sheet(rows)
      if (isAdmin) {
        ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 14 }]
      } else {
        ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 14 }]
      }
      XLSX.utils.book_append_sheet(wb, ws, '구성원 목록')

      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `구성원_${date}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  const handleSyncProfiles = async () => {
    if (!confirm('가입된 모든 사용자를 이 기수 구성원으로 추가하시겠습니까?')) return
    setSyncing(true)
    try {
      const res = await fetch(`/api/admin/sync-profiles?cohortId=${cohortId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : '동기화 실패')
      setSyncing(false)
    }
  }

  const filtered = members.filter((m) => {
    const q = search.toLowerCase()
    return (
      m.profile?.name?.toLowerCase().includes(q) ||
      m.profile?.email?.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleSearchChange = (v: string) => {
    setSearch(v)
    setCurrentPage(1)
  }

  const getPageNumbers = (total: number, current: number): (number | '...')[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (current > 3) pages.push('...')
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
    if (current < total - 2) pages.push('...')
    pages.push(total)
    return pages
  }

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
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 text-green-700 border-green-300 hover:bg-green-50"
            >
              <Download className="w-4 h-4" />
              {exporting ? '내보내는 중...' : '엑셀 내보내기'}
            </Button>
            <Button variant="outline" onClick={handleSyncProfiles} disabled={syncing} className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              {syncing ? '동기화 중...' : '구성원 동기화'}
            </Button>
            <Button onClick={openInvite} className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              멤버 추가
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="이름 또는 이메일로 검색..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* 헤더 — 관리자/학생 레이아웃 분기 */}
        {isAdmin ? (
          <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-3">이름</div>
            <div className="col-span-3">이메일</div>
            <div className="col-span-2 flex items-center gap-1"><Phone className="w-3 h-3" />휴대폰</div>
            <div className="col-span-2">역할</div>
            <div className="col-span-2">가입일</div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-4">이름</div>
            <div className="col-span-4">이메일</div>
            <div className="col-span-2">역할</div>
            <div className="col-span-2">가입일</div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {search ? '검색 결과가 없습니다.' : '멤버가 없습니다.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {paginated.map((member) => isAdmin ? (
              /* 관리자 행 — 휴대폰 포함 */
              <div
                key={member.user_id}
                className="grid grid-cols-12 gap-3 px-5 py-4 items-center hover:bg-gray-50 transition-colors"
              >
                <button
                  type="button"
                  className="col-span-3 flex items-center gap-3 text-left"
                  onClick={() => setProfileMember(member)}
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-medium">
                      {getInitials(member.profile?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 transition-colors">
                    {member.profile?.name ?? '이름 없음'}
                    {member.user_id === currentUserId && (
                      <span className="ml-1 text-xs text-blue-500">(나)</span>
                    )}
                  </span>
                </button>

                <div className="col-span-3">
                  <p className="text-sm text-gray-500 truncate">{member.profile?.email ?? '-'}</p>
                </div>

                <div className="col-span-2">
                  {(member.profile as Profile & { phone?: string | null })?.phone ? (
                    <p className="text-sm text-gray-700 font-mono">
                      {(member.profile as Profile & { phone?: string | null }).phone}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-300">—</p>
                  )}
                </div>

                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${member.profile?.role === 'admin' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {member.profile?.role === 'admin'
                        ? <span className="flex items-center gap-1"><Shield className="w-3 h-3" />관리자</span>
                        : <span className="flex items-center gap-1"><User className="w-3 h-3" />학생</span>
                      }
                    </Badge>
                    {member.user_id !== currentUserId && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-gray-400 hover:text-gray-700"
                        onClick={() => handleToggleRole(member)} disabled={togglingId === member.user_id}>
                        {togglingId === member.user_id ? '...' : '변경'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="col-span-2 flex items-center justify-between">
                  <p className="text-xs text-gray-400">{formatDate(member.joined_at)}</p>
                  {member.user_id !== currentUserId && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-300 hover:text-red-500"
                      onClick={() => handleRemove(member)} disabled={removingId === member.user_id}>
                      <UserMinus className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* 일반 학생 행 — 휴대폰 없음 */
              <div
                key={member.user_id}
                className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-gray-50 transition-colors"
              >
                <button
                  type="button"
                  className="col-span-4 flex items-center gap-3 text-left"
                  onClick={() => setProfileMember(member)}
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-medium">
                      {getInitials(member.profile?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                    {member.profile?.name ?? '이름 없음'}
                    {member.user_id === currentUserId && (
                      <span className="ml-2 text-xs text-blue-500">(나)</span>
                    )}
                  </span>
                </button>
                <div className="col-span-4">
                  <p className="text-sm text-gray-500 truncate">{member.profile?.email ?? '-'}</p>
                </div>
                <div className="col-span-2">
                  <Badge className={`text-xs ${member.profile?.role === 'admin' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {member.profile?.role === 'admin'
                      ? <span className="flex items-center gap-1"><Shield className="w-3 h-3" />관리자</span>
                      : <span className="flex items-center gap-1"><User className="w-3 h-3" />학생</span>
                    }
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">{formatDate(member.joined_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between mt-4 px-1">
          {/* 페이지당 표시 수 */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>페이지당</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
              className="border border-gray-200 rounded-md px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n}개</option>)}
            </select>
            <span className="text-gray-400">· 총 {filtered.length}명</span>
          </div>

          {/* 페이지 버튼 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              «
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              ‹
            </button>

            {getPageNumbers(totalPages, safePage).map((p, i) =>
              p === '...' ? (
                <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p as number)}
                  className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                    safePage === p
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              ›
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* ── 멤버 프로필 모달 ── */}
      <Dialog open={!!profileMember} onOpenChange={(o) => { if (!o) setProfileMember(null) }}>
        <DialogContent className="max-w-sm">
          {profileMember && (() => {
            const p = profileMember.profile as Profile | undefined
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="sr-only">멤버 프로필</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-3 pt-2 pb-1">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={p?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-2xl font-bold">
                      {getInitials(p?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{p?.name ?? '이름 없음'}</p>
                    <Badge className={`text-xs mt-1 ${p?.role === 'admin' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {p?.role === 'admin'
                        ? <span className="flex items-center gap-1"><Shield className="w-3 h-3" />관리자</span>
                        : <span className="flex items-center gap-1"><User className="w-3 h-3" />수강생</span>
                      }
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2.5 text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{p?.email}</span>
                  </div>
                  {isAdmin && (p as Profile & { phone?: string | null })?.phone && (
                    <div className="flex items-center gap-2.5 text-gray-600">
                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-mono">{(p as Profile & { phone?: string | null }).phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-gray-500">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>가입일: {formatDate(profileMember.joined_at)}</span>
                  </div>
                  {p?.interests && (
                    <div className="flex items-start gap-2.5 text-gray-600">
                      <Tag className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span>{p.interests}</span>
                    </div>
                  )}
                  {p?.linkedin_url && (
                    <div className="flex items-center gap-2.5">
                      <Link2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <a
                        href={p.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline truncate"
                      >
                        LinkedIn 프로필
                      </a>
                    </div>
                  )}
                  {p?.bio && (
                    <div className="mt-1 bg-gray-50 rounded-lg px-3 py-2.5 text-gray-600 text-xs leading-relaxed">
                      {p.bio}
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

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
