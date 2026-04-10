'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen, Users, BarChart2, Users2, Settings,
  ExternalLink, LogOut, Images,
} from 'lucide-react'
import type { Cohort, Shortcut } from '@/types'
import { CohortSwitcher } from './CohortSwitcher'

const navItems = [
  { href: 'contents',   label: '콘텐츠',      icon: BookOpen },
  { href: 'community',  label: '커뮤니티',     icon: Users },
  { href: 'photos',     label: '사진 게시판',  icon: Images },
  { href: 'statistics', label: '통계',         icon: BarChart2 },
  { href: 'members',    label: '구성원 목록',  icon: Users2 },
  { href: 'settings',   label: '설정',         icon: Settings },
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

interface SidebarProps {
  cohortId: string
  cohorts: Cohort[]
  shortcuts: Shortcut[]
  currentCohort: Cohort
}

export function Sidebar({ cohortId, cohorts, shortcuts, currentCohort }: SidebarProps) {
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
      dot: 'bg-violet-500',
    },
    currentCohort.kakao_url && {
      label: '카카오톡 채팅방',
      url: currentCohort.kakao_url,
      icon: KakaoIcon,
      style: 'text-yellow-600 hover:bg-yellow-50',
      dot: 'bg-yellow-400',
    },
  ].filter(Boolean) as {
    label: string
    url: string
    icon: React.FC<{ className?: string }>
    style: string
    dot: string
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

        {/* 외부 바로가기 메뉴 (Slido / 카카오) */}
        {externalLinks.length > 0 && (
          <div className="pt-2 border-t border-gray-100 mt-2 space-y-1">
            {externalLinks.map(({ label, url, icon: Icon, style }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  style
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                <ExternalLink className="w-3 h-3 opacity-50 flex-shrink-0" />
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* Shortcuts */}
      {shortcuts.length > 0 && (
        <div className="p-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">바로가기</p>
          <div className="space-y-1">
            {shortcuts.map((s) => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate">{s.label}</span>
                <ExternalLink className="w-3 h-3 ml-auto flex-shrink-0 text-gray-400" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="p-3 border-t border-gray-200">
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
