'use client'

import { useRouter } from 'next/navigation'
import { ChevronDown, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Cohort } from '@/types'
import { useState } from 'react'
import { CreateCohortDialog } from './CreateCohortDialog'

interface CohortSwitcherProps {
  cohorts: Cohort[]
  currentCohort: Cohort
}

export function CohortSwitcher({ cohorts, currentCohort }: CohortSwitcherProps) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors">
          <span className="truncate">{currentCohort.name}</span>
          <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          {cohorts.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onClick={() => router.push(`/${c.id}/contents`)}
              className={c.id === currentCohort.id ? 'font-semibold' : ''}
            >
              {c.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            새 기수 추가
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateCohortDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  )
}
