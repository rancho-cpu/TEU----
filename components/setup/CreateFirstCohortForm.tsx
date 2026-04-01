'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowRight } from 'lucide-react'

interface CreateFirstCohortFormProps {
  userId: string
}

export function CreateFirstCohortForm({ userId }: CreateFirstCohortFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [programName, setProgramName] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!programName.trim() || !name.trim()) {
      setError('프로그램명과 기수 이름은 필수입니다.')
      return
    }

    setLoading(true)
    setError(null)

    // Insert cohort
    const { data: cohortData, error: cohortError } = await supabase
      .from('cohorts')
      .insert({
        program_name: programName.trim(),
        name: name.trim(),
        description: description.trim() || null,
      })
      .select()
      .single()

    if (cohortError || !cohortData) {
      setError('기수 생성 중 오류가 발생했습니다. 다시 시도해주세요.')
      setLoading(false)
      return
    }

    const cohortId = cohortData.id

    // Insert cohort_member (current user as admin role is already set)
    const { error: memberError } = await supabase.from('cohort_members').insert({
      cohort_id: cohortId,
      user_id: userId,
    })

    if (memberError) {
      setError('멤버 등록 중 오류가 발생했습니다. 다시 시도해주세요.')
      setLoading(false)
      return
    }

    // Redirect to the new cohort's contents page
    router.push(`/${cohortId}/contents`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="setup-program-name" className="text-sm font-medium text-gray-700">
          프로그램명 <span className="text-red-400">*</span>
        </Label>
        <Input
          id="setup-program-name"
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
          placeholder="예: TEU 부트캠프"
          className="text-sm"
          autoFocus
          maxLength={100}
        />
        <p className="text-xs text-gray-400">교육 프로그램의 이름을 입력하세요.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="setup-name" className="text-sm font-medium text-gray-700">
          기수 이름 <span className="text-red-400">*</span>
        </Label>
        <Input
          id="setup-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 1기, 2024년 상반기"
          className="text-sm"
          maxLength={50}
        />
        <p className="text-xs text-gray-400">이번 기수를 구분하는 이름을 입력하세요.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="setup-desc" className="text-sm font-medium text-gray-700">
          설명 <span className="text-gray-400 font-normal">(선택)</span>
        </Label>
        <Textarea
          id="setup-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="기수에 대한 간략한 설명을 입력하세요"
          className="text-sm resize-none min-h-[80px]"
          maxLength={500}
        />
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading || !programName.trim() || !name.trim()}
        className="w-full flex items-center justify-center gap-2 h-11 text-base"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            생성 중...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            첫 번째 기수 만들기
            <ArrowRight className="w-4 h-4" />
          </span>
        )}
      </Button>
    </form>
  )
}
