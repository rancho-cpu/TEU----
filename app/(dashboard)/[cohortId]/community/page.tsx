import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Post, Profile } from '@/types'
import { CommunityClientWrapper } from '@/components/community/CommunityClientWrapper'

export default async function CommunityPage({
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

  const [{ data: profileData }, { data: postsData }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('posts')
      .select(`
        *,
        profile:profiles(*)
      `)
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false }),
  ])

  const profile = profileData as Profile | null
  const isAdmin = profile?.role === 'admin'

  // Fetch comment counts for all posts
  const postIds = (postsData ?? []).map((p: { id: string }) => p.id)
  let commentCounts: Record<string, number> = {}

  if (postIds.length > 0) {
    const { data: commentData } = await supabase
      .from('comments')
      .select('post_id')
      .in('post_id', postIds)

    if (commentData) {
      for (const row of commentData as { post_id: string }[]) {
        commentCounts[row.post_id] = (commentCounts[row.post_id] ?? 0) + 1
      }
    }
  }

  const posts: Post[] = (postsData ?? []).map((p) => ({
    ...p,
    comment_count: commentCounts[p.id] ?? 0,
  }))

  return (
    <CommunityClientWrapper
      cohortId={cohortId}
      initialPosts={posts}
      isAdmin={isAdmin}
      currentUserId={user.id}
    />
  )
}
