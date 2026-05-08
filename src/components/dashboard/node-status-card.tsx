'use client'

import { useState } from 'react'
import type { MeshNode } from '@/lib/types'
import { ROLE_META } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  Radio,
  MapPin,
  Clock,
  Cpu,
  Signal,
  Zap,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  Moon,
  Sun,
  Repeat,
  EyeOff,
  Thermometer,
  Droplets,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  if (minutes < 1) return 'Только что'
  if (minutes < 60) return `${minutes} мин. назад`
  if (hours < 24) return `${hours} ч. назад`
  return `${Math.floor(hours / 24)} дн. назад`
}

function BatteryLevelIcon({ level, className }: { level: number | null; className?: string }) {
  if (level == null) return <Battery className={className} />
  if (level > 75) return <BatteryFull className={className} />
  if (level > 50) return <BatteryMedium className={className} />
  if (level > 25) return <BatteryLow className={className} />
  return <Battery className={className} />
}

function getBatteryColor(level: number | null): string {
  if (level == null) return 'bg-gray-300 dark:bg-gray-600'
  if (level > 60) return 'bg-green-500'
  if (level > 30) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getBatteryTextColor(level: number | null): string {
  if (level == null) return 'text-gray-400'
  if (level > 60) return 'text-green-500'
  if (level > 30) return 'text-yellow-500'
  return 'text-red-500'
}

function getStatusDot(status: MeshNode['status']): { color: string; pulse: boolean } {
  switch (status) {
    case 'online':
      return { color: 'bg-green-500', pulse: true }
    case 'offline':
      return { color: 'bg-red-500', pulse: false }
    default:
      return { color: 'bg-gray-400', pulse: false }
  }
}

function formatSleepInterval(seconds: number | null): string {
  if (seconds == null) return '—'
  if (seconds < 60) return `${seconds} сек`
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин`
  return `${(seconds / 3600).toFixed(1)} ч`
}

function formatWakeTime(seconds: number | null): string {
  if (seconds == null) return '—'
  return `${seconds} сек`
}

// ---------------------------------------------------------------------------
// Battery runtime estimation
// ---------------------------------------------------------------------------

function estimateRuntime(node: MeshNode): string | null {
  const telemetry = node.telemetry
  if (!telemetry || telemetry.length < 2) return null

  // Telemetry is ordered desc by createdAt, so last item is the oldest
  const newest = telemetry[0]
  const oldest = telemetry[telemetry.length - 1]

  const timeDiffMs = new Date(newest.createdAt).getTime() - new Date(oldest.createdAt).getTime()
  const timeDiffHours = timeDiffMs / 3600000

  if (timeDiffHours < 0.5) return null // Need at least 30 min of data

  // Battery dropped from oldest to newest (desc order → oldest has higher index)
  const batteryDrop = oldest.batteryLevel - newest.batteryLevel

  if (batteryDrop <= 0) return null // Battery stable or charging

  // Drain rate: % per hour
  const drainPerHour = batteryDrop / timeDiffHours

  // Estimated remaining hours until 0%
  const remainingHours = node.batteryLevel / drainPerHour

  if (remainingHours <= 0) return 'мало'
  if (remainingHours < 1) return `${Math.round(remainingHours * 60)} мин`
  if (remainingHours < 24) return `~${Math.round(remainingHours)} ч`
  if (remainingHours < 48) return `~${Math.round(remainingHours * 10) / 10} дн`
  return `~${Math.floor(remainingHours / 24)} дн`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NodeStatusCardProps {
  node: MeshNode
  onDelete?: (id: string) => void
  onEdit?: (node: MeshNode) => void
}

export default function NodeStatusCard({ node, onDelete, onEdit }: NodeStatusCardProps) {
  const [expanded, setExpanded] = useState(false)

  const batteryColor = getBatteryColor(node.batteryLevel)
  const batteryTextColor = getBatteryTextColor(node.batteryLevel)
  const statusDot = getStatusDot(node.status)
  const hasPosition = node.latitude !== null && node.longitude !== null
  const meta = ROLE_META[node.role]
  const sleeps = meta?.sleeps ?? false
  const relays = meta?.relays ?? true
  const lastTelemetry = node.telemetry?.[0]
  const hasTemp = lastTelemetry?.temperature != null
  const hasHumidity = lastTelemetry?.humidity != null
  const estimatedRuntime = estimateRuntime(node)

  return (
    <div className="border-b last:border-b-0">
      {/* ── Single row ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none hover:bg-muted/30 transition-colors" onClick={() => setExpanded(!expanded)}>
        {/* Expand icon */}
        <span className="text-muted-foreground shrink-0">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>

        {/* Status dot */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {statusDot.pulse && (
                <span
                  className={`absolute inline-flex h-full w-full rounded-full ${statusDot.color} opacity-75 animate-ping`}
                />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusDot.color}`} />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {node.status === 'online'
                ? 'В сети'
                : node.status === 'offline'
                  ? 'Не в сети'
                  : 'Статус неизвестен'}
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Name */}
        <span className="font-medium text-sm min-w-0 truncate">{node.name}</span>

        {/* Short name */}
        <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 shrink-0">
          {node.shortName}
        </Badge>

        {/* Role */}
        <Badge variant="secondary" className="text-[11px] px-2 py-0 shrink-0">
          {meta?.label ?? node.role}
        </Badge>

        {/* Battery + USB + runtime estimate */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <BatteryLevelIcon level={node.batteryLevel} className={`h-3.5 w-3.5 ${batteryTextColor}`} />
          <span className={`text-xs font-medium ${batteryTextColor}`}>{node.batteryLevel != null ? `${node.batteryLevel}%` : '?'}</span>
          <div className="w-12 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${batteryColor} transition-all duration-500`}
              style={{ width: node.batteryLevel != null ? `${Math.max(node.batteryLevel, 0)}%` : '0%' }}
            />
          </div>
          {node.usbPower && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700 gap-0.5">
                  <Zap className="h-2.5 w-2.5" />USB
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Устройство подключено по USB</TooltipContent>
            </Tooltip>
          )}
          {estimatedRuntime && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] text-muted-foreground ml-1">(~{estimatedRuntime})</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Примерное время работы до разряда (на основе расхода батареи)</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Signal RSSI */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 ml-2">
          <Radio className="h-3.5 w-3.5" />
          <span>{node.rssi} дБм</span>
        </div>

        {/* Last seen */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 ml-2">
          <Clock className="h-3 w-3" />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={getRelativeTime(node.lastSeen) !== 'Только что' ? 'text-amber-600 dark:text-amber-400' : ''}>
                {getRelativeTime(node.lastSeen)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Последний пакет: {new Date(node.lastSeen).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(node)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Редактировать</TooltipContent>
            </Tooltip>
          )}
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить узел?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Узел «{node.name}» ({node.shortName}) будет удалён из сети. Это действие нельзя отменить.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(node.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Удалить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="px-4 py-3 bg-muted/20 border-t">
          <div className="grid grid-cols-4 gap-x-8 gap-y-2.5 text-sm">
            {/* SNR */}
            <div className="flex items-center gap-2">
              <Signal className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">SNR:</span>
              <span className="font-medium">{node.snr.toFixed(1)} дБ</span>
            </div>

            {/* Voltage + USB power */}
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Напряжение:</span>
              <span className="font-medium">{node.voltage != null ? `${node.voltage.toFixed(2)} В` : '—'}</span>
              {node.usbPower && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700 gap-0.5 ml-1">
                  <Zap className="h-2.5 w-2.5" />USB
                </Badge>
              )}
            </div>

            {/* Temperature */}
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Температура:</span>
              <span className="font-medium">
                {hasTemp ? `${lastTelemetry!.temperature!.toFixed(1)} °C` : '—'}
              </span>
            </div>

            {/* Humidity */}
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Влажность:</span>
              <span className="font-medium">
                {hasHumidity ? `${lastTelemetry!.humidity!.toFixed(1)}%` : '—'}
              </span>
            </div>

            {/* Position */}
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Позиция:</span>
              <span className="font-medium">
                {hasPosition
                  ? `${node.latitude!.toFixed(5)}, ${node.longitude!.toFixed(5)}`
                  : 'Нет данных'}
              </span>
            </div>

            {/* Altitude */}
            {hasPosition && node.altitude != null && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Высота:</span>
                <span className="font-medium">{node.altitude.toFixed(0)} м</span>
              </div>
            )}

            {/* Sleep behavior */}
            <div className="flex items-center gap-2">
              {sleeps ? (
                <>
                  <Moon className="h-4 w-4 text-purple-500 shrink-0" />
                  <span className="text-muted-foreground">Сон:</span>
                  <span className="font-medium">каждые {formatSleepInterval(node.lsSecs)}</span>
                  {node.minWakeSecs != null && (
                    <span className="text-muted-foreground text-xs">(бодр. {formatWakeTime(node.minWakeSecs)})</span>
                  )}
                </>
              ) : (
                <>
                  <Sun className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="font-medium text-green-600 dark:text-green-400">Всегда бодрствует</span>
                </>
              )}
            </div>

            {/* Relay */}
            <div className="flex items-center gap-2">
              {relays ? (
                <>
                  <Repeat className="h-4 w-4 text-teal-500 shrink-0" />
                  <span className="font-medium text-teal-600 dark:text-teal-400">Ретранслирует</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Только свои данные</span>
                </>
              )}
            </div>

            {/* Hardware model */}
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Модель:</span>
              <span className="font-medium">{node.hardwareModel}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
