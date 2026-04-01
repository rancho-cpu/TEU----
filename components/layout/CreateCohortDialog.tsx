'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface CreateCohortDialogProps {
  open: boolean
  onClose: () => void
}

export function CreateCohortDialog({ open, onClose }: CreateCohortDialogProps) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [programName, setProgramName] = useState('TEU MED')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)

    const { data, error } = await supabase
      .from('cohorts')
      .insert({ name: name.trim(), program_name: programName.trim(), description: description.trim() || null })
      .select('id')
      .single()

    setLoading(false)
    if (!error && data) {
      onClose()
      setName('')
      setDescription('')
      router.push(`/${data.id}/contents`)
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 기수 추가</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>프로그램명</Label>
            <Input value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="TEU MED" />
          </div>
          <div className="space-y-2">
            <Label>기수명 *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="TEU MED 6기" />
          </div>
          <div className="space-y-2">
            <Label>설명</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="기수 소개..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button onClick={handleCreate} disabled={loading || !name.trim()}>
              {loading ? '생성 중...' : '생성'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
