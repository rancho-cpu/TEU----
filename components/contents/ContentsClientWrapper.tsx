'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import type { ZoomLecture } from '@/types'
import { ZoomLectureCard } from './ZoomLectureCard'

interface ContentsClientWrapperProps {
  cohortId: string
  lectures: ZoomLecture[]
  isAdmin: boolean
}

export function ContentsClientWrapper({
  cohortId,
  lectures,
  isAdmin,
}: ContentsClientWrapperProps) {
  const [localLectures, setLocalLectures] = useState<ZoomLecture[]>(lectures)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

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

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">콘텐츠</h1>
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
      </div>

      {syncMsg && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-gray-50 border text-sm text-gray-700">
          {syncMsg}
        </div>
      )}

      {localLectures.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-sm">아직 등록된 줌 강의가 없습니다.</p>
          {isAdmin && (
            <p className="text-sm mt-1 text-indigo-400">Zoom 동기화 버튼을 눌러 강의를 불러오세요.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {localLectures.map((lecture) => (
            <ZoomLectureCard
              key={lecture.id}
              lecture={lecture}
              isAdmin={isAdmin}
              onDeleted={(id) => setLocalLectures((prev) => prev.filter((l) => l.id !== id))}
              onUpdated={(updated) => setLocalLectures((prev) => prev.map((l) => l.id === updated.id ? updated : l))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
