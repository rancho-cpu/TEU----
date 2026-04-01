'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { RefreshCw, Plus } from 'lucide-react'
import type { ZoomLecture, Survey } from '@/types'
import { ZoomLectureCard } from './ZoomLectureCard'
import { SurveyCard } from './SurveyCard'
import { CreateSurveyModal } from './CreateSurveyModal'

interface ContentsClientWrapperProps {
  cohortId: string
  lectures: ZoomLecture[]
  surveys: Survey[]
  isAdmin: boolean
}

export function ContentsClientWrapper({
  cohortId,
  lectures,
  surveys,
  isAdmin,
}: ContentsClientWrapperProps) {
  const [surveyModalOpen, setSurveyModalOpen] = useState(false)
  const [localSurveys, setLocalSurveys] = useState<Survey[]>(surveys)
  const [localLectures, setLocalLectures] = useState<ZoomLecture[]>(lectures)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const allItems = [
    ...localLectures.map((l) => ({ type: 'lecture' as const, item: l, date: l.start_time ?? l.created_at })),
    ...localSurveys.map((s) => ({ type: 'survey' as const, item: s, date: s.created_at })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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
      // Refresh lectures from the server
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">콘텐츠</h1>
        <div className="flex items-center gap-2">
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

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList className="mb-6 bg-gray-100">
          <TabsTrigger value="all" className="data-[state=active]:bg-white">
            전체
          </TabsTrigger>
          <TabsTrigger value="lectures" className="data-[state=active]:bg-white">
            줌 강의실
          </TabsTrigger>
          <TabsTrigger value="surveys" className="data-[state=active]:bg-white">
            만족도 조사 설문
          </TabsTrigger>
        </TabsList>

        {/* All */}
        <TabsContent value="all">
          {allItems.length === 0 ? (
            <EmptyState message="콘텐츠가 없습니다." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allItems.map(({ type, item }) =>
                type === 'lecture' ? (
                  <ZoomLectureCard key={`lecture-${item.id}`} lecture={item as ZoomLecture} isAdmin={isAdmin}
                    onDeleted={(id) => setLocalLectures((prev) => prev.filter((l) => l.id !== id))}
                    onUpdated={(updated) => setLocalLectures((prev) => prev.map((l) => l.id === updated.id ? updated : l))}
                  />
                ) : (
                  <SurveyCard key={`survey-${item.id}`} survey={item as Survey} isAdmin={isAdmin} />
                )
              )}
            </div>
          )}
        </TabsContent>

        {/* Lectures */}
        <TabsContent value="lectures">
          {localLectures.length === 0 ? (
            <EmptyState message="아직 등록된 줌 강의가 없습니다." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {localLectures.map((lecture) => (
                <ZoomLectureCard key={lecture.id} lecture={lecture} isAdmin={isAdmin}
                  onDeleted={(id) => setLocalLectures((prev) => prev.filter((l) => l.id !== id))}
                  onUpdated={(updated) => setLocalLectures((prev) => prev.map((l) => l.id === updated.id ? updated : l))}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Surveys */}
        <TabsContent value="surveys">
          {localSurveys.length === 0 ? (
            <EmptyState message="아직 등록된 설문이 없습니다." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {localSurveys.map((survey) => (
                <SurveyCard key={survey.id} survey={survey} isAdmin={isAdmin} />
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
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <p className="text-sm">{message}</p>
    </div>
  )
}
