import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Material, MaterialAttachment, Profile } from '@/types'
import { MaterialsClientWrapper } from '@/components/materials/MaterialsClientWrapper'

export default async function MaterialsPage({
  params,
}: {
  params: Promise<{ cohortId: string }>
}) {
  const { cohortId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = (profileData as Pick<Profile, 'role'> | null)?.role === 'admin'

  const { data: materialsData } = await supabase
    .from('materials')
    .select('*, profile:profiles!user_id(*), attachments:material_attachments(*)')
    .eq('cohort_id', cohortId)
    .order('created_at', { ascending: false })

  const { data: { publicUrl: baseUrl } } = supabase.storage.from('materials').getPublicUrl('')

  const materials: Material[] = (materialsData ?? []).map((m) => ({
    ...m,
    attachments: ((m.attachments ?? []) as MaterialAttachment[]).map((a) => ({
      ...a,
      public_url: `${baseUrl}${a.storage_path}`,
    })),
  }))

  return (
    <MaterialsClientWrapper
      cohortId={cohortId}
      initialMaterials={materials}
      isAdmin={isAdmin}
    />
  )
}
