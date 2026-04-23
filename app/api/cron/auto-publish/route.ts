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

  // pending 현황 먼저 조회 (디버그용)
  const [{ data: pendingA }, { data: pendingS }] = await Promise.all([
    supabase.from('assignments').select('id, title, open_at, is_published').not('open_at', 'is', null).eq('is_published', false),
    supabase.from('surveys').select('id, title, open_at, is_published').not('open_at', 'is', null).eq('is_published', false),
  ])

  // 실제 업데이트
  const [{ data: assignments, error: aErr }, { data: surveys, error: sErr }] = await Promise.all([
    supabase
      .from('assignments')
      .update({ is_published: true })
      .lte('open_at', now)
      .eq('is_published', false)
      .not('open_at', 'is', null)
      .select('id, title'),
    supabase
      .from('surveys')
      .update({ is_published: true })
      .lte('open_at', now)
      .eq('is_published', false)
      .not('open_at', 'is', null)
      .select('id, title'),
  ])

  return NextResponse.json({
    now,
    pending_assignments: pendingA ?? [],
    pending_surveys: pendingS ?? [],
    published_assignments: assignments ?? [],
    published_surveys: surveys ?? [],
    errors: {
      assignments: aErr?.message ?? null,
      surveys: sErr?.message ?? null,
    },
  })
}
