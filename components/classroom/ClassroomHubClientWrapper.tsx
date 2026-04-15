'use client'

import Link from 'next/link'
import { MonitorPlay, Video, CalendarCheck } from 'lucide-react'

interface Props {
  cohortId: string
}

export function ClassroomHubClientWrapper({ cohortId }: Props) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <MonitorPlay className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900">클래스룸 허브</h1>
        </div>
        <p className="text-sm text-gray-500">실시간 수업에 필요한 핵심 기능으로 빠르게 이동하세요.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={`/${cohortId}/contents`}
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-2 mb-1">
            <Video className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold text-gray-900">강의 콘텐츠</p>
          </div>
          <p className="text-xs text-gray-500">Zoom 강의 녹화와 설문/자료를 확인합니다.</p>
        </Link>

        <Link
          href={`/${cohortId}/attendance`}
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold text-gray-900">출석 현황</p>
          </div>
          <p className="text-xs text-gray-500">출석 세션과 체크인 결과를 확인합니다.</p>
        </Link>
      </div>
    </div>
  )
}
