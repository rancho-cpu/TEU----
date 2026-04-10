import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Photo, PhotoAlbum, Profile } from '@/types'
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

  const [{ data: profileData }, { data: photosData }, { data: albumsData }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('photos')
      .select('*, profile:profiles!user_id(*)')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false }),
    supabase
      .from('photo_albums')
      .select('*')
      .eq('cohort_id', cohortId)
      .order('order_index', { ascending: true }),
  ])

  const profile = profileData as Profile | null
  const isAdmin = profile?.role === 'admin'

  const { data: { publicUrl: baseUrl } } = supabase.storage.from('photos').getPublicUrl('')

  const photos: (Photo & { public_url: string })[] = (photosData ?? []).map((p) => ({
    ...p,
    public_url: `${baseUrl}${p.storage_path}`,
  }))

  // 앨범별 photo_count 계산
  const albums: PhotoAlbum[] = (albumsData ?? []).map((a) => ({
    ...a,
    photo_count: photos.filter((p) => p.album_id === a.id).length,
  }))

  return (
    <PhotosClientWrapper
      cohortId={cohortId}
      initialPhotos={photos}
      initialAlbums={albums}
      isAdmin={isAdmin}
      currentUserId={user.id}
      storageBaseUrl={baseUrl}
    />
  )
}
