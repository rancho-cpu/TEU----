import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Profile } from '@/types'
import { ProfileClientWrapper } from '@/components/profile/ProfileClientWrapper'

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null
  if (!profile) redirect('/login')

  const { data: { publicUrl: avatarBaseUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl('')

  return (
    <ProfileClientWrapper
      profile={profile}
      avatarBaseUrl={avatarBaseUrl}
    />
  )
}
