'use client'

import type { MeshNode, NodeRole } from '@/lib/types'
import { ROLE_META } from '@/lib/types'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
  Wifi,
  WifiOff,
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
  Moon,
  Sun,
  Repeat,
  Eye,
  EyeOff,
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

function getSignalQuality(snr: number): { label: string; color: string } {
  if (snr >= 7) return { label: 'Отличный', color: 'text-green-500' }
  if (snr >= 3) return { label: 'Хороший', color: 'text-yellow-500' }
  return { label: 'Слабый', color: 'text-red-500' }
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

function getRoleBadgeVariant(role: NodeRole): 'default' | 'secondary' | 'outline' | 'destructive' {
  const meta = ROLE_META[role]
  switch (meta?.color) {
    case 'teal': return 'default'
    case 'amber': return 'secondary'
    case 'green': return 'destructive'
    default: return 'outline'
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
  const batteryColor = getBatteryColor(node.batteryLevel)
  const batteryTextColor = getBatteryTextColor(node.batteryLevel)
  const signal = getSignalQuality(node.snr)
  const statusDot = getStatusDot(node.status)
  const hasPosition = node.latitude !== null && node.longitude !== null
  const meta = ROLE_META[node.role]
  const sleeps = meta?.sleeps ?? false
  const relays = meta?.relays ?? true

  return (
    <Card className="hover:scale-[1.01] transition-transform duration-200 ease-in-out overflow-hidden">
      {/* ── Header ── */}
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
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

            {/* Node name */}
            <CardTitle className="truncate text-base">{node.name}</CardTitle>
          </div>

          {/* Short name badge + actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className="font-mono text-xs">
              {node.shortName}
            </Badge>
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
      </CardHeader>

      {/* ── Body ── */}
      <CardContent className="space-y-4 pt-2">
        {/* Battery level */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BatteryLevelIcon level={node.batteryLevel} className={`h-4 w-4 ${batteryTextColor}`} />
              <span>Батарея</span>
            </div>
            <span className={`font-medium ${batteryTextColor}`}>
              {node.batteryLevel}%
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-500 ease-out rounded-full ${batteryColor}`}
              style={{ width: `${Math.max(node.batteryLevel, 0)}%` }}
            />
          </div>
        </div>

        {/* Signal quality */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {node.status === 'online' ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            <span>Сигнал</span>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`font-medium ${signal.color}`}>{signal.label}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>SNR: {node.snr.toFixed(1)} дБ</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* SNR / RSSI detail row */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Signal className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">SNR</span>
            <span className="ml-auto font-medium text-foreground">
              {node.snr.toFixed(1)} дБ
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Radio className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">RSSI</span>
            <span className="ml-auto font-medium text-foreground">
              {node.rssi} дБм
            </span>
          </div>
        </div>

        {/* Role badge + behavior indicators */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" />
            <span>Роль:</span>
            <Badge variant={getRoleBadgeVariant(node.role)} className="text-xs">
              {meta?.label ?? node.role}
            </Badge>
          </div>

          {/* Behavior indicators row */}
          <div className="flex items-center gap-3 text-xs">
            {/* Sleep indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
                  sleeps
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                }`}>
                  {sleeps ? (
                    <>
                      <Moon className="h-3 w-3" />
                      <span>Спит</span>
                    </>
                  ) : (
                    <>
                      <Sun className="h-3 w-3" />
                      <span>Бодрствует</span>
                    </>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {sleeps
                  ? 'Устройство периодически спит для экономии батареи'
                  : 'Устройство всегда бодрствует — не пропустит ни одного пакета'}
              </TooltipContent>
            </Tooltip>

            {/* Relay indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
                  relays
                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {relays ? (
                    <>
                      <Repeat className="h-3 w-3" />
                      <span>Ретранслирует</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3" />
                      <span>Только свои</span>
                    </>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {relays
                  ? 'Ретранслирует чужие пакеты — поддерживает mesh-сеть'
                  : 'Не ретранслирует чужие пакеты — экономит батарею'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Sleep interval (only for sleeping roles) */}
        {sleeps && node.lsSecs != null && (
          <div className="space-y-2 p-2.5 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/50">
            <div className="flex items-center gap-1.5 text-sm font-medium text-purple-700 dark:text-purple-300">
              <Moon className="h-3.5 w-3.5" />
              Режим сна
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Интервал сна:</span>
                <p className="font-medium text-foreground">{formatSleepInterval(node.lsSecs)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Время бодрствования:</span>
                <p className="font-medium text-foreground">{formatWakeTime(node.minWakeSecs)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Eye className="h-3 w-3" />
              Просыпается каждые {formatSleepInterval(node.lsSecs)}, передаёт данные за {formatWakeTime(node.minWakeSecs)}, затем засыпает
            </div>
          </div>
        )}

        {/* Always-awake notice for ROUTER/REPEATER */}
        {!sleeps && (node.role === 'ROUTER' || node.role === 'REPEATER') && (
          <div className="flex items-center gap-1.5 text-xs p-2 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/50 text-green-700 dark:text-green-300">
            <Sun className="h-3.5 w-3.5 shrink-0" />
            <span>
              {node.role === 'ROUTER'
                ? 'Всегда бодрствует и ретранслирует — ядро mesh-сети'
                : 'Всегда бодрствует — заполняет пробелы между спящими трекерами'}
            </span>
          </div>
        )}

        {/* Last seen */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Последний раз:</span>
          <span className="font-medium text-foreground">
            {getRelativeTime(node.lastSeen)}
          </span>
        </div>

        {/* Position */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="shrink-0">Позиция:</span>
          {hasPosition ? (
            <span className="font-medium text-foreground truncate">
              {node.latitude!.toFixed(5)}, {node.longitude!.toFixed(5)}
            </span>
          ) : (
            <span className="text-muted-foreground italic">Нет данных</span>
          )}
        </div>

        {/* Voltage */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Zap className="h-3.5 w-3.5" />
          <span>Напряжение:</span>
          <span className="font-medium text-foreground">{node.voltage.toFixed(2)} В</span>
        </div>
      </CardContent>

      {/* ── Footer ── */}
      <CardFooter className="border-t pt-4 pb-4">
        <Badge variant="secondary" className="text-xs gap-1">
          <Cpu className="h-3 w-3" />
          {node.hardwareModel}
        </Badge>
      </CardFooter>
    </Card>
  )
}
