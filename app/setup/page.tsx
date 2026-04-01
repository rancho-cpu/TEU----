import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreateFirstCohortForm } from '@/components/setup/CreateFirstCohortForm'
import { Layers } from 'lucide-react'

export default async function SetupPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // If cohorts already exist for this user, redirect to the first one
  const { data: existingMembers } = await supabase
    .from('cohort_members')
    .select('cohort_id')
    .eq('user_id', user.id)
    .limit(1)

  if (existingMembers && existingMembers.length > 0) {
    redirect(`/${existingMembers[0].cohort_id}/contents`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Layers className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">시작하기</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              첫 번째 기수를 만들어 교육 플랫폼을 시작해보세요.
              <br />
              기수를 만들면 멤버를 초대하고 커리큘럼을 관리할 수 있습니다.
            </p>
          </div>

          <CreateFirstCohortForm userId={user.id} />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          TEU 교육 플랫폼
        </p>
      </div>
    </div>
  )
}
