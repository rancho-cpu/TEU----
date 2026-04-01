import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import type { Cohort, Shortcut } from '@/types'

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

  const [{ data: currentCohort }, { data: cohorts }, { data: shortcuts }] = await Promise.all([
    supabase.from('cohorts').select('*').eq('id', cohortId).single(),
    supabase.from('cohorts').select('*').order('created_at', { ascending: true }),
    supabase.from('shortcuts').select('*').eq('cohort_id', cohortId).order('order', { ascending: true }),
  ])

  if (!currentCohort) notFound()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        cohortId={cohortId}
        cohorts={(cohorts ?? []) as Cohort[]}
        shortcuts={(shortcuts ?? []) as Shortcut[]}
        currentCohort={currentCohort as Cohort}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
