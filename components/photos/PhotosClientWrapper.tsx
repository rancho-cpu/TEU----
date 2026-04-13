'use client'

import { useState, useRef } from 'react'
import type { Photo, PhotoAlbum } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ImagePlus, Trash2, X, ZoomIn, Loader2,
  FolderOpen, Plus, ChevronLeft, Images, Pencil,
  Download, Archive,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type PhotoWithUrl = Photo & { public_url: string }

interface Props {
  cohortId: string
  initialPhotos: PhotoWithUrl[]
  initialAlbums: PhotoAlbum[]
  isAdmin: boolean
  currentUserId: string
  storageBaseUrl: string
}

export function PhotosClientWrapper({
  cohortId,
  initialPhotos,
  initialAlbums,
  isAdmin,
  currentUserId,
  storageBaseUrl,
}: Props) {
  const supabase = createClient()

  const [photos, setPhotos] = useState<PhotoWithUrl[]>(initialPhotos)
  const [albums, setAlbums] = useState<PhotoAlbum[]>(initialAlbums)

  const [activeAlbum, setActiveAlbum] = useState<PhotoAlbum | null>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<PhotoWithUrl | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [bulkDownloading, setBulkDownloading] = useState(false)

  // 앨범 생성 폼
  const [createAlbumOpen, setCreateAlbumOpen] = useState(false)
  const [albumName, setAlbumName] = useState('')
  const [albumDesc, setAlbumDesc] = useState('')
  const [savingAlbum, setSavingAlbum] = useState(false)

  // 앨범 이름 수정
  const [editingAlbum, setEditingAlbum] = useState<PhotoAlbum | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const getUrl = (path: string) => `${storageBaseUrl}${path}`

  // ── 앨범 생성 ────────────────────────────────────────────────
  const handleCreateAlbum = async () => {
    if (!albumName.trim()) return
    setSavingAlbum(true)
    const { data, error } = await supabase
      .from('photo_albums')
      .insert({ cohort_id: cohortId, name: albumName.trim(), description: albumDesc.trim() || null })
      .select()
      .single()
    if (!error && data) {
      setAlbums((prev) => [...prev, { ...data, photo_count: 0 }])
      setAlbumName('')
      setAlbumDesc('')
      setCreateAlbumOpen(false)
    }
    setSavingAlbum(false)
  }

  // ── 앨범 이름 수정 ────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editingAlbum || !editName.trim()) return
    setSavingAlbum(true)
    const { error } = await supabase
      .from('photo_albums')
      .update({ name: editName.trim(), description: editDesc.trim() || null })
      .eq('id', editingAlbum.id)
    if (!error) {
      setAlbums((prev) =>
        prev.map((a) => a.id === editingAlbum.id ? { ...a, name: editName.trim(), description: editDesc.trim() || null } : a)
      )
      if (activeAlbum?.id === editingAlbum.id) {
        setActiveAlbum((a) => a ? { ...a, name: editName.trim(), description: editDesc.trim() || null } : a)
      }
      setEditingAlbum(null)
    }
    setSavingAlbum(false)
  }

  // ── 앨범 삭제 ────────────────────────────────────────────────
  const handleDeleteAlbum = async (album: PhotoAlbum) => {
    if (!confirm(`"${album.name}" 앨범을 삭제하시겠습니까?\n앨범 안의 사진은 '전체' 탭으로 이동됩니다.`)) return
    const { error } = await supabase.from('photo_albums').delete().eq('id', album.id)
    if (!error) {
      setAlbums((prev) => prev.filter((a) => a.id !== album.id))
      setPhotos((prev) => prev.map((p) => p.album_id === album.id ? { ...p, album_id: null } : p))
      if (activeAlbum?.id === album.id) setActiveAlbum(null)
    }
  }

  // ── 사진 업로드 ──────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    setUploadError(null)

    for (const file of files) {
      try {
        if (!file.type.startsWith('image/')) { setUploadError('이미지 파일만 업로드 가능합니다.'); continue }
        if (file.size > 10 * 1024 * 1024) { setUploadError('파일 크기는 10MB 이하여야 합니다.'); continue }

        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `${cohortId}/${currentUserId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

        const { error: storageErr } = await supabase.storage.from('photos').upload(path, file)
        if (storageErr) throw storageErr

        const { data, error: dbErr } = await supabase
          .from('photos')
          .insert({
            cohort_id: cohortId,
            user_id: currentUserId,
            storage_path: path,
            album_id: activeAlbum?.id ?? null,
          })
          .select('*, profile:profiles!user_id(*)')
          .single()

        if (dbErr) { await supabase.storage.from('photos').remove([path]); throw dbErr }

        const newPhoto: PhotoWithUrl = { ...data, public_url: getUrl(data.storage_path) }
        setPhotos((prev) => [newPhoto, ...prev])

        if (activeAlbum) {
          setAlbums((prev) =>
            prev.map((a) => a.id === activeAlbum.id ? { ...a, photo_count: (a.photo_count ?? 0) + 1 } : a)
          )
        }

        if (activeAlbum && !activeAlbum.cover_path) {
          await supabase.from('photo_albums').update({ cover_path: path }).eq('id', activeAlbum.id)
          setAlbums((prev) => prev.map((a) => a.id === activeAlbum.id ? { ...a, cover_path: path } : a))
          setActiveAlbum((a) => a ? { ...a, cover_path: path } : a)
        }
      } catch (err: unknown) {
        setUploadError(err instanceof Error ? err.message : '업로드 실패')
      }
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── 사진 삭제 ────────────────────────────────────────────────
  const handleDelete = async (photo: PhotoWithUrl) => {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return
    setDeletingId(photo.id)
    try {
      await supabase.storage.from('photos').remove([photo.storage_path])
      await supabase.from('photos').delete().eq('id', photo.id)
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
      if (photo.album_id) {
        setAlbums((prev) =>
          prev.map((a) => a.id === photo.album_id ? { ...a, photo_count: Math.max(0, (a.photo_count ?? 1) - 1) } : a)
        )
      }
      if (lightbox?.id === photo.id) setLightbox(null)
    } finally {
      setDeletingId(null)
    }
  }

  // ── 개별 사진 다운로드 ────────────────────────────────────────
  const handleDownload = async (photo: PhotoWithUrl, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setDownloading(true)
    try {
      const res = await fetch(photo.public_url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = photo.storage_path.split('.').pop() ?? 'jpg'
      a.download = `photo_${photo.id.slice(0, 8)}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('다운로드 실패')
    } finally {
      setDownloading(false)
    }
  }

  // ── 전체 ZIP 다운로드 ─────────────────────────────────────────
  const handleBulkDownload = async () => {
    if (visiblePhotos.length === 0) return
    setBulkDownloading(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const folderName = activeAlbum?.name ?? '사진'
      const folder = zip.folder(folderName)!

      await Promise.all(
        visiblePhotos.map(async (photo, i) => {
          try {
            const res = await fetch(photo.public_url)
            const blob = await res.blob()
            const ext = photo.storage_path.split('.').pop() ?? 'jpg'
            folder.file(`${String(i + 1).padStart(3, '0')}.${ext}`, blob)
          } catch {
            // 개별 실패는 무시
          }
        })
      )

      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `${folderName}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('ZIP 다운로드 실패')
    } finally {
      setBulkDownloading(false)
    }
  }

  const canDelete = (photo: Photo) => isAdmin || photo.user_id === currentUserId

  const visiblePhotos = activeAlbum
    ? photos.filter((p) => p.album_id === activeAlbum.id)
    : photos

  // 앨범 목록 헤더용: DB의 photo_count 합산 (orphan 사진 제외)
  const totalAlbumPhotos = albums.reduce((sum, a) => sum + (a.photo_count ?? 0), 0)

  // ── 렌더 ─────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {activeAlbum && (
            <button
              onClick={() => setActiveAlbum(null)}
              className="flex items-center gap-1 text-gray-400 hover:text-gray-700 transition-colors text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              전체
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              {activeAlbum ? (
                <>
                  <FolderOpen className="w-6 h-6 text-indigo-500" />
                  {activeAlbum.name}
                </>
              ) : (
                <>
                  <Images className="w-6 h-6 text-indigo-500" />
                  사진 게시판
                </>
              )}
            </h1>
            {activeAlbum?.description && (
              <p className="text-sm text-gray-500 mt-0.5">{activeAlbum.description}</p>
            )}
            <p className="text-sm text-gray-400 mt-0.5">
              {activeAlbum ? `${visiblePhotos.length}장` : `${albums.length}개 행사 · 총 ${totalAlbumPhotos}장`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {uploadError && <span className="text-xs text-red-500 max-w-xs text-right">{uploadError}</span>}

          {/* 앨범 안에 있을 때 */}
          {activeAlbum && (
            <>
              {/* 전체 다운로드 */}
              {visiblePhotos.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleBulkDownload}
                  disabled={bulkDownloading}
                >
                  {bulkDownloading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />ZIP 생성 중...</>
                    : <><Archive className="w-4 h-4" />전체 다운로드</>
                  }
                </Button>
              )}

              {isAdmin && (
                <>
                  <button
                    onClick={() => { setEditingAlbum(activeAlbum); setEditName(activeAlbum.name); setEditDesc(activeAlbum.description ?? '') }}
                    className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteAlbum(activeAlbum)}
                    className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}

              <Button size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {uploading ? '업로드 중...' : '사진 추가'}
              </Button>
            </>
          )}

          {/* 앨범 목록: 새 행사 만들기 (관리자) */}
          {!activeAlbum && isAdmin && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCreateAlbumOpen(true)}>
              <Plus className="w-4 h-4" />
              행사 추가
            </Button>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* ── 앨범 생성 폼 ── */}
      {createAlbumOpen && (
        <div className="mb-6 p-4 border border-indigo-200 rounded-xl bg-indigo-50">
          <p className="text-sm font-semibold text-indigo-700 mb-3">새 행사 만들기</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="행사 이름 (예: 4월 OT, 중간 발표회)"
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              className="flex-1 bg-white"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateAlbum()}
            />
            <Input
              placeholder="설명 (선택)"
              value={albumDesc}
              onChange={(e) => setAlbumDesc(e.target.value)}
              className="flex-1 bg-white"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateAlbum} disabled={savingAlbum || !albumName.trim()}>
                {savingAlbum ? <Loader2 className="w-4 h-4 animate-spin" /> : '만들기'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setCreateAlbumOpen(false); setAlbumName(''); setAlbumDesc('') }}>
                취소
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 앨범 이름 수정 폼 ── */}
      {editingAlbum && (
        <div className="mb-6 p-4 border border-amber-200 rounded-xl bg-amber-50">
          <p className="text-sm font-semibold text-amber-700 mb-3">행사 이름 수정</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="행사 이름"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 bg-white"
            />
            <Input
              placeholder="설명 (선택)"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="flex-1 bg-white"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} disabled={savingAlbum || !editName.trim()}>
                {savingAlbum ? <Loader2 className="w-4 h-4 animate-spin" /> : '저장'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingAlbum(null)}>취소</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 앨범 목록 뷰 ── */}
      {!activeAlbum && (
        <>
          {albums.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
              <FolderOpen className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-base font-medium">아직 행사가 없습니다</p>
              {isAdmin && (
                <p className="text-sm mt-1 cursor-pointer text-indigo-400 hover:underline" onClick={() => setCreateAlbumOpen(true)}>
                  + 첫 번째 행사를 만들어보세요
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {albums.map((album) => {
                const cover = album.cover_path
                  ? getUrl(album.cover_path)
                  : null
                const firstPhoto = photos.find((p) => p.album_id === album.id)
                const coverUrl = cover ?? firstPhoto?.public_url ?? null

                return (
                  <div
                    key={album.id}
                    className="group cursor-pointer rounded-xl overflow-hidden border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all"
                    onClick={() => setActiveAlbum(album)}
                  >
                    {/* 커버 이미지 */}
                    <div className="aspect-square bg-gray-100 relative overflow-hidden">
                      {coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverUrl}
                          alt={album.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FolderOpen className="w-10 h-10 text-gray-300" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>

                    {/* 앨범 이름 + 장 수 */}
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-medium text-sm text-gray-800 truncate">{album.name}</p>
                        <span className="text-xs text-gray-400 flex-shrink-0">{album.photo_count ?? 0}장</span>
                      </div>
                      {album.description && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{album.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(album.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── 앨범 내부 사진 그리드 ── */}
      {activeAlbum && (
        <>
          {visiblePhotos.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 cursor-pointer hover:border-indigo-300 hover:text-indigo-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-base font-medium">아직 사진이 없습니다</p>
              <p className="text-sm mt-1">클릭해서 첫 번째 사진을 올려보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visiblePhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer"
                  onClick={() => setLightbox(photo)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.public_url}
                    alt={photo.caption ?? ''}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-end justify-between">
                      <p className="text-xs text-white/80 truncate max-w-[60%]">
                        {(photo.profile as { name?: string | null } | undefined)?.name ?? ''}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(ev) => handleDownload(photo, ev)}
                          disabled={downloading}
                          className="p-1 rounded-md bg-white/20 hover:bg-white/40 text-white transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {canDelete(photo) && (
                          <button
                            onClick={(ev) => { ev.stopPropagation(); handleDelete(photo) }}
                            disabled={deletingId === photo.id}
                            className="p-1 rounded-md bg-red-500/80 hover:bg-red-600 text-white transition-colors"
                          >
                            {deletingId === photo.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="w-8 h-8" />
          </button>

          {visiblePhotos.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl font-light px-3 py-2"
                onClick={(ev) => {
                  ev.stopPropagation()
                  const idx = visiblePhotos.findIndex((p) => p.id === lightbox.id)
                  setLightbox(visiblePhotos[(idx - 1 + visiblePhotos.length) % visiblePhotos.length])
                }}
              >
                ‹
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl font-light px-3 py-2"
                onClick={(ev) => {
                  ev.stopPropagation()
                  const idx = visiblePhotos.findIndex((p) => p.id === lightbox.id)
                  setLightbox(visiblePhotos[(idx + 1) % visiblePhotos.length])
                }}
              >
                ›
              </button>
            </>
          )}

          <div className="max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.public_url}
              alt={lightbox.caption ?? ''}
              className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-3">
              <p className="text-white/50 text-xs">
                {(lightbox.profile as { name?: string | null } | undefined)?.name} · {new Date(lightbox.created_at).toLocaleDateString('ko-KR')}
              </p>
              {/* 다운로드 버튼 */}
              <button
                onClick={() => handleDownload(lightbox)}
                disabled={downloading}
                className="text-white/70 hover:text-white text-xs flex items-center gap-1 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                다운로드
              </button>
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
