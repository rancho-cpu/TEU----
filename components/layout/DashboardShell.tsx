'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Cohort, Profile, Shortcut } from '@/types'
import { Sidebar } from './Sidebar'

interface DashboardShellProps {
  cohortId: string
  cohorts: Cohort[]
  shortcuts: Shortcut[]
  currentCohort: Cohort
  profile: Profile | null
  currentUserId: string
  children: React.ReactNode
}

export function DashboardShell({
  cohortId, cohorts, shortcuts, currentCohort, profile, currentUserId, children,
}: DashboardShellProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // 경로 변경 시 드로어 자동 닫기
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // 드로어 열렸을 때 body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 모바일 상단 바 */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3">
        <button
          onClick={() => setOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-700"
          aria-label="메뉴 열기"
        >
          <Menu className="w-5 h-5" />
        </button>
        <p className="text-sm font-semibold text-gray-800 truncate max-w-[60%]">{currentCohort.name ?? 'TEU'}</p>
        <div className="w-10" />
      </header>

      {/* 모바일 백드롭 */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 사이드바 (모바일: 드로어 / 데스크톱: sticky) */}
      <div
        className={cn(
          'fixed md:sticky md:top-0 inset-y-0 left-0 z-50 md:z-0',
          'transition-transform duration-300 md:transition-none',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="relative h-full">
          {/* 모바일 닫기 버튼 */}
          <button
            onClick={() => setOpen(false)}
            className="md:hidden absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5" />
          </button>
          <Sidebar
            cohortId={cohortId}
            cohorts={cohorts}
            shortcuts={shortcuts}
            currentCohort={currentCohort}
            profile={profile}
            currentUserId={currentUserId}
          />
        </div>
      </div>

      {/* 메인 */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 min-w-0">
        {children}
      </main>
    </div>
  )
}
