'use client'

import { useRouter } from 'next/navigation'
import type { Notification } from '@/types'
import { Bell, Clock, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  cohortId: string
  notifications: Notification[]
  onClose: () => void
}

function formatRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return `${Math.floor(hr / 24)}일 전`
}

export function NotificationsPanel({ cohortId, notifications, onClose }: Props) {
  const router = useRouter()

  const handleClick = (n: Notification) => {
    onClose()
    if (n.type === 'deadline' && n.related_id) {
      router.push(`/${cohortId}/assignments`)
    }
  }

  return (
    <div className="w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-500" />알림
        </p>
        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          <CheckCheck className="w-3.5 h-3.5" />닫기
        </button>
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">알림이 없습니다.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
                    !n.is_read && 'bg-indigo-50/50'
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base flex-shrink-0 mt-0.5">
                      {n.type === 'deadline' ? '⏰' : '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm leading-snug',
                        !n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                      )}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                        {n.type === 'manual' && n.sender?.name && (
                          <span className="font-medium text-gray-500">{n.sender.name}</span>
                        )}
                        {n.type === 'manual' && n.sender?.name && <span>·</span>}
                        <Clock className="w-3 h-3" />
                        {formatRelative(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
