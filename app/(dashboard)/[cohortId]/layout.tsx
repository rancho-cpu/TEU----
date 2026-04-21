import { notFound, redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { ChatBot } from '@/components/chatbot/ChatBot'
import type { Cohort, Profile, Shortcut } from '@/types'

// cohort·shortcuts 데이터는 사용자와 무관하므로 60초간 캐싱
const getCohortLayoutData = unstable_cache(
  async (cohortId: string) => {
    const service = createServiceClient()
    const [{ data: currentCohort }, { data: cohorts }, { data: shortcuts }] = await Promise.all([
      service.from('cohorts').select('*').eq('id', cohortId).single(),
      service.from('cohorts').select('*').order('created_at', { ascending: true }),
      service.from('shortcuts').select('*').eq('cohort_id', cohortId).order('order', { ascending: true }),
    ])
    return { currentCohort, cohorts: cohorts ?? [], shortcuts: shortcuts ?? [] }
  },
  ['cohort-layout'],
  { revalidate: 60 }
)

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ cohortId: string }>
}) {
  const { cohortId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ currentCohort, cohorts, shortcuts }, { data: profileData }] = await Promise.all([
    getCohortLayoutData(cohortId),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])

  if (!currentCohort) notFound()

  return (
    <>
      <DashboardShell
        cohortId={cohortId}
        cohorts={(cohorts ?? []) as Cohort[]}
        shortcuts={(shortcuts ?? []) as Shortcut[]}
        currentCohort={currentCohort as Cohort}
        profile={profileData as Profile | null}
        currentUserId={user.id}
      >
        {children}
      </DashboardShell>
      <ChatBot cohortId={cohortId} />
    </>
  )
}
