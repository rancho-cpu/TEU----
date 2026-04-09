'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RefreshCw, Plus, FolderOpen, Folder } from 'lucide-react'
import type { ZoomLecture, Survey, ContentFolder } from '@/types'
import { ZoomLectureCard } from './ZoomLectureCard'
import { SurveyCard } from './SurveyCard'
import { CreateSurveyModal } from './CreateSurveyModal'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface ContentsClientWrapperProps {
  cohortId: string
  lectures: ZoomLecture[]
  surveys: Survey[]
  folders: ContentFolder[]
  isAdmin: boolean
}

export function ContentsClientWrapper({
  cohortId,
  lectures,
  surveys,
  folders,
  isAdmin,
}: ContentsClientWrapperProps) {
  const [surveyModalOpen, setSurveyModalOpen] = useState(false)
  const [localSurveys, setLocalSurveys] = useState<Survey[]>(surveys)
  const [localLectures, setLocalLectures] = useState<ZoomLecture[]>(lectures)
  const [localFolders, setLocalFolders] = useState<ContentFolder[]>(folders)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const supabase = createClient()

  // ── Folder filtering ────────────────────────────────────────
  const filteredLectures = selectedFolderId
    ? localLectures.filter((l) => l.folder_id === selectedFolderId)
    : localLectures

  const filteredSurveys = selectedFolderId
    ? localSurveys.filter((s) => s.folder_id === selectedFolderId)
    : localSurveys

  const allItems = [
    ...filteredLectures.map((l) => ({
      type: 'lecture' as const,
      item: l,
      date: l.start_time ?? l.created_at,
    })),
    ...filteredSurveys.map((s) => ({
      type: 'survey' as const,
      item: s,
      date: s.created_at,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // ── Zoom sync ───────────────────────────────────────────────
  const handleZoomSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/zoom/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohortId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '동기화 실패')
      setSyncMsg(`✅ ${data.synced}개 강의가 동기화되었습니다.`)
      const lecturesRes = await fetch(`/api/zoom/lectures?cohortId=${cohortId}`)
      if (lecturesRes.ok) {
        const { lectures: fresh } = await lecturesRes.json()
        setLocalLectures(fresh)
      } else {
        window.location.reload()
      }
    } catch (e: unknown) {
      setSyncMsg(`❌ ${e instanceof Error ? e.message : '동기화 실패'}`)
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 4000)
    }
  }

  // ── Folder creation ─────────────────────────────────────────
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    setCreatingFolder(true)
    const { data, error } = await supabase
      .from('content_folders')
      .insert({
        cohort_id: cohortId,
        name: newFolderName.trim(),
        order_index: localFolders.length,
      })
      .select()
      .single()
    if (!error && data) {
      setLocalFolders((prev) => [...prev, data as ContentFolder])
    }
    setNewFolderName('')
    setCreatingFolder(false)
    setCreateFolderOpen(false)
  }

  const selectedFolder = localFolders.find((f) => f.id === selectedFolderId)

  return (
    <div className="flex min-h-screen">
      {/* ── Left: Folder Panel ───────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 border-r border-gray-100 bg-white p-3 sticky top-0 h-screen overflow-y-auto">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
          폴더
        </p>
        <div className="space-y-0.5">
          {/* 전체 */}
          <button
            onClick={() => setSelectedFolderId(null)}
            className={cn(
              'flex items-center gap-2 px-2 py-2 w-full rounded-lg text-sm text-left transition-colors',
              !selectedFolderId
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            {!selectedFolderId ? (
              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            전체
            <span className="ml-auto text-xs text-gray-400">
              {localLectures.length + localSurveys.length}
            </span>
          </button>

          {/* Custom folders */}
          {localFolders.map((folder) => {
            const count =
              localLectures.filter((l) => l.folder_id === folder.id).length +
              localSurveys.filter((s) => s.folder_id === folder.id).length
            const isActive = selectedFolderId === folder.id
            return (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={cn(
                  'flex items-center gap-2 px-2 py-2 w-full rounded-lg text-sm text-left transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {isActive ? (
                  <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="truncate flex-1">{folder.name}</span>
                {count > 0 && (
                  <span className="text-xs text-gray-400 flex-shrink-0">{count}</span>
                )}
              </button>
            )
          })}

          {/* 폴더 추가 (admin only) */}
          {isAdmin && (
            <button
              onClick={() => setCreateFolderOpen(true)}
              className="flex items-center gap-2 px-2 py-2 w-full rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              폴더 추가
            </button>
          )}
        </div>
      </aside>

      {/* ── Right: Content Area ──────────────────────────────── */}
      <div className="flex-1 p-6">
        <Tabs defaultValue="all" className="flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedFolder ? selectedFolder.name : '콘텐츠'}
              </h1>
              <TabsList>
                <TabsTrigger value="all">전체</TabsTrigger>
                <TabsTrigger value="lectures">줌 강의</TabsTrigger>
                <TabsTrigger value="surveys">설문</TabsTrigger>
              </TabsList>
            </div>
            <div className="flex items-center gap-2 ml-6">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-gray-600"
                  onClick={handleZoomSync}
                  disabled={syncing}
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? '동기화 중...' : 'Zoom 동기화'}
                </Button>
              )}
              {isAdmin && (
                <Button
                  size="sm"
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => setSurveyModalOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  설문 추가
                </Button>
              )}
            </div>
          </div>

          {/* Sync status message */}
          {syncMsg && (
            <div className="mb-4 px-4 py-2 rounded-lg bg-gray-50 border text-sm text-gray-700">
              {syncMsg}
            </div>
          )}

          {/* All */}
          <TabsContent value="all">
            {allItems.length === 0 ? (
              <EmptyState message={selectedFolderId ? '이 폴더에 콘텐츠가 없습니다.' : '콘텐츠가 없습니다.'} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allItems.map(({ type, item }) =>
                  type === 'lecture' ? (
                    <ZoomLectureCard
                      key={`lecture-${item.id}`}
                      lecture={item as ZoomLecture}
                      isAdmin={isAdmin}
                      onDeleted={(id) => setLocalLectures((prev) => prev.filter((l) => l.id !== id))}
                      onUpdated={(updated) =>
                        setLocalLectures((prev) =>
                          prev.map((l) => (l.id === updated.id ? updated : l))
                        )
                      }
                    />
                  ) : (
                    <SurveyCard
                      key={`survey-${item.id}`}
                      survey={item as Survey}
                      isAdmin={isAdmin}
                      onDeleted={(id) => setLocalSurveys((prev) => prev.filter((s) => s.id !== id))}
                    />
                  )
                )}
              </div>
            )}
          </TabsContent>

          {/* Lectures */}
          <TabsContent value="lectures">
            {filteredLectures.length === 0 ? (
              <EmptyState message="아직 등록된 줌 강의가 없습니다." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLectures.map((lecture) => (
                  <ZoomLectureCard
                    key={lecture.id}
                    lecture={lecture}
                    isAdmin={isAdmin}
                    onDeleted={(id) => setLocalLectures((prev) => prev.filter((l) => l.id !== id))}
                    onUpdated={(updated) =>
                      setLocalLectures((prev) =>
                        prev.map((l) => (l.id === updated.id ? updated : l))
                      )
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Surveys */}
          <TabsContent value="surveys">
            {filteredSurveys.length === 0 ? (
              <EmptyState message="아직 등록된 설문이 없습니다." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSurveys.map((survey) => (
                  <SurveyCard
                    key={survey.id}
                    survey={survey}
                    isAdmin={isAdmin}
                    onDeleted={(id) => setLocalSurveys((prev) => prev.filter((s) => s.id !== id))}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Survey Modal */}
        <CreateSurveyModal
          cohortId={cohortId}
          open={surveyModalOpen}
          onClose={() => setSurveyModalOpen(false)}
          onCreated={(newSurvey) => setLocalSurveys((prev) => [newSurvey, ...prev])}
        />
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">폴더 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">폴더 이름</Label>
              <Input
                placeholder="예: 1주차, 줌 강의실, 만족도 설문"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                }}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateFolderOpen(false)}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleCreateFolder}
              disabled={creatingFolder || !newFolderName.trim()}
            >
              {creatingFolder ? '추가 중...' : '추가'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <p className="text-sm">{message}</p>
    </div>
  )
}
