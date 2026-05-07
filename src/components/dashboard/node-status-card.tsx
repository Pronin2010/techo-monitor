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
  Eye,
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

function BatteryLevelIcon({ level, className }: { level: number; className?: string }) {
  if (level > 75) return <BatteryFull className={className} />
  if (level > 50) return <BatteryMedium className={className} />
  if (level > 25) return <BatteryLow className={className} />
  return <Battery className={className} />
}

function getBatteryColor(level: number): string {
  if (level > 60) return 'bg-green-500'
  if (level > 30) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getBatteryTextColor(level: number): string {
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

  return (
    <div className="border rounded-lg overflow-hidden transition-colors hover:bg-muted/30">
      {/* ── Collapsed row ── */}
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand icon */}
        <span className="text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>

        {/* Status dot */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="relative flex h-3 w-3 shrink-0">
              {statusDot.pulse && (
                <span
                  className={`absolute inline-flex h-full w-full rounded-full ${statusDot.color} opacity-75 animate-ping`}
                />
              )}
              <span
                className={`relative inline-flex h-3 w-3 rounded-full ${statusDot.color}`}
              />
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

        {/* Name + shortName */}
        <div className="flex items-center gap-2 min-w-0 w-[200px]">
          <span className="font-medium truncate">{node.name}</span>
          <Badge variant="outline" className="font-mono text-[10px] shrink-0">
            {node.shortName}
          </Badge>
        </div>

        {/* Role */}
        <Badge variant="secondary" className="text-xs shrink-0 w-[130px] justify-center">
          {meta?.label ?? node.role}
        </Badge>

        {/* Battery */}
        <div className="flex items-center gap-2 w-[140px] shrink-0">
          <BatteryLevelIcon level={node.batteryLevel} className={`h-4 w-4 ${batteryTextColor}`} />
          <div className="flex-1">
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all duration-500 ease-out rounded-full ${batteryColor}`}
                style={{ width: `${Math.max(node.batteryLevel, 0)}%` }}
              />
            </div>
          </div>
          <span className={`text-xs font-medium ${batteryTextColor} w-8 text-right`}>
            {node.batteryLevel}%
          </span>
        </div>

        {/* Signal RSSI */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-[80px] shrink-0">
          <Radio className="h-3.5 w-3.5" />
          <span>{node.rssi} дБм</span>
        </div>

        {/* Last seen */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-[120px] shrink-0">
          <Clock className="h-3 w-3" />
          <span>{getRelativeTime(node.lastSeen)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onEdit(node)}
                >
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
        <div className="border-t px-4 py-4 bg-muted/20">
          <div className="grid grid-cols-4 gap-x-8 gap-y-3">
            {/* SNR */}
            <div className="flex items-center gap-2 text-sm">
              <Signal className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">SNR:</span>
              <span className="font-medium">{node.snr.toFixed(1)} дБ</span>
            </div>

            {/* Voltage */}
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Напряжение:</span>
              <span className="font-medium">{node.voltage.toFixed(2)} В</span>
            </div>

            {/* Temperature */}
            <div className="flex items-center gap-2 text-sm">
              <Thermometer className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Температура:</span>
              <span className="font-medium">
                {hasTemp ? `${lastTelemetry!.temperature!.toFixed(1)} °C` : '—'}
              </span>
            </div>

            {/* Humidity */}
            <div className="flex items-center gap-2 text-sm">
              <Droplets className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Влажность:</span>
              <span className="font-medium">
                {hasHumidity ? `${lastTelemetry!.humidity!.toFixed(1)}%` : '—'}
              </span>
            </div>

            {/* Position */}
            <div className="flex items-center gap-2 text-sm">
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
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Высота:</span>
                <span className="font-medium">{node.altitude.toFixed(0)} м</span>
              </div>
            )}

            {/* Sleep/Relay behavior */}
            <div className="flex items-center gap-2 text-sm">
              {sleeps ? (
                <>
                  <Moon className="h-4 w-4 text-purple-500 shrink-0" />
                  <span className="text-muted-foreground">Сон:</span>
                  <span className="font-medium">
                    каждые {formatSleepInterval(node.lsSecs)}
                  </span>
                  {node.minWakeSecs != null && (
                    <span className="text-muted-foreground text-xs">
                      (бодр. {formatWakeTime(node.minWakeSecs)})
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Sun className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="font-medium text-green-600 dark:text-green-400">
                    Всегда бодрствует
                  </span>
                </>
              )}
            </div>

            {/* Relay */}
            <div className="flex items-center gap-2 text-sm">
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
            <div className="flex items-center gap-2 text-sm">
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
