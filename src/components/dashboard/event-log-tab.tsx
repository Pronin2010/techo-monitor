'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Battery,
  MapPin,
  Thermometer,
  Wifi,
  Radio,
  MonitorDot,
  Filter,
  Clock,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncLogEntry {
  id: string
  source: string
  nodeId: number | null
  nodeName: string | null
  action: string
  eventType: string | null
  details: string | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Event type config
// ---------------------------------------------------------------------------

const EVENT_CONFIG: Record<string, { icon: typeof Battery; label: string; color: string }> = {
  battery:     { icon: Battery,      label: 'Батарея',   color: 'text-amber-500' },
  position:    { icon: MapPin,       label: 'GPS',       color: 'text-green-500' },
  environment: { icon: Thermometer,  label: 'Датчики',   color: 'text-purple-500' },
  signal:      { icon: Wifi,         label: 'Сигнал',    color: 'text-blue-500' },
  heartbeat:   { icon: MonitorDot,   label: 'Пинг',      color: 'text-slate-400' },
  device_info: { icon: Radio,        label: 'Устройство', color: 'text-teal-500' },
}

const SOURCE_COLORS: Record<string, string> = {
  serial: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  mqtt:   'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  test:   'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  updated: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  synced:  'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Сегодня'
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function formatDetails(details: string | null): Record<string, unknown> | null {
  if (!details) return null
  try {
    return JSON.parse(details)
  } catch {
    return null
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') {
    if (Math.abs(value) > 100) return value.toFixed(0)
    return value.toFixed(2)
  }
  return String(value)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EventLogTabProps {
  nodes: { id: string; name: string; nodeId: number }[]
}

export default function EventLogTab({ nodes }: EventLogTabProps) {
  const [logs, setLogs] = useState<SyncLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterNode, setFilterNode] = useState<string>('all')
  const [filterEvent, setFilterEvent] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterAction, setFilterAction] = useState<string>('all')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '300' })
      if (filterNode !== 'all') {
        const node = nodes.find(n => n.id === filterNode)
        if (node) params.set('nodeId', String(node.nodeId))
      }
      if (filterEvent !== 'all') params.set('eventType', filterEvent)
      if (filterSource !== 'all') params.set('source', filterSource)
      if (filterAction !== 'all') params.set('action', filterAction)

      const res = await fetch(`/api/sync-log?${params}`)
      if (!res.ok) throw new Error('Failed to fetch logs')
      const data = await res.json()
      setLogs(data)
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить журнал',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filterNode, filterEvent, filterSource, filterAction, nodes])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const handleClearOld = async () => {
    try {
      await fetch('/api/sync-log', { method: 'DELETE' })
      await loadLogs()
      toast({
        title: 'Очищено',
        description: 'Удалены записи старше 24 часов',
      })
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось очистить журнал',
        variant: 'destructive',
      })
    }
  }

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const groups: Record<string, SyncLogEntry[]> = {}
    for (const log of logs) {
      const dateKey = formatDate(log.createdAt)
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(log)
    }
    return groups
  }, [logs])

  // Stats
  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const log of logs) {
      if (log.eventType) {
        for (const et of log.eventType.split(',')) {
          const t = et.trim()
          if (t) counts[t] = (counts[t] || 0) + 1
        }
      }
    }
    return counts
  }, [logs])

  const hasFilters = filterNode !== 'all' || filterEvent !== 'all' || filterSource !== 'all' || filterAction !== 'all'

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1">
          <FileText className="h-3 w-3" />
          {logs.length} записей
        </Badge>
        {Object.entries(eventCounts).map(([type, count]) => {
          const config = EVENT_CONFIG[type]
          if (!config) return null
          const Icon = config.icon
          return (
            <Badge key={type} variant="outline" className="gap-1">
              <Icon className={`h-3 w-3 ${config.color}`} />
              {config.label}: {count}
            </Badge>
          )
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Фильтры</span>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs ml-auto"
                onClick={() => {
                  setFilterNode('all')
                  setFilterEvent('all')
                  setFilterSource('all')
                  setFilterAction('all')
                }}
              >
                Сбросить
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Node filter */}
            <Select value={filterNode} onValueChange={setFilterNode}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Все узлы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все узлы</SelectItem>
                {nodes.map(n => (
                  <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Event type filter */}
            <Select value={filterEvent} onValueChange={setFilterEvent}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Все типы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы событий</SelectItem>
                {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Source filter */}
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Все источники" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все источники</SelectItem>
                <SelectItem value="serial">Serial (USB)</SelectItem>
                <SelectItem value="mqtt">MQTT</SelectItem>
                <SelectItem value="test">Тест</SelectItem>
              </SelectContent>
            </Select>

            {/* Action filter */}
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Все действия" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все действия</SelectItem>
                <SelectItem value="created">Создан</SelectItem>
                <SelectItem value="updated">Обновлён</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={loadLogs} className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
        <Button variant="outline" size="sm" onClick={handleClearOld} className="gap-1.5 text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
          {'Удалить старые (>24ч)'}
        </Button>
      </div>

      {/* Log list */}
      {loading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-16 rounded" />
                <Skeleton className="h-8 flex-1 rounded" />
                <Skeleton className="h-8 w-24 rounded" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">Нет записей</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {hasFilters
                ? 'Нет записей для выбранных фильтров. Попробуйте сбросить фильтры.'
                : 'Данные от трекеров ещё не поступали. Подключитесь к сети через вкладку «Подключение».'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-1">
            {Object.entries(groupedLogs).map(([dateLabel, dateLogs]) => (
              <div key={dateLabel}>
                {/* Date header */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 px-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {dateLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({dateLogs.length})
                    </span>
                  </div>
                </div>

                {/* Log entries */}
                {dateLogs.map(log => {
                  const isExpanded = expandedId === log.id
                  const details = formatDetails(log.details)
                  const eventTypes = log.eventType ? log.eventType.split(',').map(s => s.trim()) : []

                  return (
                    <div
                      key={log.id}
                      className="border-b last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-center gap-2 px-3 py-2">
                        {/* Expand arrow */}
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        }

                        {/* Time */}
                        <span className="text-xs font-mono text-muted-foreground w-16 flex-shrink-0">
                          {formatTime(log.createdAt)}
                        </span>

                        {/* Event type icons */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {eventTypes.map(et => {
                            const cfg = EVENT_CONFIG[et]
                            if (!cfg) return null
                            const Icon = cfg.icon
                            return <Icon key={et} className={`h-3.5 w-3.5 ${cfg.color}`} />
                          })}
                        </div>

                        {/* Node name */}
                        <span className="text-sm font-medium truncate min-w-0">
                          {log.nodeName || `#${log.nodeId}`}
                        </span>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] h-5 px-1.5 ${ACTION_COLORS[log.action] || ''}`}
                          >
                            {log.action === 'created' ? 'Новый' : log.action === 'updated' ? 'Обновлён' : log.action}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] h-5 px-1.5 ${SOURCE_COLORS[log.source] || ''}`}
                          >
                            {log.source}
                          </Badge>

                          {/* Quick detail preview */}
                          {details && (
                            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground max-w-[200px] truncate">
                              {details.battery != null && (
                                <span className="flex items-center gap-0.5">
                                  <Battery className="h-3 w-3" />
                                  {details.battery}%
                                </span>
                              )}
                              {details.snr != null && (
                                <span className="flex items-center gap-0.5">
                                  <Wifi className="h-3 w-3" />
                                  {details.snr}
                                </span>
                              )}
                              {details.positionMoved && (
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="h-3 w-3 text-green-500" />
                                  ✓
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && details && (
                        <div className="px-3 pb-3 pl-10">
                          <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono space-y-1.5">
                            {Object.entries(details).map(([key, value]) => (
                              <div key={key} className="flex justify-between gap-4">
                                <span className="text-muted-foreground">{key}</span>
                                <span className="text-right">
                                  {key === 'positionMoved' ? (
                                    value ? '✅ Движение' : '⏸ Стоит'
                                  ) : key === 'batteryDiff' ? (
                                    <span className={Number(value) < 0 ? 'text-red-500' : 'text-green-500'}>
                                      {(Number(value) > 0 ? '+' : '')}{value}%
                                    </span>
                                  ) : (
                                    formatValue(value)
                                  )}
                                </span>
                              </div>
                            ))}
                            <div className="border-t pt-1.5 mt-1.5 flex justify-between gap-4">
                              <span className="text-muted-foreground">id</span>
                              <span className="text-right">{log.id}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
