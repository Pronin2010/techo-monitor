'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MeshNode } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Save, Pencil, Upload, Wifi, WifiOff } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

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
  const [pushToDevice, setPushToDevice] = useState(false)
  const [pushingToDevice, setPushingToDevice] = useState(false)
  const [bridgeOnline, setBridgeOnline] = useState(false)
  const { toast } = useToast()

  // Проверяем статус моста при открытии диалога
  useEffect(() => {
    if (open) {
      fetch('/api/meshtastic/bridge')
        .then(r => r.json())
        .then(data => setBridgeOnline(data.connected === true))
        .catch(() => setBridgeOnline(false))
    }
  }, [open])

  // Reset form when dialog opens or editingNode changes
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setForm(editingNode ? nodeToForm(editingNode) : { name: '', shortName: '' })
      setPushToDevice(false)
    }
    onOpenChange(nextOpen)
  }

  const autoShortName = (name: string) => {
    if (!name) return ''
    return name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '').substring(0, 4).toUpperCase()
  }

  /** Отправить имя на устройство через мост */
  const pushNameToDevice = useCallback(async (name: string, shortName: string) => {
    setPushingToDevice(true)
    try {
      // Определяем nodeId узла (hex-формат !a1b2c3d4 для удалённых, пустая строка для локального)
      let nodeId = ''
      if (editingNode) {
        // Конвертируем nodeId из числа в hex-формат
        const num = typeof editingNode.nodeId === 'bigint'
          ? Number(editingNode.nodeId)
          : Number(editingNode.nodeId)
        if (num > 0) {
          nodeId = `!${num.toString(16).padStart(8, '0')}`
        }
      }

      const resp = await fetch('/api/meshtastic/set-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          deviceName: name,
          deviceShortName: shortName,
        }),
      })
      const result = await resp.json()
      if (result.success) {
        toast({
          title: 'Имя установлено на устройстве',
          description: result.message,
        })
      } else {
        toast({
          title: 'Ошибка установки имени',
          description: result.message,
          variant: 'destructive',
        })
      }
      return result.success
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось подключиться к мосту',
        variant: 'destructive',
      })
      return false
    } finally {
      setPushingToDevice(false)
    }
  }, [editingNode, toast])

  const handleSubmit = async () => {
    if (!form.name.trim()) return

    setLoading(true)
    try {
      const name = form.name.trim()
      const shortName = form.shortName.trim() || autoShortName(form.name)

      const data: Record<string, unknown> = {
        name,
        shortName,
      }

      // Сначала обновляем БД
      await onSubmit(data)

      // Если включена отправка на устройство — отправляем через мост
      if (pushToDevice) {
        await pushNameToDevice(name, shortName)
      }

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

          {/* Push to device */}
          <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
            <Checkbox
              id="push-to-device"
              checked={pushToDevice}
              onCheckedChange={(c) => setPushToDevice(c === true)}
              className="mt-0.5"
              disabled={!bridgeOnline}
            />
            <div className="space-y-1 flex-1">
              <Label
                htmlFor="push-to-device"
                className={`text-sm font-medium cursor-pointer flex items-center gap-1.5 ${!bridgeOnline ? 'opacity-50' : ''}`}
              >
                <Upload className="h-3.5 w-3.5" />
                Установить на устройстве
                {bridgeOnline ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-muted-foreground" />
                )}
              </Label>
              <p className="text-xs text-muted-foreground">
                {bridgeOnline
                  ? 'Имя будет отправлено на устройство через мост (setOwner). Устройство обновит имя без перезагрузки.'
                  : 'Мост не подключён — имя сохранится только в дашборде. Запустите мост для синхронизации с устройством.'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                ⚠️ Без этой опции имя меняется только в дашборде и будет перезаписано при следующей синхронизации с устройством.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || pushingToDevice || !form.name.trim()}
          >
            {loading || pushingToDevice ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
            ) : pushToDevice ? (
              <Upload className="h-4 w-4 mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {pushingToDevice ? 'Отправка...' : pushToDevice ? 'Сохранить и установить' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
