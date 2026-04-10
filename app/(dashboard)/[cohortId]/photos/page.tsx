import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Photo, Profile } from '@/types'
import { PhotosClientWrapper } from '@/components/photos/PhotosClientWrapper'

export default async function PhotosPage({
  params,
}: {
  params: Promise<{ cohortId: string }>
}) {
  const { cohortId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profileData }, { data: photosData }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('photos')
      .select('*, profile:profiles!user_id(*)')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false }),
  ])

  const profile = profileData as Profile | null
  const isAdmin = profile?.role === 'admin'

  // storage public URL 붙이기
  const { data: { publicUrl: baseUrl } } = supabase.storage.from('photos').getPublicUrl('')
  const photos: Photo[] = (photosData ?? []).map((p) => ({
    ...p,
    public_url: `${baseUrl}${p.storage_path}`,
  }))

  return (
    <PhotosClientWrapper
      cohortId={cohortId}
      initialPhotos={photos}
      isAdmin={isAdmin}
      currentUserId={user.id}
      storageBaseUrl={baseUrl}
    />
  )
}
