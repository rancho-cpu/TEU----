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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profileData }, { data: postsData }, { data: membersData }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('posts')
      .select('*, profile:profiles!user_id(*)')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false }),
    supabase
      .from('cohort_members')
      .select('profile:profiles!user_id(id, name, email)')
      .eq('cohort_id', cohortId),
  ])

  const profile = profileData as Profile | null
  const isAdmin = profile?.role === 'admin'

  const postIds = (postsData ?? []).map((p: { id: string }) => p.id)
  let commentCounts: Record<string, number> = {}
  let likeCounts: Record<string, number> = {}
  let userLikedSet = new Set<string>()
  let starCounts: Record<string, number> = {}
  let clapCounts: Record<string, number> = {}
  let userStarredSet = new Set<string>()
  let userClappedSet = new Set<string>()

  if (postIds.length > 0) {
    const [{ data: commentData }, { data: likesData }, { data: reactionsData }] =
      await Promise.all([
        supabase.from('comments').select('post_id').in('post_id', postIds),
        supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
        supabase.from('post_reactions').select('post_id, user_id, type').in('post_id', postIds),
      ])

    for (const row of (commentData ?? []) as { post_id: string }[]) {
      commentCounts[row.post_id] = (commentCounts[row.post_id] ?? 0) + 1
    }
    for (const row of (likesData ?? []) as { post_id: string; user_id: string }[]) {
      likeCounts[row.post_id] = (likeCounts[row.post_id] ?? 0) + 1
      if (row.user_id === user.id) userLikedSet.add(row.post_id)
    }
    for (const row of (reactionsData ?? []) as {
      post_id: string
      user_id: string
      type: string
    }[]) {
      if (row.type === 'star') {
        starCounts[row.post_id] = (starCounts[row.post_id] ?? 0) + 1
        if (row.user_id === user.id) userStarredSet.add(row.post_id)
      } else if (row.type === 'clap') {
        clapCounts[row.post_id] = (clapCounts[row.post_id] ?? 0) + 1
        if (row.user_id === user.id) userClappedSet.add(row.post_id)
      }
    }
  }

  const posts: Post[] = (postsData ?? []).map((p) => ({
    ...p,
    comment_count: commentCounts[p.id] ?? 0,
    likes_count: likeCounts[p.id] ?? 0,
    user_liked: userLikedSet.has(p.id),
    star_count: starCounts[p.id] ?? 0,
    clap_count: clapCounts[p.id] ?? 0,
    user_starred: userStarredSet.has(p.id),
    user_clapped: userClappedSet.has(p.id),
  }))

  const members = (membersData ?? [])
    .map((m) => m.profile as { id: string; name: string; email: string } | null)
    .filter((p): p is { id: string; name: string; email: string } => !!p)

  return (
    <CommunityClientWrapper
      cohortId={cohortId}
      initialPosts={posts}
      isAdmin={isAdmin}
      currentUserId={user.id}
      members={members}
    />
  )
}
