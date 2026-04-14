import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Cohort, Shortcut, Profile, ChatbotFaq } from '@/types'
import { SettingsClientWrapper } from '@/components/layout/SettingsClientWrapper'
import { ShieldAlert } from 'lucide-react'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ cohortId: string }>
}) {
  const { cohortId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profileData }, { data: cohortData }, { data: shortcutsData }, { data: faqsData }, { data: membersData }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('cohorts').select('*').eq('id', cohortId).single(),
      supabase
        .from('shortcuts')
        .select('*')
        .eq('cohort_id', cohortId)
        .order('order', { ascending: true }),
      supabase
        .from('chatbot_faqs')
        .select('*')
        .eq('cohort_id', cohortId)
        .order('order_index', { ascending: true }),
      supabase
        .from('cohort_members')
        .select('user_id, profile:profiles!user_id(id, name, email, role)')
        .eq('cohort_id', cohortId),
    ])

  const profile = profileData as Profile | null
  const isAdmin = profile?.role === 'admin'

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <ShieldAlert className="w-14 h-14 mb-4 opacity-40" />
          <p className="text-lg font-medium text-gray-600">접근 권한이 없습니다</p>
          <p className="text-sm mt-1">이 페이지는 관리자만 접근할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  // student 멤버만 추출
  const studentMembers = (membersData ?? [])
    .map((m) => {
      const p = (m.profile as unknown) as { id: string; name: string | null; email: string; role: string } | null
      return { userId: m.user_id as string, name: p?.name, email: p?.email, role: p?.role }
    })
    .filter((m) => m.role !== 'admin')

  return (
    <SettingsClientWrapper
      cohortId={cohortId}
      cohort={cohortData as Cohort}
      initialShortcuts={(shortcutsData ?? []) as Shortcut[]}
      initialFaqs={(faqsData ?? []) as ChatbotFaq[]}
      studentMembers={studentMembers}
    />
  )
}
