'use client'

import { useState, useRef } from 'react'
import type { Profile } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Camera, Loader2, CheckCircle2, User, Mail, Shield, Calendar, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  profile: Profile
  avatarBaseUrl: string
}

const ROLE_LABEL: Record<string, string> = {
  admin: '관리자',
  student: '수강생',
}

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-indigo-100 text-indigo-700',
  student: 'bg-gray-100 text-gray-600',
}

export function ProfileClientWrapper({ profile, avatarBaseUrl }: Props) {
  const supabase = createClient()

  const [name, setName] = useState(profile.name ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── 아바타 업로드 ─────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setAvatarError('이미지 파일만 가능합니다.'); return }
    if (file.size > 5 * 1024 * 1024) { setAvatarError('5MB 이하 파일만 가능합니다.'); return }

    setUploadingAvatar(true)
    setAvatarError(null)

    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${profile.id}/avatar.${ext}`

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      // 캐시 무력화용 쿼리스트링 추가
      const urlWithTs = `${publicUrl}?t=${Date.now()}`

      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id)
      if (dbErr) throw dbErr

      setAvatarUrl(urlWithTs)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── 프로필 저장 ───────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setSaveError(null)

    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim() || null, bio: bio.trim() || null, phone: phone.trim() || null })
      .eq('id', profile.id)

    if (error) {
      setSaveError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  const displayAvatar = avatarUrl || null
  const initials = (name || profile.email).charAt(0).toUpperCase()

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <User className="w-6 h-6 text-indigo-500" />
          내 프로필
        </h1>
        <p className="text-sm text-gray-500 mt-1">닉네임, 프로필 사진, 소개글을 설정하세요.</p>
      </div>

      <div className="space-y-5">

        {/* ── 프로필 카드 ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start gap-6">

            {/* 아바타 */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-indigo-100 border-2 border-white shadow-md flex items-center justify-center">
                  {displayAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayAvatar}
                      alt="프로필"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-indigo-600">{initials}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 w-7 h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
                >
                  {uploadingAvatar
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Camera className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                {uploadingAvatar ? '업로드 중...' : '사진 변경'}
              </button>
              {avatarError && <p className="text-xs text-red-500 text-center max-w-[100px]">{avatarError}</p>}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* 기본 정보 */}
            <div className="flex-1 space-y-2 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl font-bold text-gray-900">
                  {profile.name ?? '이름 미설정'}
                </span>
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', ROLE_COLOR[profile.role] ?? 'bg-gray-100 text-gray-600')}>
                  {ROLE_LABEL[profile.role] ?? profile.role}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                {profile.email}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                {phone || <span className="text-gray-300">휴대폰 번호 미등록</span>}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                가입일: {new Date(profile.created_at).toLocaleDateString('ko-KR')}
              </div>
              {profile.bio && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mt-2">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── 편집 폼 ── */}
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />
            정보 수정
          </h2>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              닉네임 <span className="text-gray-400 font-normal text-xs">(커뮤니티, 과제 등에 표시됩니다)</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="표시될 이름을 입력하세요"
              maxLength={30}
              className="text-sm"
            />
            <p className="text-xs text-gray-400">{name.length}/30</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              휴대폰 번호 <span className="text-gray-400 font-normal text-xs">(운영진에게만 공개)</span>
            </Label>
            <Input
              value={phone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
                if (digits.length <= 3) setPhone(digits)
                else if (digits.length <= 7) setPhone(`${digits.slice(0, 3)}-${digits.slice(3)}`)
                else setPhone(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`)
              }}
              placeholder="010-0000-0000"
              inputMode="numeric"
              className="text-sm font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              소개글 <span className="text-gray-400 font-normal text-xs">(선택)</span>
            </Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="간단한 자기소개를 적어보세요. (예: 안녕하세요, OO 공부 중인 홍길동입니다 👋)"
              className="resize-none min-h-[90px] text-sm"
              maxLength={150}
            />
            <p className="text-xs text-gray-400">{bio.length}/150</p>
          </div>

          {saveError && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            {saved ? (
              <span className="text-sm text-green-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> 저장되었습니다!
              </span>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? '저장 중...' : '저장하기'}
            </Button>
          </div>
        </form>

      </div>
    </div>
  )
}
