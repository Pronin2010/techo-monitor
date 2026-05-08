'use client'

import { useState, useEffect } from 'react'
import type { MeshNode } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Save, Pencil } from 'lucide-react'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NodeFormState {
  name: string
  shortName: string
}

function nodeToForm(node: MeshNode): NodeFormState {
  return {
    name: node.name,
    shortName: node.shortName,
  }
}

interface NodeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingNode?: MeshNode | null
  onSubmit: (data: Record<string, unknown>) => Promise<void>
}

export default function NodeFormDialog({
  open,
  onOpenChange,
  editingNode,
  onSubmit,
}: NodeFormDialogProps) {
  const [form, setForm] = useState<NodeFormState>(
    editingNode ? nodeToForm(editingNode) : { name: '', shortName: '' }
  )
  const [loading, setLoading] = useState(false)

  // Reset form when dialog opens or editingNode changes
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setForm(editingNode ? nodeToForm(editingNode) : { name: '', shortName: '' })
    }
    onOpenChange(nextOpen)
  }

  const autoShortName = (name: string) => {
    if (!name) return ''
    return name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '').substring(0, 4).toUpperCase()
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) return

    setLoading(true)
    try {
      const data: Record<string, unknown> = {
        name: form.name.trim(),
        shortName: form.shortName.trim() || autoShortName(form.name),
      }

      await onSubmit(data)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Редактирование узла
          </DialogTitle>
          <DialogDescription>
            Измените имя узла «{editingNode?.name}»
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="node-name">Название</Label>
            <Input
              id="node-name"
              placeholder="Например: Base Station"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value
                setForm((prev) => ({
                  ...prev,
                  name,
                  shortName: prev.shortName || autoShortName(name),
                }))
              }}
            />
          </div>

          {/* Short name */}
          <div className="space-y-2">
            <Label htmlFor="node-short-name">Позывной</Label>
            <Input
              id="node-short-name"
              placeholder="BASE"
              maxLength={4}
              className="font-mono uppercase"
              value={form.shortName}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  shortName: e.target.value.toUpperCase(),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              До 4 символов. Автозаполняется из названия, если пусто.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !form.name.trim()}>
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
