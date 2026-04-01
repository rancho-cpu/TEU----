export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('cohort_members')
    .select('cohort_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single()

  if (member) redirect(`/${member.cohort_id}/contents`)

  const { data: cohort } = await supabase
    .from('cohorts')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (cohort) redirect(`/${cohort.id}/contents`)

  redirect('/setup')
}
