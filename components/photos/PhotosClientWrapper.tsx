'use client'

import { useState, useRef } from 'react'
import type { Photo } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ImagePlus, Trash2, X, ZoomIn, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PhotosClientWrapperProps {
  cohortId: string
  initialPhotos: (Photo & { public_url?: string })[]
  isAdmin: boolean
  currentUserId: string
  storageBaseUrl: string
}

export function PhotosClientWrapper({
  cohortId,
  initialPhotos,
  isAdmin,
  currentUserId,
  storageBaseUrl,
}: PhotosClientWrapperProps) {
  const [photos, setPhotos] = useState(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<(Photo & { public_url?: string }) | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const getPublicUrl = (path: string) => `${storageBaseUrl}${path}`

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    setUploadError(null)

    for (const file of files) {
      try {
        if (!file.type.startsWith('image/')) {
          setUploadError('이미지 파일만 업로드할 수 있습니다.')
          continue
        }
        if (file.size > 10 * 1024 * 1024) {
          setUploadError('파일 크기는 10MB 이하여야 합니다.')
          continue
        }

        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `${cohortId}/${currentUserId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

        const { error: storageErr } = await supabase.storage
          .from('photos')
          .upload(path, file, { upsert: false })

        if (storageErr) throw storageErr

        const { data, error: dbErr } = await supabase
          .from('photos')
          .insert({ cohort_id: cohortId, user_id: currentUserId, storage_path: path })
          .select('*, profile:profiles!user_id(*)')
          .single()

        if (dbErr) {
          await supabase.storage.from('photos').remove([path])
          throw dbErr
        }

        setPhotos((prev) => [{ ...data, public_url: getPublicUrl(data.storage_path) }, ...prev])
      } catch (err: unknown) {
        setUploadError(err instanceof Error ? err.message : '업로드 실패')
      }
    }

    setUploading(false)
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (photo: Photo & { public_url?: string }) => {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return
    setDeletingId(photo.id)
    try {
      await supabase.storage.from('photos').remove([photo.storage_path])
      await supabase.from('photos').delete().eq('id', photo.id)
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
      if (lightbox?.id === photo.id) setLightbox(null)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '삭제 실패')
    } finally {
      setDeletingId(null)
    }
  }

  const canDelete = (photo: Photo) => isAdmin || photo.user_id === currentUserId

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사진 게시판</h1>
          <p className="text-sm text-gray-500 mt-1">총 {photos.length}장의 사진</p>
        </div>
        <div className="flex items-center gap-2">
          {uploadError && (
            <span className="text-xs text-red-500">{uploadError}</span>
          )}
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
            {uploading ? '업로드 중...' : '사진 추가'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Grid */}
      {photos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 cursor-pointer hover:border-indigo-300 hover:text-indigo-400 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-base font-medium">사진을 업로드해보세요</p>
          <p className="text-sm mt-1">클릭하거나 파일을 여기로 드래그하세요</p>
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative group break-inside-avoid rounded-xl overflow-hidden bg-gray-100 cursor-pointer"
              onClick={() => setLightbox(photo)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.public_url ?? getPublicUrl(photo.storage_path)}
                alt={photo.caption ?? ''}
                className="w-full object-cover transition-transform duration-200 group-hover:scale-105"
                loading="lazy"
              />

              {/* hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>

              {/* 업로더 + 삭제 */}
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="flex items-end justify-between">
                  <p className="text-xs text-white/80 truncate max-w-[80%]">
                    {(photo.profile as { name?: string | null } | undefined)?.name ?? ''}
                  </p>
                  {canDelete(photo) && (
                    <button
                      onClick={(ev) => { ev.stopPropagation(); handleDelete(photo) }}
                      disabled={deletingId === photo.id}
                      className="p-1 rounded-md bg-red-500/80 hover:bg-red-600 text-white transition-colors"
                    >
                      {deletingId === photo.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X className="w-8 h-8" />
          </button>

          {/* nav: prev / next */}
          {photos.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-3xl font-light px-3 py-2"
                onClick={(ev) => {
                  ev.stopPropagation()
                  const idx = photos.findIndex((p) => p.id === lightbox.id)
                  setLightbox(photos[(idx - 1 + photos.length) % photos.length])
                }}
              >
                ‹
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-3xl font-light px-3 py-2"
                onClick={(ev) => {
                  ev.stopPropagation()
                  const idx = photos.findIndex((p) => p.id === lightbox.id)
                  setLightbox(photos[(idx + 1) % photos.length])
                }}
              >
                ›
              </button>
            </>
          )}

          <div className="max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.public_url ?? getPublicUrl(lightbox.storage_path)}
              alt={lightbox.caption ?? ''}
              className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
            />
            <div className={cn('mt-3 text-center', lightbox.caption ? '' : 'hidden')}>
              <p className="text-white text-sm">{lightbox.caption}</p>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-white/50 text-xs">
                {(lightbox.profile as { name?: string | null } | undefined)?.name} · {new Date(lightbox.created_at).toLocaleDateString('ko-KR')}
              </p>
              {canDelete(lightbox) && (
                <button
                  onClick={() => handleDelete(lightbox)}
                  disabled={deletingId === lightbox.id}
                  className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
