'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen, Users, BarChart2, Users2, Settings,
  ExternalLink, LogOut, Images, ClipboardList, UserCircle2, BookMarked, CalendarCheck,
} from 'lucide-react'
import type { Cohort, Profile, Shortcut } from '@/types'
import { CohortSwitcher } from './CohortSwitcher'
import { NotificationBell } from '@/components/notifications/NotificationBell'

const navItems = [
  { href: 'contents',    label: '콘텐츠',      icon: BookOpen },
  { href: 'community',   label: '커뮤니티',    icon: Users },
  { href: 'assignments', label: '과제 제출',   icon: ClipboardList },
  { href: 'photos',      label: '사진 게시판', icon: Images },
  { href: 'materials',   label: '강연 자료',   icon: BookMarked },
  { href: 'attendance',  label: '출석',        icon: CalendarCheck },
  { href: 'statistics',  label: '통계',        icon: BarChart2 },
  { href: 'members',     label: '구성원 목록', icon: Users2 },
  { href: 'settings',    label: '설정',        icon: Settings },
]

// Slido SVG 아이콘
function SlidoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
    </svg>
  )
}

// 카카오톡 말풍선 SVG 아이콘
function KakaoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3C6.477 3 2 6.582 2 11c0 2.818 1.693 5.288 4.252 6.754l-.965 3.54a.25.25 0 0 0 .373.281L9.876 19.1A11.81 11.81 0 0 0 12 19c5.523 0 10-3.582 10-8S17.523 3 12 3z"/>
    </svg>
  )
}

// 인스타그램 SVG 아이콘
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
}

interface SidebarProps {
  cohortId: string
  cohorts: Cohort[]
  shortcuts: Shortcut[]
  currentCohort: Cohort
  profile?: Profile | null
  currentUserId?: string
}

export function Sidebar({ cohortId, cohorts, shortcuts, currentCohort, profile, currentUserId }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const externalLinks = [
    currentCohort.slido_url && {
      label: 'Slido 질문',
      url: currentCohort.slido_url,
      icon: SlidoIcon,
      style: 'text-violet-600 hover:bg-violet-50',
    },
    currentCohort.kakao_url && {
      label: '카카오톡 채팅방',
      url: currentCohort.kakao_url,
      icon: KakaoIcon,
      style: 'text-yellow-600 hover:bg-yellow-50',
    },
    currentCohort.instagram_url && {
      label: '인스타그램',
      url: currentCohort.instagram_url,
      icon: InstagramIcon,
      style: 'text-pink-600 hover:bg-pink-50',
    },
  ].filter(Boolean) as {
    label: string
    url: string
    icon: React.FC<{ className?: string }>
    style: string
  }[]

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Cohort Switcher */}
      <div className="p-4 border-b border-gray-200">
        <CohortSwitcher cohorts={cohorts} currentCohort={currentCohort} />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const fullPath = `/${cohortId}/${href}`
          const isActive = pathname.startsWith(fullPath)
          return (
            <Link
              key={href}
              href={fullPath}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}

      </nav>

      {/* 바로가기 (고정 서비스 + 커스텀 링크 통합) */}
      {(externalLinks.length > 0 || shortcuts.length > 0) && (
        <div className="p-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">바로가기</p>
          <div className="space-y-1">
            {externalLinks.map(({ label, url, icon: Icon, style }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  style
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate flex-1">{label}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-40" />
              </a>
            ))}
            {shortcuts.map((s) => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="truncate flex-1">{s.label}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0 text-gray-400" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Profile + Logout */}
      <div className="p-3 border-t border-gray-200 space-y-1">
        {currentUserId && (
          <div className="flex justify-end px-1 pb-1">
            <NotificationBell cohortId={cohortId} currentUserId={currentUserId} />
          </div>
        )}
        {/* 내 프로필 */}
        <Link
          href={`/${cohortId}/profile`}
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg w-full transition-colors group',
            pathname.startsWith(`/${cohortId}/profile`)
              ? 'bg-indigo-50 text-indigo-700'
              : 'hover:bg-gray-100'
          )}
        >
          {/* 아바타 */}
          <div className="w-7 h-7 rounded-full overflow-hidden bg-indigo-100 flex items-center justify-center flex-shrink-0 border border-white shadow-sm">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-indigo-600">
                {(profile?.name ?? profile?.email ?? '?').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate group-hover:text-gray-900">
              {profile?.name ?? '이름 미설정'}
            </p>
            <p className="text-xs text-gray-400 truncate">{profile?.email ?? ''}</p>
          </div>
          <UserCircle2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        </Link>

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
