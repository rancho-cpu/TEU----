import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const cohortId = req.nextUrl.searchParams.get('cohortId')
  if (!cohortId) return NextResponse.json({ error: 'cohortId required' }, { status: 400 })

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('zoom_lectures')
    .select('*')
    .eq('cohort_id', cohortId)
    .order('start_time', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lectures: data })
}
