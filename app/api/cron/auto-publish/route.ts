import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/cron/auto-publish
// 30분마다 실행 — open_at <= now() 이고 is_published=false 인 과제/설문을 자동 공개
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const [{ data: assignments, error: aErr }, { data: surveys, error: sErr }] = await Promise.all([
    supabase
      .from('assignments')
      .update({ is_published: true })
      .lte('open_at', now)
      .eq('is_published', false)
      .not('open_at', 'is', null)
      .select('id, title, cohort_id'),
    supabase
      .from('surveys')
      .update({ is_published: true })
      .lte('open_at', now)
      .eq('is_published', false)
      .not('open_at', 'is', null)
      .select('id, title, cohort_id'),
  ])

  if (aErr) console.error('auto-publish assignments error:', aErr.message)
  if (sErr) console.error('auto-publish surveys error:', sErr.message)

  const publishedCount = (assignments?.length ?? 0) + (surveys?.length ?? 0)

  return NextResponse.json({
    message: 'Done',
    assignments: assignments?.length ?? 0,
    surveys: surveys?.length ?? 0,
    total: publishedCount,
  })
}
