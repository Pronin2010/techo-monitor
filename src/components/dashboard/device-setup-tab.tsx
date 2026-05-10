'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Settings,
  Terminal,
  Copy,
  Download,
  Cpu,
  Radio,
  Lock,
  Eye,
  EyeOff,
  Shuffle,
  Zap,
  Shield,
  Info,
  FileText,
  MapPin,
  Activity,
  Bluetooth,
  Monitor,
  Network,
  CircleHelp,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import type { Channel } from '@/lib/types'

// ============================================================================
// Типы и константы — актуальные для meshtastic firmware 2.7.15
// Protobuf: https://github.com/meshtastic/protobufs/blob/master/meshtastic/config.proto
// ============================================================================

interface DeviceSetupTabProps {
  channels: Channel[]
}

/** Роль устройства — enum из meshtastic protobuf Config.DeviceConfig.Role */
type DeviceRole =
  | 'CLIENT'
  | 'CLIENT_MUTE'
  | 'CLIENT_HIDDEN'
  | 'ROUTER'
  | 'ROUTER_CLIENT'  // deprecated v2.3.15
  | 'TRACKER'
  | 'REPEATER'       // deprecated v2.7.x
  | 'SENSOR'
  | 'LOST_AND_FOUND'
  | 'TAK_TRACKER'    // new v2.7
  | 'ROUTER_LATE'    // new v2.7
  | 'CLIENT_BASE'    // new v2.7

/** GPS Mode — замена deprecated gps_enabled (Config.PositionConfig.GpsMode) */
type GpsMode = 'DISABLED' | 'ENABLED' | 'NOT_PRESENT'

/** Режим ретрансляции (Config.NetworkConfig.RebroadcastMode) */
type RebroadcastMode = 'ALL' | 'LOCAL_SKIP' | 'SIMPLE'

/** Описания ролей на русском */
const ROLE_DESCRIPTIONS: Record<DeviceRole, string> = {
  CLIENT: 'Клиент — обычный узел с экраном, ретранслирует пакеты',
  CLIENT_MUTE: 'Молчаливый клиент — как CLIENT, но без ответов на пинги',
  CLIENT_HIDDEN: 'Скрытый клиент — не отображается в списке узлов, минимум эфира',
  ROUTER: 'Маршрутизатор — ядро сети, всегда бодрствует, приоритет ретрансляции',
  ROUTER_CLIENT: 'Маршрутизатор + клиент — ROUTER с функциями CLIENT (устарело, не рекомендуется)',
  TRACKER: 'Трекер — GPS-трекинг с периодическим сном и телеметрией',
  REPEATER: 'Ретранслятор — только пересылка, всегда бодрствует, без экрана (устарело)',
  SENSOR: 'Сенсор — датчик с телеметрией, спящий режим',
  LOST_AND_FOUND: 'Потерянное устройство — вещает GPS для поиска',
  TAK_TRACKER: 'TAK трекер — ATAK PLI трансляции, уменьшенные broadcast\'ы',
  ROUTER_LATE: 'Роутер (поздний) — ретранслирует последним, для доп. покрытия',
  CLIENT_BASE: 'Базовая станция — мощный узел, приоритет для слабых узлов',
}

/** Цвета бейджей для ролей */
const ROLE_BADGE_COLORS: Record<DeviceRole, string> = {
  CLIENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  CLIENT_MUTE: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  CLIENT_HIDDEN: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  ROUTER: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  ROUTER_CLIENT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  TRACKER: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  REPEATER: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  SENSOR: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  LOST_AND_FOUND: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  TAK_TRACKER: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  ROUTER_LATE: 'bg-teal-100 text-teal-700 dark:bg-teal-800 dark:text-teal-200',
  CLIENT_BASE: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
}

/** Устаревшие роли */
const DEPRECATED_ROLES = new Set<DeviceRole>(['ROUTER_CLIENT', 'REPEATER'])

/**
 * Роли для спящего режима (показывают настройки ls_secs / min_wake_secs)
 * TRACKER, SENSOR и TAK_TRACKER — спящие роли
 */
const SLEEP_ROLES = new Set<DeviceRole>(['TRACKER', 'SENSOR', 'TAK_TRACKER'])

/** Пресеты интервалов сна для TRACKER / SENSOR / TAK_TRACKER */
const SLEEP_PRESETS = [
  { label: '30 сек', value: 30 },
  { label: '1 мин', value: 60 },
  { label: '5 мин', value: 300 },
  { label: '15 мин', value: 900 },
  { label: '30 мин', value: 1800 },
  { label: '1 час', value: 3600 },
]

/**
 * Модем пресеты — UPPER_SNAKE_CASE как в protobuf enum
 * Config.LoRaConfig.ModemPreset
 */
const MODEM_PRESETS = [
  { value: 'SHORT_FAST', label: 'Short Fast', deprecated: false },
  { value: 'SHORT_SLOW', label: 'Short Slow', deprecated: false },
  { value: 'SHORT_TURBO', label: 'Short Turbo', deprecated: false },
  { value: 'MEDIUM_FAST', label: 'Medium Fast', deprecated: false },
  { value: 'MEDIUM_SLOW', label: 'Medium Slow', deprecated: false },
  { value: 'LONG_FAST', label: 'Long Fast', deprecated: false },
  { value: 'LONG_MODERATE', label: 'Long Moderate', deprecated: false },
  { value: 'LONG_TURBO', label: 'Long Turbo', deprecated: false },
  { value: 'LITE_FAST', label: 'Lite Fast (EU 866)', deprecated: false },
  { value: 'LITE_SLOW', label: 'Lite Slow (EU 866)', deprecated: false },
  { value: 'NARROW_FAST', label: 'Narrow Fast (EU 868)', deprecated: false },
  { value: 'NARROW_SLOW', label: 'Narrow Slow (EU 868)', deprecated: false },
]

/**
 * Регионы — ТОЛЬКО 433 МГц (Config.LoRaConfig.RegionCode)
 */
const REGIONS = [
  { value: 'EU_433', label: 'EU 433 МГц — LPD433, Россия/СНГ' },
  { value: 'ANZ_433', label: 'ANZ 433 МГц — Australia/NZ' },
  { value: 'UA_433', label: 'UA 433 МГц — Украина' },
  { value: 'KZ_433', label: 'KZ 433 МГц — Казахстан' },
  { value: 'PH_433', label: 'PH 433 МГц — Philippines' },
  { value: 'MY_433', label: 'MY 433 МГц — Malaysia' },
]

/** Пресеты интервала вещания ноды (device.node_info_broadcast_secs) */
const BROADCAST_INTERVAL_PRESETS = [
  { label: '5 мин (300 сек)', value: 300 },
  { label: '10 мин (600 сек)', value: 600 },
  { label: '15 мин (900 сек)', value: 900 },
  { label: '30 мин (1800 сек)', value: 1800 },
  { label: '1 час (3600 сек)', value: 3600 },
]

/** Описания режимов ретрансляции */
const REBROADCAST_DESCRIPTIONS: Record<RebroadcastMode, string> = {
  ALL: 'Пересылать все пакеты (по умолчанию)',
  LOCAL_SKIP: 'Не пересылать пакеты от прямых соседей',
  SIMPLE: 'Минимальная ретрансляция (экономия батареи)',
}

/** Пресеты таймаута экрана (display.screen_on_secs) */
const SCREEN_TIMEOUT_PRESETS = [
  { label: '10 сек', value: 10 },
  { label: '30 сек', value: 30 },
  { label: '1 мин (60 сек)', value: 60 },
  { label: '2 мин (120 сек)', value: 120 },
  { label: '5 мин (300 сек)', value: 300 },
  { label: '10 мин (600 сек)', value: 600 },
]

/** Начальное состояние формы */
const INITIAL_STATE = {
  // --- Device ---
  region: 'EU_433' as string,
  modemPreset: 'LONG_MODERATE' as string,
  role: 'CLIENT' as DeviceRole,
  nodeInfoBroadcastSecs: 900,
  // --- Power / Sleep ---
  powerSaving: true,
  sleepInterval: 300,
  minWake: 10,
  // --- GPS ---
  gpsMode: 'ENABLED' as GpsMode,
  gpsUpdateInterval: 30,
  positionPrecision: 32,
  positionFlags: 299,
  // --- Telemetry ---
  telemetryDeviceInterval: 300,
  // --- LoRa Advanced ---
  txPower: 0,
  hopLimit: 3,
  usePreamble: false,
  // --- Bluetooth ---
  bluetoothEnabled: true,
  bluetoothFixedPin: '',
  // --- Display ---
  screenOnSecs: 60,
  // --- Network ---
  rebroadcastMode: 'ALL' as RebroadcastMode,
  // --- Owner ---
  owner: '',
  ownerShort: '',
  // --- Channel ---
  channelName: 'forest-track',
  psk: '',
  uplinkEnabled: true,
  downlinkEnabled: true,
  setPrivatePsk: true,
  showPsk: false,
  frequencyOverride: '', // Переопределение частоты (МГц)
  selectedChannelId: '' as string, // ID выбранного канала
  // --- Output ---
  outputMode: 'commands' as 'commands' | 'yaml',
}

// ============================================================================
// Вспомогательные функции
// ============================================================================

/** Генерация случайного PSK 32 байта (256 бит) — как meshtastic genPSK256() */
const generatePSK = (): string => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

/** Разбивает длинную base64 строку для удобства чтения */
const formatPsk = (psk: string): string => {
  if (psk.length <= 44) return psk
  return psk.match(/.{1,44}/g)?.join('\n    ') ?? psk
}

// ============================================================================
// Компонент
// ============================================================================

export default function DeviceSetupTab({ channels }: DeviceSetupTabProps) {
  const { toast } = useToast()

  const [state, setState] = useState(INITIAL_STATE)

  // ── Channel selection handler ──
  const handleChannelSelect = useCallback((channelId: string) => {
    if (!channelId || channelId === 'none') {
      setState(prev => ({ ...prev, selectedChannelId: '', psk: '', channelName: 'forest-track', frequencyOverride: '', uplinkEnabled: true, downlinkEnabled: true, setPrivatePsk: true }))
      return
    }
    const ch = channels.find(c => c.id === channelId)
    if (!ch) return
    setState(prev => ({
      ...prev,
      selectedChannelId: channelId,
      channelName: ch.name,
      psk: ch.psk,
      setPrivatePsk: true,
      uplinkEnabled: ch.uplink,
      downlinkEnabled: ch.downlink,
      frequencyOverride: ch.frequency ? String(ch.frequency) : '',
      region: ch.region,
      modemPreset: ch.modemPreset,
    }))
    toast({
      title: `Канал: ${ch.name}`,
      description: 'Настройки канала, LoRa и PSK подтянуты автоматически',
    })
  }, [channels, toast])

  // ---------------------------------------------------------------------------
  // Обработчики изменения полей
  // ---------------------------------------------------------------------------

  const updateField = useCallback(<K extends keyof typeof INITIAL_STATE>(
    key: K,
    value: (typeof INITIAL_STATE)[K]
  ) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }, [])

  // ---------------------------------------------------------------------------
  // Вычисляемые значения
  // ---------------------------------------------------------------------------

  const isCustomSleep = useMemo(
    () => !SLEEP_PRESETS.some((p) => p.value === state.sleepInterval),
    [state.sleepInterval]
  )

  const isCustomBroadcastInterval = useMemo(
    () => !BROADCAST_INTERVAL_PRESETS.some((p) => p.value === state.nodeInfoBroadcastSecs),
    [state.nodeInfoBroadcastSecs]
  )

  // ---------------------------------------------------------------------------
  // Генерация команды
  // ---------------------------------------------------------------------------

  const commands = useMemo(() => {
    const lines: string[] = []
    const p = 'python -m meshtastic'

    // --- Владелец ---
    if (state.owner) {
      lines.push(`${p} --set-owner "${state.owner}"`)
    }
    if (state.ownerShort) {
      lines.push(`${p} --set-owner-short "${state.ownerShort}"`)
    }

    // --- Device ---
    lines.push(`${p} --set device.role ${state.role}`)
    lines.push(`${p} --set device.node_info_broadcast_secs ${state.nodeInfoBroadcastSecs}`)

    // --- LoRa: регион и модем ---
    lines.push(`${p} --set lora.region ${state.region}`)
    lines.push(`${p} --set lora.modem_preset ${state.modemPreset}`)
    lines.push(`${p} --set lora.tx_power ${state.txPower}`)

    // --- Network ---
    lines.push(`${p} --set network.hop_limit ${state.hopLimit}`)
    lines.push(`${p} --set network.rebroadcast_mode ${state.rebroadcastMode}`)
    lines.push(`${p} --set lora.use_preamble ${state.usePreamble}`)

    // --- Power ---
    lines.push(`${p} --set power.is_power_saving ${state.powerSaving}`)
    if (SLEEP_ROLES.has(state.role)) {
      lines.push(`${p} --set power.ls_secs ${state.sleepInterval}`)
      lines.push(`${p} --set power.min_wake_secs ${state.minWake}`)
    }

    // --- Bluetooth ---
    lines.push(`${p} --set bluetooth.enabled ${state.bluetoothEnabled}`)
    if (state.bluetoothEnabled && state.bluetoothFixedPin) {
      lines.push(`${p} --set bluetooth.fixed_pin "${state.bluetoothFixedPin}"`)
    }

    // --- Display ---
    lines.push(`${p} --set display.screen_on_secs ${state.screenOnSecs}`)

    // --- GPS ---
    lines.push(`${p} --set position.gps_mode ${state.gpsMode}`)
    if (state.gpsMode === 'ENABLED') {
      lines.push(`${p} --set position.gps_update_interval ${state.gpsUpdateInterval}`)
    }
    if (state.positionFlags > 0) {
      lines.push(`${p} --set position.position_flags ${state.positionFlags}`)
    }
    if (state.positionPrecision > 0) {
      lines.push(`${p} --ch-index 0 --ch-set module_settings.position_precision ${state.positionPrecision}`)
    }

    // --- Telemetry ---
    lines.push(`${p} --set telemetry.device_update_interval ${state.telemetryDeviceInterval}`)

    // --- Каналы ---
    if (state.setPrivatePsk && state.psk) {
      lines.push('')
      lines.push('# Приватный канал')
      lines.push(`${p} --ch-index 0 --ch-set psk "base64:${state.psk}"`)
      lines.push(`${p} --ch-index 0 --ch-set name "${state.channelName}"`)
      lines.push(`${p} --ch-index 0 --ch-set uplink_enabled ${state.uplinkEnabled}`)
      lines.push(`${p} --ch-index 0 --ch-set downlink_enabled ${state.downlinkEnabled}`)
      // Частота (переопределение)
      if (state.frequencyOverride) {
        lines.push(`${p} --ch-index 0 --ch-set frequency ${state.frequencyOverride}`)
      }
    }

    return lines
  }, [state])

  const commandText = useMemo(() => commands.join('\n'), [commands])

  // ---------------------------------------------------------------------------
  // Генерация YAML конфига
  // ---------------------------------------------------------------------------

  const yamlConfig = useMemo(() => {
    const ylines: string[] = []
    ylines.push('# Meshtastic T-Echo Configuration')
    ylines.push('# Прошивка 2.7.15 | Использование: python -m meshtastic --configure config.yaml')
    ylines.push('# T-Echo должен быть подключён по USB!')
    ylines.push('')

    // Owner
    if (state.owner) {
      ylines.push(`owner: "${state.owner}"`)
    }
    if (state.ownerShort) {
      ylines.push(`owner_short: "${state.ownerShort}"`)
    }
    if (state.owner || state.ownerShort) {
      ylines.push('')
    }

    // Config sections (localConfig)
    ylines.push('config:')
    ylines.push('  device:')
    ylines.push(`    role: ${state.role}`)
    ylines.push(`    node_info_broadcast_secs: ${state.nodeInfoBroadcastSecs}`)
    ylines.push('  lora:')
    ylines.push(`    region: ${state.region}`)
    ylines.push(`    modem_preset: ${state.modemPreset}`)
    ylines.push(`    tx_power: ${state.txPower}`)
    ylines.push(`    use_preamble: ${state.usePreamble}`)
    ylines.push('  network:')
    ylines.push(`    hop_limit: ${state.hopLimit}`)
    ylines.push(`    rebroadcast_mode: ${state.rebroadcastMode}`)
    ylines.push('  power:')
    ylines.push(`    is_power_saving: ${state.powerSaving}`)
    if (SLEEP_ROLES.has(state.role)) {
      ylines.push(`    ls_secs: ${state.sleepInterval}`)
      ylines.push(`    min_wake_secs: ${state.minWake}`)
    }
    ylines.push('  bluetooth:')
    ylines.push(`    enabled: ${state.bluetoothEnabled}`)
    if (state.bluetoothEnabled && state.bluetoothFixedPin) {
      ylines.push(`    fixed_pin: "${state.bluetoothFixedPin}"`)
    }
    ylines.push('  display:')
    ylines.push(`    screen_on_secs: ${state.screenOnSecs}`)
    ylines.push('  position:')
    ylines.push(`    gps_mode: ${state.gpsMode}`)
    if (state.gpsMode === 'ENABLED') {
      ylines.push(`    gps_update_interval: ${state.gpsUpdateInterval}`)
    }
    ylines.push(`    position_flags: ${state.positionFlags}`)

    ylines.push('')
    ylines.push('module_config:')
    ylines.push('  telemetry:')
    ylines.push(`    device_update_interval: ${state.telemetryDeviceInterval}`)
    ylines.push('  channel:')
    ylines.push('    module_settings:')
    ylines.push(`      position_precision: ${state.positionPrecision}`)

    // Channel commands (as comments in YAML)
    if (state.setPrivatePsk && state.psk) {
      ylines.push('')
      ylines.push('# Каналы необходимо настроить отдельно командами:')
      ylines.push(`# python -m meshtastic --ch-index 0 --ch-set psk "base64:${state.psk}"`)
      ylines.push(`# python -m meshtastic --ch-index 0 --ch-set name "${state.channelName}"`)
      ylines.push(`# python -m meshtastic --ch-index 0 --ch-set uplink_enabled ${state.uplinkEnabled}`)
      ylines.push(`# python -m meshtastic --ch-index 0 --ch-set downlink_enabled ${state.downlinkEnabled}`)
    }

    return ylines.join('\n')
  }, [state])

  // ---------------------------------------------------------------------------
  // Копирование / Скачивание
  // ---------------------------------------------------------------------------

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
    toast({ title: 'Скачано', description: `${filename}` })
  }, [toast])

  const handleGeneratePsk = useCallback(() => {
    updateField('psk', generatePSK())
  }, [updateField])

  // ---------------------------------------------------------------------------
  // Показываемое содержимое
  // ---------------------------------------------------------------------------

  const displayContent = state.outputMode === 'yaml' ? yamlConfig : commandText

  // ===========================================================================
  // Рендер
  // ===========================================================================

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ================================================================= */}
      {/* Выбор канала из созданных                                         */}
      {/* ================================================================= */}
      {channels.length > 0 && (
        <Card className="border-teal-200 dark:border-teal-800">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Radio className="size-4 text-teal-500" />
              Загрузить настройки канала
            </div>
            <Select
              value={state.selectedChannelId || 'none'}
              onValueChange={handleChannelSelect}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите канал..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Без канала (ручные настройки)</span>
                </SelectItem>
                {channels.map(ch => (
                  <SelectItem key={ch.id} value={ch.id}>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{ch.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {ch.region} · {ch.modemPreset}
                      </span>
                      {ch.frequency && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600">
                          {ch.frequency} МГц
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              При выборе канала автоматически подтягиваются: PSK, регион, модем пресет, частота, uplink/downlink
            </p>
          </CardContent>
        </Card>
      )}

      {/* ================================================================= */}
      {/* Настройки прошивки                                                 */}
      {/* ================================================================= */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="size-5 text-muted-foreground" />
            Настройки прошивки Meshtastic 2.7.15
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Accordion
            type="multiple"
            defaultValue={['device', 'lora', 'gps']}
            className="w-full"
          >
            {/* ============================================================== */}
            {/* Секция 1: Устройство                                           */}
            {/* ============================================================== */}
            <AccordionItem value="device">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Cpu className="size-4 text-muted-foreground" />
                  <span className="font-semibold">Устройство</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-5 pb-2">
                  {/* --- Владелец --- */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="owner" className="flex items-center gap-1.5">
                        <Settings className="size-3.5 text-muted-foreground" />
                        Имя владельца (owner)
                      </Label>
                      <Input
                        id="owner"
                        value={state.owner}
                        onChange={(e) => updateField('owner', e.target.value)}
                        placeholder="Например: Иван"
                        maxLength={128}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="owner-short" className="flex items-center gap-1.5">
                        Короткое имя (owner_short)
                      </Label>
                      <Input
                        id="owner-short"
                        value={state.ownerShort}
                        onChange={(e) => updateField('ownerShort', e.target.value)}
                        placeholder="Например: ИВ"
                        maxLength={5}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Роль */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Shield className="size-3.5 text-muted-foreground" />
                      Роль устройства (device.role)
                    </Label>
                    <Select
                      value={state.role}
                      onValueChange={(v) => updateField('role', v as DeviceRole)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_DESCRIPTIONS) as DeviceRole[]).map((role) => (
                          <SelectItem key={role} value={role}>
                            <span className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${ROLE_BADGE_COLORS[role]}`}
                              >
                                {role}
                              </span>
                              <span className={`text-xs text-muted-foreground ${DEPRECATED_ROLES.has(role) ? 'line-through' : ''}`}>
                                {ROLE_DESCRIPTIONS[role].split(' — ')[0]}
                              </span>
                              {DEPRECATED_ROLES.has(role) && (
                                <span className="text-[10px] text-red-500">устарело</span>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground pl-1">
                      {ROLE_DESCRIPTIONS[state.role]}
                    </p>
                    {DEPRECATED_ROLES.has(state.role) && (
                      <Alert className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
                        <Info className="size-4 text-red-500" />
                        <AlertDescription className="text-red-700 dark:text-red-300 text-xs">
                          Эта роль помечена как устаревшая в Meshtastic 2.7.x. Рекомендуется выбрать другую.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <Separator />

                  {/* Интервал вещания ноды */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      Интервал вещания ноды (device.node_info_broadcast_secs)
                    </Label>
                    <Select
                      value={isCustomBroadcastInterval ? '__custom__' : String(state.nodeInfoBroadcastSecs)}
                      onValueChange={(v) => {
                        if (v === '__custom__') return
                        updateField('nodeInfoBroadcastSecs', Number(v))
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите интервал" />
                      </SelectTrigger>
                      <SelectContent>
                        {BROADCAST_INTERVAL_PRESETS.map((p) => (
                          <SelectItem key={p.value} value={String(p.value)}>
                            {p.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">Другое (вручную)</SelectItem>
                      </SelectContent>
                    </Select>

                    {isCustomBroadcastInterval && (
                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          type="number"
                          min={30}
                          value={state.nodeInfoBroadcastSecs}
                          onChange={(e) =>
                            updateField('nodeInfoBroadcastSecs', Number(e.target.value) || 900)
                          }
                          className="w-32"
                          placeholder="Секунды"
                        />
                        <span className="text-sm text-muted-foreground">секунд</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Как часто устройство вещает информацию о себе в сеть
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============================================================== */}
            {/* Секция 2: LoRa (Радио)                                         */}
            {/* ============================================================== */}
            <AccordionItem value="lora">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Radio className="size-4 text-muted-foreground" />
                  <span className="font-semibold">LoRa (Радио)</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-5 pb-2">
                  {/* Ряд: Регион + Модем */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Регион */}
                    <div className="space-y-2">
                      <Label htmlFor="region" className="flex items-center gap-1.5">
                        <Radio className="size-3.5 text-muted-foreground" />
                        Регион (lora.region)
                      </Label>
                      <Select
                        value={state.region}
                        onValueChange={(v) => updateField('region', v)}
                      >
                        <SelectTrigger id="region" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REGIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Модем */}
                    <div className="space-y-2">
                      <Label htmlFor="modem" className="flex items-center gap-1.5">
                        <Zap className="size-3.5 text-muted-foreground" />
                        Модем пресет (lora.modem_preset)
                      </Label>
                      <Select
                        value={state.modemPreset}
                        onValueChange={(v) => updateField('modemPreset', v)}
                      >
                        <SelectTrigger id="modem" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODEM_PRESETS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              <span className={m.deprecated ? 'line-through opacity-60' : ''}>
                                {m.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  {/* Мощность передачи */}
                  <div className="space-y-2">
                    <Label htmlFor="tx-power" className="flex items-center gap-1.5">
                      <Zap className="size-3.5 text-muted-foreground" />
                      Мощность передачи (lora.tx_power)
                    </Label>
                    <Select
                      value={String(state.txPower)}
                      onValueChange={(v) => updateField('txPower', Number(v))}
                    >
                      <SelectTrigger id="tx-power" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Максимум (auto)</SelectItem>
                        {Array.from({ length: 20 }, (_, i) => i + 1).map((v) => (
                          <SelectItem key={v} value={String(v)}>
                            {v} {v <= 10 ? '(~20 дБм)' : v <= 15 ? '(~15 дБм)' : '(~10 дБм)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      0 = автоматически максимальная мощность для региона. Значения 1–20 уменьшают мощность.
                    </p>
                  </div>

                  <Separator />

                  {/* Лимит хопов */}
                  <div className="space-y-2">
                    <Label htmlFor="hop-limit" className="flex items-center gap-1.5">
                      Лимит хопов (network.hop_limit)
                    </Label>
                    <Select
                      value={String(state.hopLimit)}
                      onValueChange={(v) => updateField('hopLimit', Number(v))}
                    >
                      <SelectTrigger id="hop-limit" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 7 }, (_, i) => i + 1).map((v) => (
                          <SelectItem key={v} value={String(v)}>
                            {v} {v === 3 ? '(по умолчанию)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Максимальное число пересылок пакета. Увеличение расширяет зону покрытия,
                      но повышает нагрузку на сеть.
                    </p>
                  </div>

                  <Separator />

                  {/* Длинный преамбула */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="use-preamble" className="flex items-center gap-1.5 cursor-pointer">
                        Длинный преамбула (lora.use_preamble)
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <CircleHelp className="size-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          Увеличивает преамбулу с 8 до 32 символов, помогает принять первый пакет.
                          Полезно при слабом сигнале или помехах.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Checkbox
                      id="use-preamble"
                      checked={state.usePreamble}
                      onCheckedChange={(v) => updateField('usePreamble', !!v)}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============================================================== */}
            {/* Секция 3: GPS и Позиция                                         */}
            {/* ============================================================== */}
            <AccordionItem value="gps">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span className="font-semibold">GPS и Позиция</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-5 pb-2">
                  {/* GPS Mode */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-muted-foreground" />
                      GPS режим (position.gps_mode)
                    </Label>
                    <Select
                      value={state.gpsMode}
                      onValueChange={(v) => updateField('gpsMode', v as GpsMode)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ENABLED">Включён (ENABLED)</SelectItem>
                        <SelectItem value="DISABLED">Выключен (DISABLED)</SelectItem>
                        <SelectItem value="NOT_PRESENT">Отсутствует (NOT_PRESENT)</SelectItem>
                      </SelectContent>
                    </Select>
                    {state.gpsMode === 'ENABLED' && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor="gps-interval" className="text-sm text-muted-foreground whitespace-nowrap">
                          GPS интервал (position.gps_update_interval)
                        </Label>
                        <Input
                          id="gps-interval"
                          type="number"
                          min={1}
                          value={state.gpsUpdateInterval}
                          onChange={(e) =>
                            updateField('gpsUpdateInterval', Number(e.target.value) || 30)
                          }
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">сек</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Поле <code className="bg-muted px-1 rounded text-[11px]">gps_enabled</code> устарело в 2.7.x. Используйте <code className="bg-muted px-1 rounded text-[11px]">gps_mode</code>.
                    </p>
                  </div>

                  <Separator />

                  {/* Точность координат (module_settings.position_precision) */}
                  <div className="space-y-2">
                    <Label htmlFor="precision" className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-muted-foreground" />
                      Точность координат (module_settings.position_precision)
                    </Label>
                    <Select
                      value={String(state.positionPrecision)}
                      onValueChange={(v) => updateField('positionPrecision', Number(v))}
                    >
                      <SelectTrigger id="precision" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { value: 0, label: '0 — не передавать' },
                          { value: 13, label: '13 — ~2.9 км (ДЕФОЛТ прошивки)' },
                          { value: 16, label: '16 — ~365 м' },
                          { value: 20, label: '20 — ~23 м' },
                          { value: 24, label: '24 — ~1.4 м' },
                          { value: 32, label: '32 — максимальная (~1 м)' },
                        ].map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Управляет радиусом/обфускацией координат. Меньшие значения — больше скрытность, но ниже точность.
                      Устанавливается на канал через <code className="bg-muted px-1 rounded text-[11px]">module_settings.position_precision</code>.
                    </p>
                  </div>

                  <Separator />

                  {/* Состав данных позиции (position.position_flags) */}
                  <div className="space-y-2">
                    <Label htmlFor="position-flags" className="flex items-center gap-1.5">
                      <Activity className="size-3.5 text-muted-foreground" />
                      Состав данных позиции (position.position_flags)
                    </Label>
                    <Select
                      value={String(state.positionFlags)}
                      onValueChange={(v) => updateField('positionFlags', Number(v))}
                    >
                      <SelectTrigger id="position-flags" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { value: 0, label: '0 — не передавать' },
                          { value: 3, label: '3 — минимальная (ALT+MSL)' },
                          { value: 299, label: '299 — пеший режим (ALT+MSL+DOP+SAT+HEADING)' },
                          { value: 811, label: '811 — дефолт прошивки (+SPEED, транспорт)' },
                          { value: 1023, label: '1023 — все флаги' },
                        ].map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Битовая маска PositionFlags. Определяет, какие поля данных включаются в POSITION-сообщения.
                    </p>
                  </div>

                  {/* Пояснение разницы */}
                  <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                    <Info className="size-4 text-blue-500" />
                    <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                      <strong>position_precision</strong> — насколько точно передаются координаты (радиус обфускации).
                      &nbsp;<strong>position_flags</strong> — какие дополнительные поля (высота, спутники, скорость и т.д.)
                      включаются в сообщение позиции. Это два независимых параметра.
                    </AlertDescription>
                  </Alert>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============================================================== */}
            {/* Секция 4: Электропитание                                        */}
            {/* ============================================================== */}
            <AccordionItem value="power">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Zap className="size-4 text-muted-foreground" />
                  <span className="font-semibold">Электропитание</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-5 pb-2">
                  {/* Экономия энергии */}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="power-saving" className="flex items-center gap-1.5 cursor-pointer">
                      <Zap className="size-3.5 text-muted-foreground" />
                      Экономия энергии (power.is_power_saving)
                    </Label>
                    <Checkbox
                      id="power-saving"
                      checked={state.powerSaving}
                      onCheckedChange={(v) => updateField('powerSaving', !!v)}
                    />
                  </div>

                  {/* Настройки сна (только для спящих ролей) */}
                  {SLEEP_ROLES.has(state.role) && (
                    <div className="space-y-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                        <Zap className="size-4" />
                        Настройки сна (для {state.role})
                      </div>

                      {/* Интервал сна */}
                      <div className="space-y-2">
                        <Label htmlFor="sleep-interval">Интервал сна (power.ls_secs)</Label>
                        <Select
                          value={isCustomSleep ? '__custom__' : String(state.sleepInterval)}
                          onValueChange={(v) => {
                            if (v === '__custom__') return
                            updateField('sleepInterval', Number(v))
                          }}
                        >
                          <SelectTrigger id="sleep-interval" className="w-full">
                            <SelectValue placeholder="Выберите интервал" />
                          </SelectTrigger>
                          <SelectContent>
                            {SLEEP_PRESETS.map((p) => (
                              <SelectItem key={p.value} value={String(p.value)}>
                                {p.label}
                              </SelectItem>
                            ))}
                            <SelectItem value="__custom__">Другое (вручную)</SelectItem>
                          </SelectContent>
                        </Select>

                        {isCustomSleep && (
                          <div className="flex items-center gap-2 pt-1">
                            <Input
                              type="number"
                              min={1}
                              value={state.sleepInterval}
                              onChange={(e) =>
                                updateField('sleepInterval', Number(e.target.value) || 300)
                              }
                              className="w-32"
                              placeholder="Секунды"
                            />
                            <span className="text-sm text-muted-foreground">секунд</span>
                          </div>
                        )}
                      </div>

                      {/* Время бодрствования */}
                      <div className="space-y-2">
                        <Label htmlFor="min-wake">Мин. бодрствование (power.min_wake_secs)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="min-wake"
                            type="number"
                            min={1}
                            value={state.minWake}
                            onChange={(e) =>
                              updateField('minWake', Number(e.target.value) || 10)
                            }
                            className="w-32"
                          />
                          <span className="text-sm text-muted-foreground">секунд</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!SLEEP_ROLES.has(state.role) && (
                    <p className="text-xs text-muted-foreground">
                      Настройки сна доступны только для ролей TRACKER, SENSOR и TAK_TRACKER
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============================================================== */}
            {/* Секция 5: Телеметрия                                            */}
            {/* ============================================================== */}
            <AccordionItem value="telemetry">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Activity className="size-4 text-muted-foreground" />
                  <span className="font-semibold">Телеметрия</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-2">
                  <div className="space-y-2">
                    <Label htmlFor="telemetry-device">
                      Интервал устройства (telemetry.device_update_interval)
                    </Label>
                    <Select
                      value={String(state.telemetryDeviceInterval)}
                      onValueChange={(v) => updateField('telemetryDeviceInterval', Number(v))}
                    >
                      <SelectTrigger id="telemetry-device" className="w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { value: 60, label: '1 мин' },
                          { value: 120, label: '2 мин' },
                          { value: 300, label: '5 мин' },
                          { value: 600, label: '10 мин' },
                          { value: 900, label: '15 мин' },
                          { value: 1800, label: '30 мин' },
                          { value: 3600, label: '1 час' },
                        ].map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Интервал отправки телеметрии: уровень батареи, напряжение. SNR/RSSI передаются автоматически с каждым пакетом.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============================================================== */}
            {/* Секция 6: Bluetooth                                              */}
            {/* ============================================================== */}
            <AccordionItem value="bluetooth">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Bluetooth className="size-4 text-muted-foreground" />
                  <span className="font-semibold">Bluetooth</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-5 pb-2">
                  {/* Bluetooth вкл/выкл */}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="bluetooth-enabled" className="flex items-center gap-1.5 cursor-pointer">
                      <Bluetooth className="size-3.5 text-muted-foreground" />
                      Bluetooth (bluetooth.enabled)
                    </Label>
                    <Checkbox
                      id="bluetooth-enabled"
                      checked={state.bluetoothEnabled}
                      onCheckedChange={(v) => updateField('bluetoothEnabled', !!v)}
                    />
                  </div>

                  {/* Предупреждение при отключении Bluetooth */}
                  {!state.bluetoothEnabled && (
                    <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                      <Info className="size-4 text-amber-500" />
                      <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
                        Без Bluetooth устройство не будет доступно из приложения Meshtastic.
                        Настройка возможна только через USB.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* PIN код (только при включённом Bluetooth) */}
                  {state.bluetoothEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="bluetooth-pin" className="flex items-center gap-1.5">
                        PIN код (bluetooth.fixed_pin)
                      </Label>
                      <Input
                        id="bluetooth-pin"
                        value={state.bluetoothFixedPin}
                        onChange={(e) => updateField('bluetoothFixedPin', e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        className="w-32"
                        inputMode="numeric"
                      />
                      <p className="text-xs text-muted-foreground">
                        Необязательный фиксированный PIN для сопряжения (макс. 6 цифр).
                        Оставьте пустым для случайного PIN.
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============================================================== */}
            {/* Секция 7: Дисплей                                               */}
            {/* ============================================================== */}
            <AccordionItem value="display">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Monitor className="size-4 text-muted-foreground" />
                  <span className="font-semibold">Дисплей</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-2">
                  {/* Таймаут экрана */}
                  <div className="space-y-2">
                    <Label htmlFor="screen-timeout" className="flex items-center gap-1.5">
                      <Monitor className="size-3.5 text-muted-foreground" />
                      Таймаут экрана (display.screen_on_secs)
                    </Label>
                    <Select
                      value={String(state.screenOnSecs)}
                      onValueChange={(v) => updateField('screenOnSecs', Number(v))}
                    >
                      <SelectTrigger id="screen-timeout" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCREEN_TIMEOUT_PRESETS.map((p) => (
                          <SelectItem key={p.value} value={String(p.value)}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Сколько секунд экран остаётся включённым после последнего действия.
                      Меньше значение — дольше работает батарея.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============================================================== */}
            {/* Секция 8: Сеть                                                  */}
            {/* ============================================================== */}
            <AccordionItem value="network">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Network className="size-4 text-muted-foreground" />
                  <span className="font-semibold">Сеть</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-2">
                  {/* Режим ретрансляции */}
                  <div className="space-y-2">
                    <Label htmlFor="rebroadcast" className="flex items-center gap-1.5">
                      <Network className="size-3.5 text-muted-foreground" />
                      Режим ретрансляции (network.rebroadcast_mode)
                    </Label>
                    <Select
                      value={state.rebroadcastMode}
                      onValueChange={(v) => updateField('rebroadcastMode', v as RebroadcastMode)}
                    >
                      <SelectTrigger id="rebroadcast" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">
                          <span className="flex flex-col">
                            <span>ALL</span>
                            <span className="text-xs text-muted-foreground font-normal">
                              {REBROADCAST_DESCRIPTIONS.ALL}
                            </span>
                          </span>
                        </SelectItem>
                        <SelectItem value="LOCAL_SKIP">
                          <span className="flex flex-col">
                            <span>LOCAL_SKIP</span>
                            <span className="text-xs text-muted-foreground font-normal">
                              {REBROADCAST_DESCRIPTIONS.LOCAL_SKIP}
                            </span>
                          </span>
                        </SelectItem>
                        <SelectItem value="SIMPLE">
                          <span className="flex flex-col">
                            <span>SIMPLE</span>
                            <span className="text-xs text-muted-foreground font-normal">
                              {REBROADCAST_DESCRIPTIONS.SIMPLE}
                            </span>
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {REBROADCAST_DESCRIPTIONS[state.rebroadcastMode]}
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* Настройки канала                                                   */}
      {/* ================================================================= */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="size-5 text-muted-foreground" />
            Настройки канала
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Приватный PSK toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="set-private" className="cursor-pointer">
              Установить приватный ключ (PSK 256 бит)
            </Label>
            <Checkbox
              id="set-private"
              checked={state.setPrivatePsk}
              onCheckedChange={(v) => updateField('setPrivatePsk', !!v)}
            />
          </div>

          {state.setPrivatePsk && (
            <>
              {/* Имя канала */}
              <div className="space-y-2">
                <Label htmlFor="channel-name">Имя канала</Label>
                <Input
                  id="channel-name"
                  value={state.channelName}
                  onChange={(e) => updateField('channelName', e.target.value)}
                  placeholder="Введите имя канала"
                  maxLength={10}
                />
              </div>

              {/* PSK */}
              <div className="space-y-2">
                <Label htmlFor="psk" className="flex items-center gap-1.5">
                  Ключ шифрования (PSK) — 256 бит (32 байта)
                </Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="psk"
                      type={state.showPsk ? 'text' : 'password'}
                      value={state.psk}
                      onChange={(e) => updateField('psk', e.target.value)}
                      placeholder="Сгенерируйте или вставьте Base64 ключ"
                      className="pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => updateField('showPsk', !state.showPsk)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={state.showPsk ? 'Скрыть PSK' : 'Показать PSK'}
                    >
                      {state.showPsk ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePsk}
                    className="shrink-0"
                  >
                    <Shuffle className="size-4 mr-1.5" />
                    Сгенерировать
                  </Button>
                </div>
                {state.psk && (
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {state.showPsk ? formatPsk(state.psk) : '\u2022'.repeat(Math.min(state.psk.length, 44))}
                  </p>
                )}
              </div>

              <Separator />

              {/* Частота (переопределение) */}
              <div className="space-y-2">
                <Label htmlFor="freq-override" className="flex items-center gap-1.5">
                  <Radio className="size-3.5 text-muted-foreground" />
                  Переопределение частоты (МГц)
                </Label>
                <Input
                  id="freq-override"
                  type="number"
                  step="0.1"
                  min="433.0"
                  max="434.0"
                  value={state.frequencyOverride}
                  onChange={(e) => updateField('frequencyOverride', e.target.value)}
                  placeholder="Авто (стандартная для региона)"
                  className="font-mono text-sm w-40"
                />
                <p className="text-xs text-muted-foreground">
                  Оставьте пустым для стандартной. Например: 433.175
                </p>
              </div>

              <Separator />

              {/* Uplink / Downlink */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="uplink" className="cursor-pointer">
                    Uplink (uplink_enabled)
                  </Label>
                  <Checkbox
                    id="uplink"
                    checked={state.uplinkEnabled}
                    onCheckedChange={(v) => updateField('uplinkEnabled', !!v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="downlink" className="cursor-pointer">
                    Downlink (downlink_enabled)
                  </Label>
                  <Checkbox
                    id="downlink"
                    checked={state.downlinkEnabled}
                    onCheckedChange={(v) => updateField('downlinkEnabled', !!v)}
                  />
                </div>
              </div>

              {/* Подсказка */}
              <Alert className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                <Info className="size-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  Канал 0 — первичный, его нельзя удалить. Вместо этого мы устанавливаем
                  приватный PSK на него. Все устройства в сети должны использовать одинаковый ключ.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* Сгенерированная команда / конфиг                                    */}
      {/* ================================================================= */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Terminal className="size-5 text-muted-foreground" />
              Сгенерированный скрипт
            </CardTitle>
            {/* Переключатель вывода */}
            <div className="flex items-center rounded-lg border p-0.5 self-start">
              <button
                onClick={() => updateField('outputMode', 'commands')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                  state.outputMode === 'commands'
                    ? 'bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Terminal className="size-3.5" />
                Команды
              </button>
              <button
                onClick={() => updateField('outputMode', 'yaml')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                  state.outputMode === 'yaml'
                    ? 'bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="size-3.5" />
                YAML
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Текущие настройки — бейдж */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={ROLE_BADGE_COLORS[state.role]}>
              {state.role}
            </Badge>
            <span className="text-xs text-muted-foreground">{state.region}</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs text-muted-foreground">{state.modemPreset}</span>
            {!state.bluetoothEnabled && (
              <>
                <span className="text-xs text-muted-foreground">/</span>
                <span className="text-xs text-amber-600 dark:text-amber-400">BT off</span>
              </>
            )}
            {state.setPrivatePsk && state.psk && (
              <>
                <span className="text-xs text-muted-foreground">/</span>
                <Lock className="size-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">приватный канал</span>
              </>
            )}
          </div>

          {/* Блок с командой */}
          <div className="relative rounded-lg bg-zinc-900 text-zinc-100 p-4 overflow-x-auto max-h-[400px] overflow-y-auto">
            <pre className="text-sm font-mono whitespace-pre-wrap break-all leading-relaxed">
              <code>{displayContent}</code>
            </pre>
          </div>

          {/* Кнопки действий */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => handleCopy(displayContent, state.outputMode === 'yaml' ? 'YAML конфиг скопирован' : 'Команды скопированы')}
            >
              <Copy className="size-4 mr-1.5" />
              Копировать
            </Button>

            {state.outputMode === 'commands' ? (
              <Button
                variant="outline"
                onClick={() => handleDownload(
                  `# Meshtastic T-Echo Configuration\n# Generated by Forest Track Dashboard\n# Firmware 2.7.15 | Run in PowerShell: .\\meshtastic-setup.ps1\n# T-Echo must be connected via USB!\n\n${commandText}\n`,
                  'meshtastic-setup.ps1'
                )}
              >
                <Download className="size-4 mr-1.5" />
                Скачать .ps1
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => handleDownload(yamlConfig, 'meshtastic-config.yaml')}
              >
                <Download className="size-4 mr-1.5" />
                Скачать .yaml
              </Button>
            )}
          </div>

          {/* Подсказка */}
          {state.outputMode === 'commands' ? (
            <p className="text-xs text-muted-foreground">
              Копируйте и вставляйте команды <strong>по одной</strong> в PowerShell с подключённым T-Echo.
              Или скачайте .ps1 файл и запустите: <code className="bg-muted px-1 rounded">.\meshtastic-setup.ps1</code>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Скачайте .yaml файл и запустите: <code className="bg-muted px-1 rounded">python -m meshtastic --configure meshtastic-config.yaml</code>
              {' '}— это самый надёжный способ настройки. Канальные команды нужно выполнить отдельно.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
