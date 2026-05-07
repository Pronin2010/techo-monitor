'use client'

import { useState, useEffect } from 'react'
import type { MeshNode, NodeRole, NodeStatus } from '@/lib/types'
import { ROLE_META } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Save, Pencil, Cpu, MapPin, Moon, Sun, Repeat, EyeOff, AlertTriangle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLES: { value: NodeRole; label: string; description: string; sleeps: boolean; relays: boolean }[] = [
  { value: 'ROUTER',   label: 'Маршрутизатор', description: 'Ретранслирует пакеты, всегда бодрствует', sleeps: false, relays: true },
  { value: 'REPEATER', label: 'Ретранслятор',  description: 'Только ретрансляция, всегда бодрствует', sleeps: false, relays: true },
  { value: 'CLIENT',   label: 'Клиент',        description: 'Обычный узел с экраном', sleeps: true, relays: true },
  { value: 'TRACKER',  label: 'Трекер',        description: 'GPS-трекинг, спит для экономии батареи', sleeps: true, relays: false },
]

const SLEEP_PRESETS = [
  { label: '30 сек (частое обновление)', value: 30 },
  { label: '1 мин', value: 60 },
  { label: '5 мин (рекомендуется для леса)', value: 300 },
  { label: '15 мин', value: 900 },
  { label: '30 мин', value: 1800 },
  { label: '1 час (макс. автономность)', value: 3600 },
]

const STATUSES: { value: NodeStatus; label: string }[] = [
  { value: 'online', label: 'В сети' },
  { value: 'offline', label: 'Не в сети' },
  { value: 'unknown', label: 'Неизвестно' },
]

// ---------------------------------------------------------------------------
// Form state type
// ---------------------------------------------------------------------------

interface NodeFormState {
  name: string
  shortName: string
  role: NodeRole
  status: NodeStatus
  batteryLevel: number
  voltage: number
  snr: number
  rssi: number
  latitude: string
  longitude: string
  altitude: string
  lsSecs: string
  minWakeSecs: string
}

const defaultForm: NodeFormState = {
  name: '',
  shortName: '',
  role: 'TRACKER',
  status: 'unknown',
  batteryLevel: 100,
  voltage: 3.7,
  snr: 0,
  rssi: 0,
  latitude: '',
  longitude: '',
  altitude: '',
  lsSecs: '300',
  minWakeSecs: '10',
}

function nodeToForm(node: MeshNode): NodeFormState {
  return {
    name: node.name,
    shortName: node.shortName,
    role: node.role,
    status: node.status,
    batteryLevel: node.batteryLevel,
    voltage: node.voltage,
    snr: node.snr,
    rssi: node.rssi,
    latitude: node.latitude != null ? String(node.latitude) : '',
    longitude: node.longitude != null ? String(node.longitude) : '',
    altitude: node.altitude != null ? String(node.altitude) : '',
    lsSecs: node.lsSecs != null ? String(node.lsSecs) : '300',
    minWakeSecs: node.minWakeSecs != null ? String(node.minWakeSecs) : '10',
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NodeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingNode?: MeshNode | null
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  nextNodeId?: number
}

export default function NodeFormDialog({
  open,
  onOpenChange,
  editingNode,
  onSubmit,
  nextNodeId,
}: NodeFormDialogProps) {
  const isEdit = !!editingNode
  const [form, setForm] = useState<NodeFormState>(
    editingNode ? nodeToForm(editingNode) : { ...defaultForm }
  )
  const [loading, setLoading] = useState(false)

  const currentRole = ROLES.find(r => r.value === form.role)
  const roleSleeps = currentRole?.sleeps ?? false
  const roleRelays = currentRole?.relays ?? true

  // Reset form when dialog opens/closes or editingNode changes
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setForm(editingNode ? nodeToForm(editingNode) : { ...defaultForm })
    }
    onOpenChange(nextOpen)
  }

  // When role changes, reset sleep settings accordingly
  const [prevRole, setPrevRole] = useState(form.role)
  useEffect(() => {
    if (prevRole !== form.role) {
      setPrevRole(form.role)
      const meta = ROLE_META[form.role]
      if (!meta?.sleeps) {
        setForm(f => ({ ...f, lsSecs: '', minWakeSecs: '' }))
      } else {
        setForm(f => ({
          ...f,
          lsSecs: f.lsSecs || '300',
          minWakeSecs: f.minWakeSecs || '10',
        }))
      }
    }
  }, [form.role, prevRole])

  const autoShortName = (name: string) => {
    if (!name) return ''
    return name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '').substring(0, 4).toUpperCase()
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) return

    setLoading(true)
    try {
      const lat = form.latitude ? parseFloat(form.latitude) : null
      const lng = form.longitude ? parseFloat(form.longitude) : null
      const alt = form.altitude ? parseFloat(form.altitude) : null
      const lsSecs = roleSleeps && form.lsSecs ? parseInt(form.lsSecs) || null : null
      const minWakeSecs = roleSleeps && form.minWakeSecs ? parseInt(form.minWakeSecs) || 10 : null

      const data: Record<string, unknown> = {
        name: form.name.trim(),
        shortName: form.shortName.trim() || autoShortName(form.name),
        role: form.role,
        status: form.status,
        batteryLevel: form.batteryLevel,
        voltage: form.voltage,
        snr: form.snr,
        rssi: form.rssi,
        latitude: lat,
        longitude: lng,
        altitude: alt,
        lsSecs,
        minWakeSecs,
      }

      if (!isEdit) {
        data.nodeId = nextNodeId ?? Math.floor(Math.random() * 9000) + 1000
      }

      await onSubmit(data)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? (
              <>
                <Pencil className="h-5 w-5" />
                Редактирование узла
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Новый узел T-Echo
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Измените параметры узла «${editingNode?.name}»`
              : 'Добавьте новое устройство в вашу Meshtastic сеть'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="node-name">Название узла</Label>
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

          {/* Short name + Role */}
          <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, role: v as NodeRole }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{r.label}</span>
                        <span className="text-xs text-muted-foreground">
                          — {r.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Role behavior summary */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              roleSleeps
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            }`}>
              {roleSleeps ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              {roleSleeps ? 'Спит' : 'Бодрствует'}
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              roleRelays
                ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              {roleRelays ? <Repeat className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {roleRelays ? 'Ретранслирует' : 'Только свои данные'}
            </div>
          </div>

          {/* Sleep settings - only for sleeping roles */}
          {roleSleeps && (
            <div className="space-y-3 p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/50">
              <div className="flex items-center gap-1.5 text-sm font-medium text-purple-700 dark:text-purple-300">
                <Moon className="h-4 w-4" />
                Настройки сна
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="node-ls-secs" className="text-xs">
                    Интервал сна (сек)
                  </Label>
                  <Select
                    value={SLEEP_PRESETS.some(p => p.value === parseInt(form.lsSecs)) ? form.lsSecs : 'custom'}
                    onValueChange={(v) => {
                      if (v !== 'custom') {
                        setForm(prev => ({ ...prev, lsSecs: v }))
                      }
                    }}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SLEEP_PRESETS.map(p => (
                        <SelectItem key={p.value} value={String(p.value)} className="text-xs">
                          {p.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom" className="text-xs">
                        Свой вариант...
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="node-ls-secs"
                    type="number"
                    min={5}
                    placeholder="300"
                    value={form.lsSecs}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lsSecs: e.target.value }))
                    }
                    className="text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Meshtastic: <code className="bg-background px-1 rounded">power.ls_secs</code>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="node-min-wake" className="text-xs">
                    Время бодрствования (сек)
                  </Label>
                  <Input
                    id="node-min-wake"
                    type="number"
                    min={1}
                    placeholder="10"
                    value={form.minWakeSecs}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, minWakeSecs: e.target.value }))
                    }
                    className="text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Сколько секунд узел бодрствует перед тем как снова заснуть
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Meshtastic: <code className="bg-background px-1 rounded">power.min_wake_secs</code>
                  </p>
                </div>
              </div>

              {/* Mesh impact warning */}
              <Alert className="border-amber-200/50 bg-amber-50/50 dark:bg-amber-950/20">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <AlertDescription className="text-[10px] text-amber-800 dark:text-amber-200">
                  Спящий трекер <strong>не ретранслирует</strong> чужие пакеты.
                  Для mesh-связи нужны всегда бодрствующие узлы (ROUTER / REPEATER).
                  Рекомендуется устанавливать <strong>разные интервалы сна</strong> на разных трекерах,
                  чтобы увеличить шанс одновременного бодрствования.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* REPEATER notice */}
          {form.role === 'REPEATER' && (
            <Alert className="border-amber-200/50 bg-amber-50/50 dark:bg-amber-950/20">
              <Sun className="h-3.5 w-3.5 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                Ретранслятор <strong>не спит</strong> и <strong>не имеет экрана</strong>. Он только пересылает пакеты
                между другими узлами. Идеально для установки на возвышенности (холм, дерево) с солнечной панелью
                или мощной батареей. Заполняет пробелы в mesh-сети между спящими трекерами.
              </AlertDescription>
            </Alert>
          )}

          {/* ROUTER notice */}
          {form.role === 'ROUTER' && (
            <Alert className="border-teal-200/50 bg-teal-50/50 dark:bg-teal-950/20">
              <Repeat className="h-3.5 w-3.5 text-teal-600" />
              <AlertDescription className="text-xs text-teal-800 dark:text-teal-200">
                Маршрутизатор — ядро сети. <strong>Всегда бодрствует и ретранслирует</strong> все пакеты.
                Рекомендуется подключить к питанию (USB / сеть) для постоянной работы.
              </AlertDescription>
            </Alert>
          )}

          {/* Status */}
          <div className="space-y-2">
            <Label>Статус</Label>
            <Select
              value={form.status}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, status: v as NodeStatus }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Battery + Voltage */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="node-battery">Батарея (%)</Label>
              <Input
                id="node-battery"
                type="number"
                min={0}
                max={100}
                value={form.batteryLevel}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    batteryLevel: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="node-voltage">Напряжение (В)</Label>
              <Input
                id="node-voltage"
                type="number"
                step="0.01"
                min={0}
                value={form.voltage}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    voltage: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>

          {/* SNR + RSSI */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="node-snr">SNR (дБ)</Label>
              <Input
                id="node-snr"
                type="number"
                step="0.1"
                value={form.snr}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    snr: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="node-rssi">RSSI (дБм)</Label>
              <Input
                id="node-rssi"
                type="number"
                value={form.rssi}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    rssi: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>

          <Separator />

          {/* Position */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Позиция (опционально)
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Широта (55.7558)"
                value={form.latitude}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, latitude: e.target.value }))
                }
              />
              <Input
                placeholder="Долгота (37.6173)"
                value={form.longitude}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, longitude: e.target.value }))
                }
              />
            </div>
            <Input
              placeholder="Высота (м)"
              value={form.altitude}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, altitude: e.target.value }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !form.name.trim()}>
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
            ) : isEdit ? (
              <Save className="h-4 w-4 mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {isEdit ? 'Сохранить' : 'Добавить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
