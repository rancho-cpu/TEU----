'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff } from 'lucide-react'

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setLoading(true)
    setError(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        name,
        phone: phone.trim() || null,
        role: 'student',
      })
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">회원가입</CardTitle>
          <CardDescription className="text-center">TEU 교육 플랫폼에 가입하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">

            {/* 이름 */}
            <div className="space-y-2">
              <Label htmlFor="name">이름 <span className="text-red-400">*</span></Label>
              <Input
                id="name"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            {/* 이메일 */}
            <div className="space-y-2">
              <Label htmlFor="email">이메일 <span className="text-red-400">*</span></Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* 비밀번호 */}
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호 <span className="text-red-400">*</span></Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="8자 이상"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 비밀번호 확인 */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">비밀번호 확인 <span className="text-red-400">*</span></Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="비밀번호를 다시 입력하세요"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={`pr-10 ${passwordMismatch ? 'border-red-400 focus-visible:ring-red-400' : confirmPassword && !passwordMismatch ? 'border-green-400' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordMismatch && (
                <p className="text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
              )}
              {confirmPassword && !passwordMismatch && (
                <p className="text-xs text-green-600">✓ 비밀번호가 일치합니다.</p>
              )}
            </div>

            {/* 휴대폰 번호 */}
            <div className="space-y-2">
              <Label htmlFor="phone">
                휴대폰 번호
                <span className="text-xs text-gray-400 font-normal ml-1">(선택)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="010-0000-0000"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                autoComplete="tel"
                inputMode="numeric"
              />
              <p className="text-xs text-gray-400">운영진에게만 공개됩니다.</p>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || passwordMismatch || !name || !email || !password || !confirmPassword}
            >
              {loading ? '가입 중...' : '회원가입'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-indigo-600 hover:underline font-medium">
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
