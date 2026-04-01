import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Called by Vercel Cron every hour
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    )

    const { data, error } = await supabase
      .from('challenges')
      .update({ is_closed: true })
      .eq('is_closed', false)
      .lt('end_at', new Date().toISOString())
      .select('id')

    if (error) throw error

    return NextResponse.json({ closed: data?.length ?? 0 })
  } catch (err) {
    console.error('[challenges/close]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
