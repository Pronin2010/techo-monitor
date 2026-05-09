'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Channel, ModemPreset, Region } from '@/lib/types'
import { ROLE_META, MODEM_PRESETS, REGIONS } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import {
  Plus, Copy, Download, Pencil, Trash2, CopyPlus, Terminal, FileText,
  Cpu, Radio, MapPin, Zap, Battery, Bluetooth, Monitor, Network,
  Link, Info, Shield,
} from 'lucide-react'

// ============================================================================
// Локальные типы
// ============================================================================

interface PresetData {
  id: string
  name: string
  description: string | null
  icon: string
  role: string
  nodeInfoBroadcastSecs: number
  powerSaving: boolean
  lsSecs: number
  minWakeSecs: number
  gpsMode: string
  gpsUpdateInterval: number
  agpsEnabled: boolean
  gpsAttemptTime: number
  positionPrecision: number
  positionBroadcastSecs: number
  smartBroadcastEnabled: boolean
  smartBroadcastMinDist: number
  smartBroadcastMinInterval: number
  telemetryInterval: number
  region: string
  modemPreset: string
  txPower: number
  hopLimit: number
  usePreamble: boolean
  bluetoothEnabled: boolean
  bluetoothFixedPin: string | null
  screenOnSecs: number
  ledDisabled: boolean
  rebroadcastMode: string
  channelId: string | null
  isBuiltIn: boolean
  channel?: Channel | null
  createdAt: string
  updatedAt: string
}

interface SettingsPresetsTabProps {
  channels: Channel[]
}

// ============================================================================
// Константы
// ============================================================================

/** Значения по умолчанию для нового пресета */
const DEFAULT_PRESET = {
  name: '',
  description: '',
  icon: '📡',
  role: 'TRACKER',
  nodeInfoBroadcastSecs: 900,
  powerSaving: false,
  lsSecs: 60,
  minWakeSecs: 10,
  gpsMode: 'ENABLED',
  gpsUpdateInterval: 30,
  agpsEnabled: false,
  gpsAttemptTime: 90,
  positionPrecision: 32,
  positionBroadcastSecs: 60,
  smartBroadcastEnabled: true,
  smartBroadcastMinDist: 20,
  smartBroadcastMinInterval: 60,
  telemetryInterval: 300,
  region: 'EU_433',
  modemPreset: 'LONG_MODERATE',
  txPower: 0,
  hopLimit: 5,
  usePreamble: false,
  bluetoothEnabled: true,
  bluetoothFixedPin: '',
  screenOnSecs: 60,
  ledDisabled: true,
  rebroadcastMode: 'ALL',
  channelId: null as string | null,
}

/** Режимы ретрансляции */
const REBROADCAST_MODES = [
  { value: 'ALL', label: 'Все пакеты (ALL)' },
  { value: 'LOCAL_SKIP', label: 'Пропускать прямых соседей (LOCAL_SKIP)' },
  { value: 'SIMPLE', label: 'Минимальная ретрансляция (SIMPLE)' },
]

/** GPS режимы */
const GPS_MODES = [
  { value: 'ENABLED', label: 'Включён (ENABLED)' },
  { value: 'DISABLED', label: 'Выключен (DISABLED)' },
  { value: 'NOT_PRESENT', label: 'Отсутствует (NOT_PRESENT)' },
]

/** Пресеты интервала вещания позиции */
const POSITION_BROADCAST_PRESETS = [
  { label: '30 сек', value: 30 },
  { label: '1 мин', value: 60 },
  { label: '5 мин', value: 300 },
  { label: '15 мин', value: 900 },
  { label: '30 мин', value: 1800 },
]

/** Пресеты интервала сна */
const SLEEP_PRESETS = [
  { label: '30 сек', value: 30 },
  { label: '1 мин', value: 60 },
  { label: '5 мин', value: 300 },
  { label: '15 мин', value: 900 },
  { label: '30 мин', value: 1800 },
]

/** Роли со спящим режимом */
const SLEEP_ROLES = new Set(['TRACKER', 'SENSOR', 'TAK_TRACKER'])

/** Пресеты таймаута экрана */
const SCREEN_TIMEOUT_PRESETS = [
  { label: '10 сек', value: 10 },
  { label: '30 сек', value: 30 },
  { label: '1 мин', value: 60 },
  { label: '2 мин', value: 120 },
  { label: '5 мин', value: 300 },
]

/** Пресеты точности позиции */
const POSITION_PRECISION_OPTIONS = [
  { value: 0, label: '0 — не передавать' },
  { value: 10, label: '10 — ~11 км' },
  { value: 11, label: '11 — ~5.5 км' },
  { value: 12, label: '12 — ~2.7 км' },
  { value: 13, label: '13 — ~1.4 км' },
  { value: 14, label: '14 — ~680 м' },
  { value: 15, label: '15 — ~340 м' },
  { value: 16, label: '16 — ~170 м' },
  { value: 17, label: '17 — ~85 м' },
  { value: 18, label: '18 — ~42 м' },
  { value: 19, label: '19 — ~21 м' },
  { value: 32, label: '32 — полная точность' },
]

/** Интервалы телеметрии */
const TELEMETRY_INTERVAL_PRESETS = [
  { label: '30 сек', value: 30 },
  { label: '1 мин', value: 60 },
  { label: '5 мин', value: 300 },
  { label: '10 мин', value: 600 },
  { label: '15 мин', value: 900 },
  { label: '30 мин', value: 1800 },
]

/** Интервалы вещания ноды */
const NODE_INFO_BROADCAST_PRESETS = [
  { label: '5 мин (300 сек)', value: 300 },
  { label: '10 мин (600 сек)', value: 600 },
  { label: '15 мин (900 сек)', value: 900 },
  { label: '30 мин (1800 сек)', value: 1800 },
  { label: '1 час (3600 сек)', value: 3600 },
]

// ============================================================================
// Вспомогательные функции
// ============================================================================

/** Оценка автономного времени работы (часы) для батареи 1000 мАч */
function estimateBatteryHours(preset: PresetData): number {
  const gpsCurrent = preset.gpsMode === 'ENABLED' ? 29 : 0 // мА
  const baseCurrent = 14 // мА: nRF52840 (~10) + LoRa средний (~3) + display (~1)

  if (preset.powerSaving && SLEEP_ROLES.has(preset.role)) {
    const wakeHours = preset.minWakeSecs / 3600
    const sleepHours = preset.lsSecs / 3600
    const wakeCurrent = baseCurrent + gpsCurrent // ~43 мА с GPS
    const sleepCurrent = 2 // мА при сне (GPS тоже спит)
    const cycleDuration = wakeHours + sleepHours
    const avgCurrent = (wakeHours * wakeCurrent + sleepHours * sleepCurrent) / cycleDuration
    return Math.round((1000 / avgCurrent) * 10) / 10
  }

  if (preset.role === 'ROUTER' || preset.role === 'ROUTER_LATE' || preset.role === 'CLIENT_BASE') {
    // ROUTER всегда бодрствует; +40мА за активную ретрансляцию
    // GPS NOT_PRESENT → gpsCurrent=0, иначе +29мА
    return Math.round((1000 / (baseCurrent + gpsCurrent + 40)) * 10) / 10 // ~54мА без GPS, ~83мА с GPS
  }

  // Без экономии: GPS включён постоянно
  return Math.round((1000 / (baseCurrent + gpsCurrent)) * 10) / 10 // ~43мА с GPS = ~23ч
}

/** Форматирование часов автономной работы */
function formatBatteryLife(hours: number): string {
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const rem = Math.round(hours % 24)
    return rem > 0 ? `~${days} дн. ${rem} ч` : `~${days} дн.`
  }
  return `~${hours} ч`
}

/** Маскирование PSK для отображения */
function maskPsk(psk: string): string {
  if (!psk || psk.length <= 8) return '••••••••'
  return psk.substring(0, 4) + '••••' + psk.substring(psk.length - 4)
}

/** Найти метку модема по значению */
function getModemLabel(value: string): string {
  return MODEM_PRESETS.find(m => m.value === value)?.label ?? value
}

/** Найти метку региона по значению */
function getRegionLabel(value: string): string {
  return REGIONS.find(r => r.value === value)?.label ?? value
}

// ============================================================================
// Компонент
// ============================================================================

export default function SettingsPresetsTab({ channels }: SettingsPresetsTabProps) {
  const { toast } = useToast()

  // ── Состояние ──
  const [presets, setPresets] = useState<PresetData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPreset, setSelectedPreset] = useState<PresetData | null>(null)
  const [outputMode, setOutputMode] = useState<'commands' | 'yaml'>('commands')

  // ── Состояние диалога редактора ──
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<PresetData | null>(null)
  const [form, setForm] = useState(DEFAULT_PRESET)
  const [saving, setSaving] = useState(false)

  // ===========================================================================
  // Загрузка пресетов из API
  // ===========================================================================

  const fetchPresets = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/presets')
      if (!res.ok) throw new Error('Ошибка загрузки')
      const data = await res.json()
      setPresets(data)
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить пресеты', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchPresets()
  }, [fetchPresets])

  // ===========================================================================
  // Обработчики формы
  // ===========================================================================

  const updateField = useCallback(<K extends keyof typeof DEFAULT_PRESET>(
    key: K,
    value: (typeof DEFAULT_PRESET)[K]
  ) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  /** При выборе канала в редакторе — автозаполнение region и modemPreset */
  const handleChannelSelectInEditor = useCallback((channelId: string) => {
    if (!channelId || channelId === 'none') {
      updateField('channelId', null)
      return
    }
    const ch = channels.find(c => c.id === channelId)
    if (!ch) return
    setForm(prev => ({
      ...prev,
      channelId: ch.id,
      region: ch.region,
      modemPreset: ch.modemPreset,
    }))
    toast({
      title: `Канал: ${ch.name}`,
      description: 'Регион и модем пресет подтянуты из канала',
    })
  }, [channels, toast, updateField])

  // ===========================================================================
  // CRUD операции
  // ===========================================================================

  /** Открыть редактор для нового пресета */
  const handleCreate = useCallback(() => {
    setEditingPreset(null)
    setForm(DEFAULT_PRESET)
    setEditorOpen(true)
  }, [])

  /** Открыть редактор для существующего пресета */
  const handleEdit = useCallback((preset: PresetData) => {
    if (preset.isBuiltIn) return
    setEditingPreset(preset)
    setForm({
      name: preset.name,
      description: preset.description ?? '',
      icon: preset.icon,
      role: preset.role,
      nodeInfoBroadcastSecs: preset.nodeInfoBroadcastSecs,
      powerSaving: preset.powerSaving,
      lsSecs: preset.lsSecs,
      minWakeSecs: preset.minWakeSecs,
      gpsMode: preset.gpsMode,
      gpsUpdateInterval: preset.gpsUpdateInterval,
      agpsEnabled: preset.agpsEnabled,
      gpsAttemptTime: preset.gpsAttemptTime,
      positionPrecision: preset.positionPrecision,
      positionBroadcastSecs: preset.positionBroadcastSecs,
      smartBroadcastEnabled: preset.smartBroadcastEnabled,
      smartBroadcastMinDist: preset.smartBroadcastMinDist,
      smartBroadcastMinInterval: preset.smartBroadcastMinInterval,
      telemetryInterval: preset.telemetryInterval,
      region: preset.region,
      modemPreset: preset.modemPreset,
      txPower: preset.txPower,
      hopLimit: preset.hopLimit,
      usePreamble: preset.usePreamble,
      bluetoothEnabled: preset.bluetoothEnabled,
      bluetoothFixedPin: preset.bluetoothFixedPin ?? '',
      screenOnSecs: preset.screenOnSecs,
      ledDisabled: preset.ledDisabled,
      rebroadcastMode: preset.rebroadcastMode,
      channelId: preset.channelId,
    })
    setEditorOpen(true)
  }, [])

  /** Сохранить пресет (создание или обновление) */
  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      toast({ title: 'Ошибка', description: 'Укажите название пресета', variant: 'destructive' })
      return
    }

    try {
      setSaving(true)
      const payload = { ...form, bluetoothFixedPin: form.bluetoothFixedPin || null, description: form.description || null }

      if (editingPreset) {
        // Обновление
        const res = await fetch('/api/presets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingPreset.id, ...payload }),
        })
        if (!res.ok) throw new Error('Ошибка обновления')
        toast({ title: 'Сохранено', description: `Пресет «${form.name}» обновлён` })
      } else {
        // Создание
        const res = await fetch('/api/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Ошибка создания')
        toast({ title: 'Создано', description: `Пресет «${form.name}» создан` })
      }

      setEditorOpen(false)
      fetchPresets()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить пресет', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [form, editingPreset, toast, fetchPresets])

  /** Удалить пресет */
  const handleDelete = useCallback(async (preset: PresetData) => {
    if (preset.isBuiltIn) return
    try {
      const res = await fetch(`/api/presets?id=${preset.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Ошибка удаления')
      toast({ title: 'Удалено', description: `Пресет «${preset.name}» удалён` })
      if (selectedPreset?.id === preset.id) setSelectedPreset(null)
      fetchPresets()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось удалить пресет', variant: 'destructive' })
    }
  }, [selectedPreset, toast, fetchPresets])

  /** Дублировать пресет */
  const handleDuplicate = useCallback(async (preset: PresetData) => {
    try {
      const payload = {
        ...DEFAULT_PRESET,
        name: `${preset.name} (копия)`,
        description: preset.description,
        icon: preset.icon,
        role: preset.role,
        nodeInfoBroadcastSecs: preset.nodeInfoBroadcastSecs,
        powerSaving: preset.powerSaving,
        lsSecs: preset.lsSecs,
        minWakeSecs: preset.minWakeSecs,
        gpsMode: preset.gpsMode,
        gpsUpdateInterval: preset.gpsUpdateInterval,
        agpsEnabled: preset.agpsEnabled,
        gpsAttemptTime: preset.gpsAttemptTime,
        positionPrecision: preset.positionPrecision,
        positionBroadcastSecs: preset.positionBroadcastSecs,
        smartBroadcastEnabled: preset.smartBroadcastEnabled,
        smartBroadcastMinDist: preset.smartBroadcastMinDist,
        smartBroadcastMinInterval: preset.smartBroadcastMinInterval,
        telemetryInterval: preset.telemetryInterval,
        region: preset.region,
        modemPreset: preset.modemPreset,
        txPower: preset.txPower,
        hopLimit: preset.hopLimit,
        usePreamble: preset.usePreamble,
        bluetoothEnabled: preset.bluetoothEnabled,
        bluetoothFixedPin: preset.bluetoothFixedPin,
        screenOnSecs: preset.screenOnSecs,
        ledDisabled: preset.ledDisabled,
        rebroadcastMode: preset.rebroadcastMode,
        channelId: preset.channelId,
      }
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Ошибка дублирования')
      toast({ title: 'Дублировано', description: `Пресет «${preset.name}» скопирован` })
      fetchPresets()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось дублировать пресет', variant: 'destructive' })
    }
  }, [toast, fetchPresets])

  /** Применить пресет — загрузить в генератор команд */
  const handleApply = useCallback((preset: PresetData) => {
    setSelectedPreset(preset)
    toast({ title: 'Пресет применён', description: `«${preset.name}» — команды сгенерированы` })
  }, [toast])

  // ===========================================================================
  // Генерация команд (аналог device-setup-tab.tsx)
  // ===========================================================================

  const commandOutput = useMemo(() => {
    if (!selectedPreset) return { commands: '', yaml: '' }

    const p = selectedPreset
    const cmd = 'python -m meshtastic'
    const lines: string[] = []

    // --- Заголовок ---
    lines.push(`# Пресет: ${p.name}`)
    if (p.description) lines.push(`# ${p.description}`)
    lines.push('')

    // --- Device ---
    lines.push(`${cmd} --set device.role ${p.role}`)
    lines.push(`${cmd} --set device.node_info_broadcast_secs ${p.nodeInfoBroadcastSecs}`)

    // --- LoRa ---
    lines.push(`${cmd} --set lora.region ${p.region}`)
    lines.push(`${cmd} --set lora.modem_preset ${p.modemPreset}`)
    lines.push(`${cmd} --set lora.tx_power ${p.txPower}`)
    lines.push(`${cmd} --set lora.use_preamble ${p.usePreamble}`)

    // --- Network ---
    lines.push(`${cmd} --set network.hop_limit ${p.hopLimit}`)
    lines.push(`${cmd} --set network.rebroadcast_mode ${p.rebroadcastMode}`)

    // --- Power ---
    lines.push(`${cmd} --set power.is_power_saving ${p.powerSaving}`)
    if (SLEEP_ROLES.has(p.role)) {
      lines.push(`${cmd} --set power.ls_secs ${p.lsSecs}`)
      lines.push(`${cmd} --set power.min_wake_secs ${p.minWakeSecs}`)
    }

    // --- Position ---
    lines.push(`${cmd} --set position.gps_mode ${p.gpsMode}`)
    if (p.gpsMode === 'ENABLED') {
      lines.push(`${cmd} --set position.gps_update_interval ${p.gpsUpdateInterval}`)
      // GPS attempt time (только если GPS включён и не дефолт)
      if (p.gpsAttemptTime > 0 && p.gpsAttemptTime !== 90) {
        lines.push(`${cmd} --set position.gps_attempt_time ${p.gpsAttemptTime}`)
      }
    }
    // AGNSS (только для клиентов с телефоном)
    if (p.agpsEnabled) {
      lines.push(`${cmd} --set gps.agps_enabled true`)
    }
    // Position precision
    lines.push(`${cmd} --set position.position_precision ${p.positionPrecision}`)
    lines.push(`${cmd} --set position.position_broadcast_secs ${p.positionBroadcastSecs}`)
    if (p.smartBroadcastEnabled) {
      lines.push(`${cmd} --set position.broadcast_smart_minimum_distance ${p.smartBroadcastMinDist}`)
      lines.push(`${cmd} --set position.broadcast_smart_minimum_interval_secs ${p.smartBroadcastMinInterval}`)
    }

    // --- Bluetooth ---
    lines.push(`${cmd} --set bluetooth.enabled ${p.bluetoothEnabled}`)
    if (p.bluetoothEnabled && p.bluetoothFixedPin) {
      lines.push(`${cmd} --set bluetooth.fixed_pin "${p.bluetoothFixedPin}"`)
    }

    // --- Display ---
    lines.push(`${cmd} --set display.screen_on_secs ${p.screenOnSecs}`)

    // --- Telemetry ---
    lines.push(`${cmd} --set telemetry.device_update_interval ${p.telemetryInterval}`)

    // --- LED ---
    if (p.ledDisabled) {
      lines.push(`${cmd} --set led.disabled true`)
    }

    // --- Канал (если привязан) ---
    const linkedChannel = p.channel ?? (p.channelId ? channels.find(c => c.id === p.channelId) : null)
    if (linkedChannel) {
      lines.push('')
      lines.push('# Настройка канала')
      lines.push(`${cmd} --ch-index 0 --ch-set psk "base64:${linkedChannel.psk}"`)
      lines.push(`${cmd} --ch-index 0 --ch-set name "${linkedChannel.name}"`)
      lines.push(`${cmd} --ch-index 0 --ch-set uplink_enabled ${linkedChannel.uplink}`)
      lines.push(`${cmd} --ch-index 0 --ch-set downlink_enabled ${linkedChannel.downlink}`)
      if (linkedChannel.frequency) {
        lines.push(`${cmd} --ch-index 0 --ch-set frequency ${linkedChannel.frequency}`)
      }
    }

    // --- YAML ---
    const ylines: string[] = []
    ylines.push('# Meshtastic T-Echo Configuration')
    ylines.push(`# Пресет: ${p.name}`)
    if (p.description) ylines.push(`# ${p.description}`)
    ylines.push('# Прошивка 2.7.15 | Использование: python -m meshtastic --configure config.yaml')
    ylines.push('')
    ylines.push('config:')
    ylines.push('  device:')
    ylines.push(`    role: ${p.role}`)
    ylines.push(`    node_info_broadcast_secs: ${p.nodeInfoBroadcastSecs}`)
    ylines.push('  lora:')
    ylines.push(`    region: ${p.region}`)
    ylines.push(`    modem_preset: ${p.modemPreset}`)
    ylines.push(`    tx_power: ${p.txPower}`)
    ylines.push(`    use_preamble: ${p.usePreamble}`)
    ylines.push('  network:')
    ylines.push(`    hop_limit: ${p.hopLimit}`)
    ylines.push(`    rebroadcast_mode: ${p.rebroadcastMode}`)
    ylines.push('  power:')
    ylines.push(`    is_power_saving: ${p.powerSaving}`)
    if (SLEEP_ROLES.has(p.role)) {
      ylines.push(`    ls_secs: ${p.lsSecs}`)
      ylines.push(`    min_wake_secs: ${p.minWakeSecs}`)
    }
    ylines.push('  bluetooth:')
    ylines.push(`    enabled: ${p.bluetoothEnabled}`)
    if (p.bluetoothEnabled && p.bluetoothFixedPin) {
      ylines.push(`    fixed_pin: "${p.bluetoothFixedPin}"`)
    }
    ylines.push('  display:')
    ylines.push(`    screen_on_secs: ${p.screenOnSecs}`)
    ylines.push('  position:')
    ylines.push(`    gps_mode: ${p.gpsMode}`)
    if (p.gpsMode === 'ENABLED') {
      ylines.push(`    gps_update_interval: ${p.gpsUpdateInterval}`)
      if (p.gpsAttemptTime > 0 && p.gpsAttemptTime !== 90) {
        ylines.push(`    gps_attempt_time: ${p.gpsAttemptTime}`)
      }
    }
    if (p.agpsEnabled) {
      ylines.push('    agps_enabled: true')
    }
    ylines.push(`    position_precision: ${p.positionPrecision}`)
    ylines.push(`    position_broadcast_secs: ${p.positionBroadcastSecs}`)
    if (p.smartBroadcastEnabled) {
      ylines.push(`    broadcast_smart_minimum_distance: ${p.smartBroadcastMinDist}`)
      ylines.push(`    broadcast_smart_minimum_interval_secs: ${p.smartBroadcastMinInterval}`)
    }
    ylines.push('')
    ylines.push('module_config:')
    ylines.push('  telemetry:')
    ylines.push(`    device_update_interval: ${p.telemetryInterval}`)

    if (linkedChannel) {
      ylines.push('')
      ylines.push('# Каналы необходимо настроить отдельно командами:')
      ylines.push(`# python -m meshtastic --ch-index 0 --ch-set psk "base64:${linkedChannel.psk}"`)
      ylines.push(`# python -m meshtastic --ch-index 0 --ch-set name "${linkedChannel.name}"`)
      ylines.push(`# python -m meshtastic --ch-index 0 --ch-set uplink_enabled ${linkedChannel.uplink}`)
      ylines.push(`# python -m meshtastic --ch-index 0 --ch-set downlink_enabled ${linkedChannel.downlink}`)
      if (linkedChannel.frequency) {
        ylines.push(`# python -m meshtastic --ch-index 0 --ch-set frequency ${linkedChannel.frequency}`)
      }
    }

    return {
      commands: lines.join('\n'),
      yaml: ylines.join('\n'),
    }
  }, [selectedPreset, channels])

  const displayContent = outputMode === 'yaml' ? commandOutput.yaml : commandOutput.commands

  // ===========================================================================
  // Копирование / Скачивание
  // ===========================================================================

  const handleCopy = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: 'Скопировано', description: label })
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось скопировать', variant: 'destructive' })
    }
  }, [toast])

  const handleDownload = useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({ title: 'Скачано', description: filename })
  }, [toast])

  /** Быстрая генерация команд для пресета без выбора */
  const generateCommandsForPreset = useCallback((preset: PresetData): string => {
    const cmd = 'python -m meshtastic'
    const lines: string[] = []
    lines.push(`# Пресет: ${preset.name}`)
    lines.push(`${cmd} --set device.role ${preset.role}`)
    lines.push(`${cmd} --set device.node_info_broadcast_secs ${preset.nodeInfoBroadcastSecs}`)
    lines.push(`${cmd} --set lora.region ${preset.region}`)
    lines.push(`${cmd} --set lora.modem_preset ${preset.modemPreset}`)
    lines.push(`${cmd} --set lora.tx_power ${preset.txPower}`)
    lines.push(`${cmd} --set lora.use_preamble ${preset.usePreamble}`)
    lines.push(`${cmd} --set network.hop_limit ${preset.hopLimit}`)
    lines.push(`${cmd} --set network.rebroadcast_mode ${preset.rebroadcastMode}`)
    lines.push(`${cmd} --set power.is_power_saving ${preset.powerSaving}`)
    if (SLEEP_ROLES.has(preset.role)) {
      lines.push(`${cmd} --set power.ls_secs ${preset.lsSecs}`)
      lines.push(`${cmd} --set power.min_wake_secs ${preset.minWakeSecs}`)
    }
    lines.push(`${cmd} --set position.gps_mode ${preset.gpsMode}`)
    if (preset.gpsMode === 'ENABLED') {
      lines.push(`${cmd} --set position.gps_update_interval ${preset.gpsUpdateInterval}`)
    }
    if (preset.agpsEnabled) {
      lines.push(`${cmd} --set gps.agps_enabled true`)
    }
    lines.push(`${cmd} --set position.position_precision ${preset.positionPrecision}`)
    lines.push(`${cmd} --set position.position_broadcast_secs ${preset.positionBroadcastSecs}`)
    if (preset.smartBroadcastEnabled) {
      lines.push(`${cmd} --set position.broadcast_smart_minimum_distance ${preset.smartBroadcastMinDist}`)
      lines.push(`${cmd} --set position.broadcast_smart_minimum_interval_secs ${preset.smartBroadcastMinInterval}`)
    }
    lines.push(`${cmd} --set bluetooth.enabled ${preset.bluetoothEnabled}`)
    lines.push(`${cmd} --set display.screen_on_secs ${preset.screenOnSecs}`)
    lines.push(`${cmd} --set telemetry.device_update_interval ${preset.telemetryInterval}`)

    const linkedChannel = preset.channel ?? (preset.channelId ? channels.find(c => c.id === preset.channelId) : null)
    if (linkedChannel) {
      lines.push('')
      lines.push('# Канал')
      lines.push(`${cmd} --ch-index 0 --ch-set psk "base64:${linkedChannel.psk}"`)
      lines.push(`${cmd} --ch-index 0 --ch-set name "${linkedChannel.name}"`)
      lines.push(`${cmd} --ch-index 0 --ch-set uplink_enabled ${linkedChannel.uplink}`)
      lines.push(`${cmd} --ch-index 0 --ch-set downlink_enabled ${linkedChannel.downlink}`)
      if (linkedChannel.frequency) {
        lines.push(`${cmd} --ch-index 0 --ch-set frequency ${linkedChannel.frequency}`)
      }
    }
    return lines.join('\n')
  }, [channels])

  // ===========================================================================
  // Рендер
  // ===========================================================================

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* Заголовок + кнопка создания                                       */}
      {/* ================================================================= */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Cpu className="size-5 text-muted-foreground" />
            Пресеты настроек
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Готовые конфигурации для быстрой настройки T-Echo. Выберите пресет и скопируйте команды.
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="size-4" />
          Новый пресет
        </Button>
      </div>

      {/* ================================================================= */}
      {/* Сетка карточек пресетов                                            */}
      {/* ================================================================= */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 space-y-4">
                <div className="h-6 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="flex gap-2">
                  <div className="h-6 bg-muted rounded w-16" />
                  <div className="h-6 bg-muted rounded w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : presets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Cpu className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Нет сохранённых пресетов</p>
            <p className="text-sm text-muted-foreground mt-1">
              Создайте первый пресет или дождитесь системных пресетов
            </p>
            <Button onClick={handleCreate} variant="outline" className="mt-4 gap-2">
              <Plus className="size-4" />
              Создать пресет
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map(preset => {
            const roleMeta = ROLE_META[preset.role as keyof typeof ROLE_META]
            const batteryHours = estimateBatteryHours(preset)
            const linkedChannel = preset.channel ?? (preset.channelId ? channels.find(c => c.id === preset.channelId) : null)
            const isSelected = selectedPreset?.id === preset.id

            return (
              <Card
                key={preset.id}
                className={`transition-all ${isSelected ? 'ring-2 ring-primary border-primary' : 'hover:shadow-md'}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{preset.icon}</span>
                      <CardTitle className="text-base leading-tight">{preset.name}</CardTitle>
                    </div>
                    {preset.isBuiltIn && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        Системный
                      </Badge>
                    )}
                  </div>
                  {preset.description && (
                    <CardDescription className="line-clamp-2 text-xs mt-1">
                      {preset.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pb-2 space-y-3">
                  {/* Бейджи */}
                  <div className="flex flex-wrap gap-1.5">
                    {roleMeta && (
                      <Badge
                        className={`text-[10px] ${roleMeta.deprecated ? 'opacity-60' : ''}`}
                        style={{
                          backgroundColor: `var(--color-${roleMeta.color}-100, hsl(var(--muted)))`,
                          color: `var(--color-${roleMeta.color}-800, hsl(var(--foreground)))`,
                        }}
                      >
                        {roleMeta.label}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {getModemLabel(preset.modemPreset)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Hop: {preset.hopLimit}
                    </Badge>
                    {preset.powerSaving && (
                      <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
                        Экономия
                      </Badge>
                    )}
                    {preset.agpsEnabled && (
                      <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400">
                        AGNSS
                      </Badge>
                    )}
                  </div>

                  {/* Привязанный канал */}
                  {linkedChannel && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Link className="size-3" />
                      <span>Канал: <span className="font-medium text-foreground">{linkedChannel.name}</span></span>
                    </div>
                  )}

                  {/* Ключевые параметры */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Позиция</div>
                      <div className="text-xs font-medium">
                        {preset.positionBroadcastSecs >= 60
                          ? `${Math.round(preset.positionBroadcastSecs / 60)} мин`
                          : `${preset.positionBroadcastSecs} сек`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">GPS</div>
                      <div className="text-xs font-medium">{preset.gpsMode === 'ENABLED' ? 'Вкл' : preset.gpsMode === 'DISABLED' ? 'Выкл' : 'Нет'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Автономность</div>
                      <div className="text-xs font-medium flex items-center justify-center gap-1">
                        <Battery className="size-3" />
                        {formatBatteryLife(batteryHours)}
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    className="text-xs h-7 gap-1"
                    onClick={() => handleApply(preset)}
                  >
                    <Terminal className="size-3" />
                    Применить
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 gap-1"
                    onClick={() => handleCopy(generateCommandsForPreset(preset), `Команды «${preset.name}»`)}
                  >
                    <Copy className="size-3" />
                    Копировать команды
                  </Button>
                  {!preset.isBuiltIn ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 gap-1"
                      onClick={() => handleEdit(preset)}
                    >
                      <Pencil className="size-3" />
                      Изменить
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 gap-1 opacity-50 cursor-not-allowed"
                            disabled
                          >
                            <Pencil className="size-3" />
                            Изменить
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Системный пресет</TooltipContent>
                    </Tooltip>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 gap-1"
                    onClick={() => handleDuplicate(preset)}
                  >
                    <CopyPlus className="size-3" />
                    Дублировать
                  </Button>
                  {!preset.isBuiltIn && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 gap-1 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(preset)}
                    >
                      <Trash2 className="size-3" />
                      Удалить
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* ================================================================= */}
      {/* Вывод команд для выбранного пресета                                */}
      {/* ================================================================= */}
      {selectedPreset && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="size-4 text-muted-foreground" />
                Команды для «{selectedPreset.name}»
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={outputMode === 'commands' ? 'default' : 'outline'}
                  className="text-xs h-7 gap-1"
                  onClick={() => setOutputMode('commands')}
                >
                  <Terminal className="size-3" />
                  Команды
                </Button>
                <Button
                  size="sm"
                  variant={outputMode === 'yaml' ? 'default' : 'outline'}
                  className="text-xs h-7 gap-1"
                  onClick={() => setOutputMode('yaml')}
                >
                  <FileText className="size-3" />
                  YAML
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1"
                  onClick={() => handleCopy(displayContent, outputMode === 'yaml' ? 'YAML конфигурация' : 'Команды CLI')}
                >
                  <Copy className="size-3" />
                  Копировать
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1"
                  onClick={() => handleDownload(
                    displayContent,
                    outputMode === 'yaml'
                      ? `meshtastic-${selectedPreset.name.replace(/\s+/g, '-').toLowerCase()}.yaml`
                      : `meshtastic-${selectedPreset.name.replace(/\s+/g, '-').toLowerCase()}.sh`
                  )}
                >
                  <Download className="size-3" />
                  Скачать
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
              {displayContent}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* ================================================================= */}
      {/* Диалог редактора пресета                                          */}
      {/* ================================================================= */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingPreset ? (
                <>
                  <Pencil className="size-4" />
                  Редактирование пресета
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Новый пресет
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingPreset
                ? `Изменение параметров пресета «${editingPreset.name}»`
                : 'Создайте новую конфигурацию для быстрой настройки устройства'}
            </DialogDescription>
          </DialogHeader>

          <Accordion
            type="multiple"
            defaultValue={['general', 'lora', 'gps', 'power', 'channel', 'advanced']}
            className="w-full"
          >
            {/* ============================================================== */}
            {/* Секция: Основное                                                */}
            {/* ============================================================== */}
            <AccordionItem value="general">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Cpu className="size-4 text-muted-foreground" />
                  <span className="font-semibold">Основное</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-2">
                  {/* Название */}
                  <div className="space-y-2">
                    <Label htmlFor="preset-name">Название</Label>
                    <Input
                      id="preset-name"
                      value={form.name}
                      onChange={e => updateField('name', e.target.value)}
                      placeholder="Например: Трекер лес 12ч"
                      maxLength={64}
                    />
                  </div>

                  {/* Описание */}
                  <div className="space-y-2">
                    <Label htmlFor="preset-description">Описание</Label>
                    <Input
                      id="preset-description"
                      value={form.description}
                      onChange={e => updateField('description', e.target.value)}
                      placeholder="Краткое описание пресета"
                      maxLength={256}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Иконка */}
                    <div className="space-y-2">
                      <Label htmlFor="preset-icon">Иконка (emoji)</Label>
                      <Input
                        id="preset-icon"
                        value={form.icon}
                        onChange={e => updateField('icon', e.target.value)}
                        maxLength={4}
                        className="w-20 text-center text-xl"
                      />
                    </div>

                    {/* Роль */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Shield className="size-3.5 text-muted-foreground" />
                        Роль
                      </Label>
                      <Select
                        value={form.role}
                        onValueChange={v => updateField('role', v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_META).map(([key, meta]) => (
                            <SelectItem key={key} value={key}>
                              <span className="flex items-center gap-2">
                                <span>{meta.label}</span>
                                {meta.deprecated && (
                                  <span className="text-[10px] text-red-500">(устарело)</span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Интервал вещания ноды */}
                  <div className="space-y-2">
                    <Label>Интервал вещания ноды (сек)</Label>
                    <Select
                      value={NODE_INFO_BROADCAST_PRESETS.some(p => p.value === form.nodeInfoBroadcastSecs) ? String(form.nodeInfoBroadcastSecs) : '__custom__'}
                      onValueChange={v => {
                        if (v !== '__custom__') updateField('nodeInfoBroadcastSecs', Number(v))
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NODE_INFO_BROADCAST_PRESETS.map(p => (
                          <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                        ))}
                        <SelectItem value="__custom__">Другое</SelectItem>
                      </SelectContent>
                    </Select>
                    {!NODE_INFO_BROADCAST_PRESETS.some(p => p.value === form.nodeInfoBroadcastSecs) && (
                      <Input
                        type="number"
                        min={30}
                        value={form.nodeInfoBroadcastSecs}
                        onChange={e => updateField('nodeInfoBroadcastSecs', Number(e.target.value) || 900)}
                        className="w-32"
                      />
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============================================================== */}
            {/* Секция: LoRa                                                    */}
            {/* ============================================================== */}
            <AccordionItem value="lora">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Radio className="size-4 text-muted-foreground" />
                  <span className="font-semibold">LoRa</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Регион */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Radio className="size-3.5 text-muted-foreground" />
                        Регион
                      </Label>
                      <Select
                        value={form.region}
                        onValueChange={v => updateField('region', v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REGIONS.map(r => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label} {r.note ? `(${r.note})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Модем пресет */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Zap className="size-3.5 text-muted-foreground" />
                        Модем пресет
                      </Label>
                      <Select
                        value={form.modemPreset}
                        onValueChange={v => updateField('modemPreset', v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODEM_PRESETS.map(m => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  {/* TX Power */}
                  <div className="space-y-2">
                    <Label>Мощность передачи (tx_power)</Label>
                    <Select
                      value={String(form.txPower)}
                      onValueChange={v => updateField('txPower', Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Максимум (auto)</SelectItem>
                        {Array.from({ length: 20 }, (_, i) => i + 1).map(v => (
                          <SelectItem key={v} value={String(v)}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">0 = автоматически максимальная для региона</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Hop Limit */}
                    <div className="space-y-2">
                      <Label>Лимит хопов</Label>
                      <Select
                        value={String(form.hopLimit)}
                        onValueChange={v => updateField('hopLimit', Number(v))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 7 }, (_, i) => i + 1).map(v => (
                            <SelectItem key={v} value={String(v)}>
                              {v} {v === 3 ? '(по умолч.)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Use Preamble */}
                    <div className="flex items-center justify-between gap-4 pt-6">
                      <Label htmlFor="preset-preamble" className="cursor-pointer">Длинный преамбула</Label>
                      <Checkbox
                        id="preset-preamble"
                        checked={form.usePreamble}
                        onCheckedChange={v => updateField('usePreamble', !!v)}
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============================================================== */}
            {/* Секция: Позиция и GPS                                           */}
            {/* ============================================================== */}
            <AccordionItem value="gps">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span className="font-semibold">Позиция и GPS</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-2">
                  {/* GPS Mode */}
                  <div className="space-y-2">
                    <Label>GPS режим</Label>
                    <Select
                      value={form.gpsMode}
                      onValueChange={v => updateField('gpsMode', v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GPS_MODES.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.gpsMode === 'ENABLED' && (
                    <div className="space-y-2">
                      <Label>Интервал обновления GPS (сек)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.gpsUpdateInterval}
                        onChange={e => updateField('gpsUpdateInterval', Number(e.target.value) || 30)}
                        className="w-32"
                      />
                    </div>
                  )}

                  {form.gpsMode === 'ENABLED' && (
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <Label htmlFor="agps-enabled" className="cursor-pointer">AGNSS (требует подключение к телефону/интернету)</Label>
                        <p className="text-xs text-muted-foreground">Для роли CLIENT с телефоном. Не подходит для автономных трекеров.</p>
                      </div>
                      <Checkbox
                        id="agps-enabled"
                        checked={form.agpsEnabled}
                        onCheckedChange={v => updateField('agpsEnabled', !!v)}
                      />
                    </div>
                  )}

                  {form.gpsMode === 'ENABLED' && (
                    <div className="space-y-2">
                      <Label>Время ожидания GPS-фикса (сек)</Label>
                      <Input
                        type="number"
                        min={10}
                        max={300}
                        value={form.gpsAttemptTime}
                        onChange={e => updateField('gpsAttemptTime', Number(e.target.value) || 90)}
                        className="w-32"
                      />
                      <p className="text-xs text-muted-foreground">В лесу рекомендуется 90 сек, на открытом месте 30 сек</p>
                    </div>
                  )}

                  <Separator />

                  {/* Точность позиции */}
                  <div className="space-y-2">
                    <Label>Точность позиции</Label>
                    <Select
                      value={String(form.positionPrecision)}
                      onValueChange={v => updateField('positionPrecision', Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POSITION_PRECISION_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Интервал вещания позиции */}
                  <div className="space-y-2">
                    <Label>Интервал вещания позиции (сек)</Label>
                    <Select
                      value={POSITION_BROADCAST_PRESETS.some(p => p.value === form.positionBroadcastSecs) ? String(form.positionBroadcastSecs) : '__custom__'}
                      onValueChange={v => {
                        if (v !== '__custom__') updateField('positionBroadcastSecs', Number(v))
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POSITION_BROADCAST_PRESETS.map(p => (
                          <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                        ))}
                        <SelectItem value="__custom__">Другое</SelectItem>
                      </SelectContent>
                    </Select>
                    {!POSITION_BROADCAST_PRESETS.some(p => p.value === form.positionBroadcastSecs) && (
                      <Input
                        type="number"
                        min={10}
                        value={form.positionBroadcastSecs}
                        onChange={e => updateField('positionBroadcastSecs', Number(e.target.value) || 60)}
                        className="w-32"
                      />
                    )}
                  </div>

                  <Separator />

                  {/* Умное вещание */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="smart-broadcast">Умное вещание позиции</Label>
                      <Checkbox
                        id="smart-broadcast"
                        checked={form.smartBroadcastEnabled}
                        onCheckedChange={v => updateField('smartBroadcastEnabled', !!v)}
                      />
                    </div>
                    {form.smartBroadcastEnabled && (
                      <div className="grid grid-cols-2 gap-4 pl-2">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Мин. расстояние (м)</Label>
                          <Input
                            type="number"
                            min={1}
                            value={form.smartBroadcastMinDist}
                            onChange={e => updateField('smartBroadcastMinDist', Number(e.target.value) || 20)}
                            className="w-28"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Мин. интервал (сек)</Label>
                          <Input
                            type="number"
                            min={10}
                            value={form.smartBroadcastMinInterval}
                            onChange={e => updateField('smartBroadcastMinInterval', Number(e.target.value) || 60)}
                            className="w-28"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============================================================== */}
            {/* Секция: Питание                                                 */}
            {/* ============================================================== */}
            <AccordionItem value="power">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Zap className="size-4 text-muted-foreground" />
                  <span className="font-semibold">Питание</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-2">
                  {/* Экономия энергии */}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label htmlFor="power-saving" className="cursor-pointer">Экономия энергии</Label>
                      <p className="text-xs text-muted-foreground">Включает лёгкий сон между циклами</p>
                    </div>
                    <Checkbox
                      id="power-saving"
                      checked={form.powerSaving}
                      onCheckedChange={v => updateField('powerSaving', !!v)}
                    />
                  </div>

                  <Separator />

                  {/* Параметры сна (видны для спящих ролей или если включена экономия) */}
                  {(form.powerSaving || SLEEP_ROLES.has(form.role)) && (
                    <div className="space-y-4">
                      <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                        <Battery className="size-4 text-blue-500" />
                        <AlertDescription className="text-xs">
                          Оценка автономности: <strong>{formatBatteryLife(estimateBatteryHours({
                            ...form,
                            id: '',
                            isBuiltIn: false,
                            channel: null,
                            createdAt: '',
                            updatedAt: '',
                          }))}</strong> (1000 мАч)
                        </AlertDescription>
                      </Alert>

                      {/* Интервал сна */}
                      <div className="space-y-2">
                        <Label>Интервал сна (ls_secs)</Label>
                        <Select
                          value={SLEEP_PRESETS.some(p => p.value === form.lsSecs) ? String(form.lsSecs) : '__custom__'}
                          onValueChange={v => {
                            if (v !== '__custom__') updateField('lsSecs', Number(v))
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SLEEP_PRESETS.map(p => (
                              <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                            ))}
                            <SelectItem value="__custom__">Другое</SelectItem>
                          </SelectContent>
                        </Select>
                        {!SLEEP_PRESETS.some(p => p.value === form.lsSecs) && (
                          <Input
                            type="number"
                            min={10}
                            value={form.lsSecs}
                            onChange={e => updateField('lsSecs', Number(e.target.value) || 60)}
                            className="w-32"
                          />
                        )}
                      </div>

                      {/* Минимальное время бодрствования */}
                      <div className="space-y-2">
                        <Label>Мин. время бодрствования (min_wake_secs)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={form.minWakeSecs}
                          onChange={e => updateField('minWakeSecs', Number(e.target.value) || 10)}
                          className="w-32"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============================================================== */}
            {/* Секция: Канал                                                   */}
            {/* ============================================================== */}
            <AccordionItem value="channel">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Network className="size-4 text-muted-foreground" />
                  <span className="font-semibold">Канал</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-2">
                  <div className="space-y-2">
                    <Label>Привязать канал</Label>
                    <Select
                      value={form.channelId ?? 'none'}
                      onValueChange={handleChannelSelectInEditor}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите канал..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">Без канала</span>
                        </SelectItem>
                        {channels.map(ch => (
                          <SelectItem key={ch.id} value={ch.id}>
                            <span className="flex items-center gap-2">
                              <span className="font-medium">{ch.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {ch.region} · {ch.modemPreset}
                              </span>
                              {ch.frequency && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {ch.frequency} МГц
                                </Badge>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      При выборе канала автоматически подтягиваются регион и модем пресет
                    </p>
                  </div>

                  {/* Информация о выбранном канале */}
                  {form.channelId && (() => {
                    const ch = channels.find(c => c.id === form.channelId)
                    if (!ch) return null
                    return (
                      <Card className="bg-muted/50">
                        <CardContent className="p-3 space-y-2">
                          <div className="text-sm font-medium">{ch.name}</div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>PSK: <span className="font-mono">{maskPsk(ch.psk)}</span></div>
                            <div>Частота: {ch.frequency ? `${ch.frequency} МГц` : 'стандартная'}</div>
                            <div>Uplink: {ch.uplink ? '✓' : '✗'}</div>
                            <div>Downlink: {ch.downlink ? '✓' : '✗'}</div>
                            <div>Регион: {getRegionLabel(ch.region)}</div>
                            <div>Модем: {getModemLabel(ch.modemPreset)}</div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })()}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============================================================== */}
            {/* Секция: Дополнительно                                           */}
            {/* ============================================================== */}
            <AccordionItem value="advanced">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Monitor className="size-4 text-muted-foreground" />
                  <span className="font-semibold">Дополнительно</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-2">
                  {/* Bluetooth */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bt-enabled" className="flex items-center gap-1.5 cursor-pointer">
                        <Bluetooth className="size-3.5 text-muted-foreground" />
                        Bluetooth включён
                      </Label>
                      <Checkbox
                        id="bt-enabled"
                        checked={form.bluetoothEnabled}
                        onCheckedChange={v => updateField('bluetoothEnabled', !!v)}
                      />
                    </div>
                    {form.bluetoothEnabled && (
                      <div className="space-y-2 pl-2">
                        <Label htmlFor="bt-pin" className="text-xs text-muted-foreground">Фиксированный PIN</Label>
                        <Input
                          id="bt-pin"
                          value={form.bluetoothFixedPin}
                          onChange={e => updateField('bluetoothFixedPin', e.target.value)}
                          placeholder="Оставьте пустым для автоматического"
                          maxLength={6}
                          className="w-40"
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Таймаут экрана */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Monitor className="size-3.5 text-muted-foreground" />
                      Таймаут экрана (сек)
                    </Label>
                    <Select
                      value={SCREEN_TIMEOUT_PRESETS.some(p => p.value === form.screenOnSecs) ? String(form.screenOnSecs) : '__custom__'}
                      onValueChange={v => {
                        if (v !== '__custom__') updateField('screenOnSecs', Number(v))
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCREEN_TIMEOUT_PRESETS.map(p => (
                          <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                        ))}
                        <SelectItem value="__custom__">Другое</SelectItem>
                      </SelectContent>
                    </Select>
                    {!SCREEN_TIMEOUT_PRESETS.some(p => p.value === form.screenOnSecs) && (
                      <Input
                        type="number"
                        min={5}
                        value={form.screenOnSecs}
                        onChange={e => updateField('screenOnSecs', Number(e.target.value) || 60)}
                        className="w-32"
                      />
                    )}
                  </div>

                  <Separator />

                  {/* LED отключён */}
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="led-disabled" className="cursor-pointer">Отключить LED индикатор</Label>
                    <Checkbox
                      id="led-disabled"
                      checked={form.ledDisabled}
                      onCheckedChange={v => updateField('ledDisabled', !!v)}
                    />
                  </div>

                  <Separator />

                  {/* Режим ретрансляции */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Network className="size-3.5 text-muted-foreground" />
                      Режим ретрансляции
                    </Label>
                    <Select
                      value={form.rebroadcastMode}
                      onValueChange={v => updateField('rebroadcastMode', v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REBROADCAST_MODES.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Интервал телеметрии */}
                  <div className="space-y-2">
                    <Label>Интервал телеметрии (сек)</Label>
                    <Select
                      value={TELEMETRY_INTERVAL_PRESETS.some(p => p.value === form.telemetryInterval) ? String(form.telemetryInterval) : '__custom__'}
                      onValueChange={v => {
                        if (v !== '__custom__') updateField('telemetryInterval', Number(v))
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TELEMETRY_INTERVAL_PRESETS.map(p => (
                          <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                        ))}
                        <SelectItem value="__custom__">Другое</SelectItem>
                      </SelectContent>
                    </Select>
                    {!TELEMETRY_INTERVAL_PRESETS.some(p => p.value === form.telemetryInterval) && (
                      <Input
                        type="number"
                        min={10}
                        value={form.telemetryInterval}
                        onChange={e => updateField('telemetryInterval', Number(e.target.value) || 300)}
                        className="w-32"
                      />
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Сохранение...' : editingPreset ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
