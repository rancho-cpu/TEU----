'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell } from 'lucide-react'
import type { Notification } from '@/types'
import { NotificationsPanel } from './NotificationsPanel'

interface Props {
  cohortId: string
  currentUserId: string
}

export function NotificationBell({ cohortId, currentUserId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    const res = await fetch(`/api/notifications?cohortId=${cohortId}`)
    if (res.ok) {
      const json = await res.json()
      setNotifications(json.notifications ?? [])
    }
  }, [cohortId])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications, currentUserId])

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const handleOpen = async () => {
    setOpen((v) => !v)
    if (!open && unreadCount > 0) {
      // 모두 읽음 처리
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unreadIds }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        title="알림"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationsPanel
          cohortId={cohortId}
          notifications={notifications}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
