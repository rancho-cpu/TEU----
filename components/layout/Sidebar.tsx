'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen, Users, Flame, BarChart2, Users2, Settings,
  ExternalLink, LogOut
} from 'lucide-react'
import type { Cohort, Shortcut } from '@/types'
import { CohortSwitcher } from './CohortSwitcher'

const navItems = [
  { href: 'contents',   label: '콘텐츠',      icon: BookOpen },
  { href: 'community',  label: '커뮤니티',     icon: Users },
  { href: 'challenges', label: '챌린지',       icon: Flame },
  { href: 'statistics', label: '통계',         icon: BarChart2 },
  { href: 'members',    label: '구성원 목록',  icon: Users2 },
  { href: 'settings',   label: '설정',         icon: Settings },
]

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
