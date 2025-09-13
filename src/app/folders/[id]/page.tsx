import { createClient } from '@/lib/supabase/server'
import { getFolder, getFolderImages, getUserProfile } from '@/lib/database'
import { redirect } from 'next/navigation'
import FolderClient from './folder-client'

interface FolderPageProps {
  params: Promise<{ id: string }>
}

export default async function FolderPage({ params }: FolderPageProps) {
  const resolvedParams = await params
  const { id } = resolvedParams
  
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/signin')
  }

  const [profile, folder, images] = await Promise.all([
    getUserProfile(user.id),
    getFolder(id, user.id),
    getFolderImages(id, user.id),
  ])

  if (!profile) {
    redirect('/signin')
  }

  if (!folder) {
    redirect('/dashboard')
  }

  return (
    <FolderClient 
      user={user} 
      profile={profile} 
      folder={folder} 
      initialImages={images} 
    />
  )
}