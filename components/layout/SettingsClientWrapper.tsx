'use client'

import { useState } from 'react'
import type { Cohort, Shortcut } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Settings,
  Link2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Pencil,
  Check,
  ExternalLink,
} from 'lucide-react'

const PRESET_COLORS = [
  { value: '#3b82f6', label: '파랑' },
  { value: '#10b981', label: '초록' },
  { value: '#f59e0b', label: '노랑' },
  { value: '#ef4444', label: '빨강' },
  { value: '#8b5cf6', label: '보라' },
]

interface SettingsClientWrapperProps {
  cohortId: string
  cohort: Cohort
  initialShortcuts: Shortcut[]
}

export function SettingsClientWrapper({
  cohortId,
  cohort,
  initialShortcuts,
}: SettingsClientWrapperProps) {
  const supabase = createClient()

  // Cohort info state
  const [name, setName] = useState(cohort.name)
  const [programName, setProgramName] = useState(cohort.program_name)
  const [description, setDescription] = useState(cohort.description ?? '')
  const [savingCohort, setSavingCohort] = useState(false)
  const [cohortSaved, setCohortSaved] = useState(false)
  const [cohortError, setCohortError] = useState<string | null>(null)

  // Shortcuts state
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(initialShortcuts)
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false)
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null)
  const [scLabel, setScLabel] = useState('')
  const [scUrl, setScUrl] = useState('')
  const [scColor, setScColor] = useState(PRESET_COLORS[0].value)
  const [savingShortcut, setSavingShortcut] = useState(false)
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleSaveCohort = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !programName.trim()) {
      setCohortError('기수 이름과 프로그램명은 필수입니다.')
      return
    }
    setSavingCohort(true)
    setCohortError(null)

    const { error } = await supabase
      .from('cohorts')
      .update({
        name: name.trim(),
        program_name: programName.trim(),
        description: description.trim() || null,
      })
      .eq('id', cohortId)

    if (error) {
      setCohortError('저장 중 오류가 발생했습니다.')
    } else {
      setCohortSaved(true)
      setTimeout(() => setCohortSaved(false), 2000)
    }
    setSavingCohort(false)
  }

  const openAddShortcut = () => {
    setEditingShortcut(null)
    setScLabel('')
    setScUrl('')
    setScColor(PRESET_COLORS[0].value)
    setShortcutError(null)
    setShortcutModalOpen(true)
  }

  const openEditShortcut = (sc: Shortcut) => {
    setEditingShortcut(sc)
    setScLabel(sc.label)
    setScUrl(sc.url)
    setScColor(sc.color)
    setShortcutError(null)
    setShortcutModalOpen(true)
  }

  const handleSaveShortcut = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scLabel.trim() || !scUrl.trim()) {
      setShortcutError('레이블과 URL은 필수입니다.')
      return
    }

    let url = scUrl.trim()
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url
    }

    setSavingShortcut(true)
    setShortcutError(null)

    if (editingShortcut) {
      // Update
      const { error } = await supabase
        .from('shortcuts')
        .update({ label: scLabel.trim(), url, color: scColor })
        .eq('id', editingShortcut.id)

      if (error) {
        setShortcutError('저장 중 오류가 발생했습니다.')
        setSavingShortcut(false)
        return
      }

      setShortcuts((prev) =>
        prev.map((s) =>
          s.id === editingShortcut.id
            ? { ...s, label: scLabel.trim(), url, color: scColor }
            : s
        )
      )
    } else {
      // Insert
      const maxOrder =
        shortcuts.length > 0 ? Math.max(...shortcuts.map((s) => s.order)) : 0

      const { data, error } = await supabase
        .from('shortcuts')
        .insert({
          cohort_id: cohortId,
          label: scLabel.trim(),
          url,
          color: scColor,
          order: maxOrder + 1,
        })
        .select()
        .single()

      if (error || !data) {
        setShortcutError('저장 중 오류가 발생했습니다.')
        setSavingShortcut(false)
        return
      }
      setShortcuts((prev) => [...prev, data as Shortcut])
    }

    setSavingShortcut(false)
    setShortcutModalOpen(false)
  }

  const handleDeleteShortcut = async (id: string) => {
    if (!confirm('이 바로가기를 삭제하시겠습니까?')) return
    setDeletingId(id)

    const { error } = await supabase.from('shortcuts').delete().eq('id', id)
    if (!error) {
      setShortcuts((prev) => prev.filter((s) => s.id !== id))
    }
    setDeletingId(null)
  }

  const moveShortcut = async (index: number, direction: 'up' | 'down') => {
    const newShortcuts = [...shortcuts]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newShortcuts.length) return

    const temp = newShortcuts[index]
    newShortcuts[index] = newShortcuts[targetIndex]
    newShortcuts[targetIndex] = temp

    // Update order values
    const updated = newShortcuts.map((s, i) => ({ ...s, order: i + 1 }))
    setShortcuts(updated)

    // Persist order changes
    await Promise.all(
      updated.map((s) =>
        supabase.from('shortcuts').update({ order: s.order }).eq('id', s.id)
      )
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        </div>
        <p className="text-sm text-gray-500">기수 정보와 바로가기를 관리합니다.</p>
      </div>

      {/* Cohort Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          기수 정보 수정
        </h2>

        <form onSubmit={handleSaveCohort} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="program-name" className="text-sm font-medium text-gray-700">
              프로그램명
            </Label>
            <Input
              id="program-name"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              placeholder="예: TEU 부트캠프"
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cohort-name" className="text-sm font-medium text-gray-700">
              기수 이름
            </Label>
            <Input
              id="cohort-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 1기"
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cohort-desc" className="text-sm font-medium text-gray-700">
              설명 <span className="text-gray-400 font-normal">(선택)</span>
            </Label>
            <Textarea
              id="cohort-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="기수에 대한 간략한 설명을 입력하세요"
              className="text-sm resize-none min-h-[80px]"
            />
          </div>

          {cohortError && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{cohortError}</p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={savingCohort} className="min-w-[100px]">
              {savingCohort ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  저장 중...
                </span>
              ) : cohortSaved ? (
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  저장됨
                </span>
              ) : (
                '변경사항 저장'
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Shortcuts */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            바로가기 관리
          </h2>
          <Button
            size="sm"
            onClick={openAddShortcut}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            추가
          </Button>
        </div>

        {shortcuts.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Link2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">아직 바로가기가 없습니다.</p>
            <p className="text-xs mt-1">자주 쓰는 링크를 추가해보세요.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {shortcuts.map((sc, index) => (
              <div
                key={sc.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors group"
              >
                {/* Color dot */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: sc.color }}
                />

                {/* Label + URL */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{sc.label}</p>
                  <a
                    href={sc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-400 hover:text-blue-500 truncate flex items-center gap-1 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {sc.url}
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => moveShortcut(index, 'up')}
                    disabled={index === 0}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => moveShortcut(index, 'down')}
                    disabled={index === shortcuts.length - 1}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700"
                    onClick={() => openEditShortcut(sc)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                    onClick={() => handleDeleteShortcut(sc.id)}
                    disabled={deletingId === sc.id}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shortcut Modal */}
      <Dialog open={shortcutModalOpen} onOpenChange={setShortcutModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-500" />
              {editingShortcut ? '바로가기 수정' : '바로가기 추가'}
            </DialogTitle>
          </DialogHeader>

          <Separator />

          <form onSubmit={handleSaveShortcut} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="sc-label" className="text-sm font-medium text-gray-700">
                레이블
              </Label>
              <Input
                id="sc-label"
                value={scLabel}
                onChange={(e) => setScLabel(e.target.value)}
                placeholder="예: 노션 페이지"
                className="text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sc-url" className="text-sm font-medium text-gray-700">
                URL
              </Label>
              <Input
                id="sc-url"
                value={scUrl}
                onChange={(e) => setScUrl(e.target.value)}
                placeholder="https://..."
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">색상</Label>
              <div className="flex gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setScColor(color.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      scColor === color.value
                        ? 'border-gray-800 scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            {shortcutError && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                {shortcutError}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShortcutModalOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={savingShortcut}>
                {savingShortcut ? '저장 중...' : editingShortcut ? '수정 완료' : '추가하기'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
