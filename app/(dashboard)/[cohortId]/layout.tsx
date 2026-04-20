import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { ChatBot } from '@/components/chatbot/ChatBot'
import type { Cohort, Profile, Shortcut } from '@/types'

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

  const [{ data: currentCohort }, { data: cohorts }, { data: shortcuts }, { data: profileData }] = await Promise.all([
    supabase.from('cohorts').select('*').eq('id', cohortId).single(),
    supabase.from('cohorts').select('*').order('created_at', { ascending: true }),
    supabase.from('shortcuts').select('*').eq('cohort_id', cohortId).order('order', { ascending: true }),
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
