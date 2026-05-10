'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Zap,
  MapPin,
  Battery,
  Thermometer,
  Wifi,
  Radio,
  MessageSquare,
  MonitorDot,
  Pause,
  Play,
  Trash2,
  ArrowDown,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PacketEntry {
  receivedAt: string
  fromId: number
  fromName: string
  toId?: number | null
  portnum: number
  packetType: string
  channel?: number
  rssi?: number | null
  snr?: number | null
  hopLimit?: number
  details?: Record<string, unknown> | null
}

interface PacketStreamTabProps {
  nodes: { id: string; name: string; nodeId: number }[]
}

// ---------------------------------------------------------------------------
// Packet type config
// ---------------------------------------------------------------------------

const PKT_TYPE_CONFIG: Record<string, { icon: typeof Zap; label: string; color: string; bgColor: string }> = {
  POSITION:            { icon: MapPin,        label: 'GPS',          color: 'text-green-500',    bgColor: 'bg-green-500/10' },
  TELEMETRY:           { icon: Battery,       label: 'Телеметрия',   color: 'text-amber-500',    bgColor: 'bg-amber-500/10' },
  TELEMETRY_DEVICE:    { icon: Battery,       label: 'Телем.уст.',   color: 'text-amber-400',    bgColor: 'bg-amber-400/10' },
  TELEMETRY_ENVIRONMENT: { icon: Thermometer, label: 'Датчики',      color: 'text-purple-500',   bgColor: 'bg-purple-500/10' },
  NODEINFO:            { icon: Radio,         label: 'NodeInfo',     color: 'text-teal-500',     bgColor: 'bg-teal-500/10' },
  TEXT_MESSAGE:        { icon: MessageSquare, label: 'Сообщение',    color: 'text-blue-500',     bgColor: 'bg-blue-500/10' },
  ROUTING:             { icon: Wifi,          label: 'Маршрут',      color: 'text-slate-400',    bgColor: 'bg-slate-400/10' },
  ADMIN:               { icon: MonitorDot,    label: 'Админ',        color: 'text-red-400',      bgColor: 'bg-red-400/10' },
  TRACEROUTE:          { icon: Wifi,          label: 'Traceroute',   color: 'text-indigo-400',   bgColor: 'bg-indigo-400/10' },
  NEIGHBORINFO:        { icon: Wifi,          label: 'Соседи',       color: 'text-cyan-400',     bgColor: 'bg-cyan-400/10' },
  UNKNOWN:             { icon: Zap,           label: 'Другой',       color: 'text-gray-400',     bgColor: 'bg-gray-400/10' },
}

function getPktConfig(type: string) {
  return PKT_TYPE_CONFIG[type] || PKT_TYPE_CONFIG.UNKNOWN
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function rssiColor(rssi: number | null | undefined): string {
  if (rssi == null) return 'text-gray-400'
  if (rssi >= -70) return 'text-green-500'
  if (rssi >= -100) return 'text-amber-500'
  return 'text-red-500'
}

function snrColor(snr: number | null | undefined): string {
  if (snr == null) return 'text-gray-400'
  if (snr >= 5) return 'text-green-500'
  if (snr >= 0) return 'text-amber-500'
  return 'text-red-500'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PacketStreamTab({ nodes }: PacketStreamTabProps) {
  const [packets, setPackets] = useState<PacketEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [filterNode, setFilterNode] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastFetchRef = useRef<string>('')

  const loadPackets = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (lastFetchRef.current) {
        params.set('since', lastFetchRef.current)
      }
      if (filterNode !== 'all') {
        const node = nodes.find(n => n.id === filterNode)
        if (node) params.set('fromId', String(node.nodeId))
      }
      if (filterType !== 'all') {
        params.set('type', filterType)
      }

      const res = await fetch(`/api/packets?${params}`)
      if (!res.ok) throw new Error('Failed')
      const data: PacketEntry[] = await res.json()

      if (data.length > 0) {
        // Update last fetch time
        lastFetchRef.current = data[0].receivedAt

        setPackets(prev => {
          // Merge new packets (avoid duplicates by receivedAt + fromId)
          const existing = new Set(prev.map(p => `${p.receivedAt}-${p.fromId}-${p.packetType}`))
          const newPkts = data.filter(p => !existing.has(`${p.receivedAt}-${p.fromId}-${p.packetType}`))
          const merged = [...newPkts, ...prev].slice(0, 500)
          return merged
        })
      }
    } catch {
      // Silent fail for background polling
    } finally {
      setLoading(false)
    }
  }, [filterNode, filterType, nodes])

  // Poll every 2 seconds
  useEffect(() => {
    loadPackets()
    const interval = setInterval(() => {
      if (!paused) loadPackets()
    }, 2000)
    return () => clearInterval(interval)
  }, [loadPackets, paused])

  // Auto-scroll to top when new packets arrive
  useEffect(() => {
    if (autoScroll && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [packets, autoScroll, paused])

  const handleClear = () => {
    setPackets([])
    lastFetchRef.current = ''
  }

  // Stats
  const stats = useMemo(() => {
    const typeCounts: Record<string, number> = {}
    let totalRssi = 0
    let rssiCount = 0
    for (const p of packets) {
      const t = p.packetType || 'UNKNOWN'
      typeCounts[t] = (typeCounts[t] || 0) + 1
      if (p.rssi != null) {
        totalRssi += p.rssi
        rssiCount++
      }
    }
    return {
      total: packets.length,
      typeCounts,
      avgRssi: rssiCount > 0 ? Math.round(totalRssi / rssiCount) : null,
    }
  }, [packets])

  const hasFilters = filterNode !== 'all' || filterType !== 'all'

  // Collect seen packet types for filter
  const seenTypes = useMemo(() => {
    const types = new Set<string>()
    for (const p of packets) types.add(p.packetType)
    return [...types].sort()
  }, [packets])

  return (
    <div className="space-y-4">
      {/* Header: stats + controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <Zap className="h-3 w-3 text-yellow-500" />
          {stats.total} пакетов
        </Badge>
        {Object.entries(stats.typeCounts).map(([type, count]) => {
          const cfg = getPktConfig(type)
          const Icon = cfg.icon
          return (
            <Badge key={type} variant="outline" className="gap-1">
              <Icon className={`h-3 w-3 ${cfg.color}`} />
              {cfg.label}: {count}
            </Badge>
          )
        })}
        {stats.avgRssi != null && (
          <Badge variant="outline" className="gap-1">
            <Wifi className="h-3 w-3" />
            RSSI ср: {stats.avgRssi} dBm
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused(!paused)}
            className="gap-1.5"
          >
            {paused ? (
              <><Play className="h-3.5 w-3.5" /> Продолжить</>
            ) : (
              <><Pause className="h-3.5 w-3.5" /> Пауза</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Очистить
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={filterNode} onValueChange={setFilterNode}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Все узлы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все узлы</SelectItem>
                {nodes.map(n => (
                  <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Все типы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы пакетов</SelectItem>
                {seenTypes.map(t => {
                  const cfg = getPktConfig(t)
                  return (
                    <SelectItem key={t} value={t}>{cfg.label} ({t})</SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() => {
                  setFilterNode('all')
                  setFilterType('all')
                }}
              >
                Сбросить фильтры
              </Button>
            )}

            <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              Автопрокрутка
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Packet stream */}
      {loading && packets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Zap className="h-16 w-16 text-muted-foreground/30 mb-4 animate-pulse" />
            <h3 className="text-lg font-medium mb-2">Ожидание пакетов...</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Запустите techo-bridge.py для начала мониторинга пакетов в реальном времени.
            </p>
            <code className="mt-4 text-xs bg-muted p-2 rounded font-mono">
              python techo-bridge.py --mode serial --port COM5 --dashboard http://localhost:3000
            </code>
          </CardContent>
        </Card>
      ) : packets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Zap className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">Нет пакетов</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {paused
                ? 'Мониторинг приостановлен. Нажмите «Продолжить».'
                : hasFilters
                  ? 'Нет пакетов для выбранных фильтров.'
                  : 'Пакеты ещё не поступали.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <ScrollArea className="h-[600px]" ref={scrollRef}>
            <div className="space-y-0.5">
              {packets.map((pkt, idx) => {
                const cfg = getPktConfig(pkt.packetType)
                const Icon = cfg.icon
                const isEven = idx % 2 === 0

                return (
                  <div
                    key={`${pkt.receivedAt}-${pkt.fromId}-${pkt.packetType}-${idx}`}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-mono border-b border-border/30 hover:bg-muted/50 transition-colors ${isEven ? '' : 'bg-muted/20'}`}
                  >
                    {/* Time */}
                    <span className="text-[11px] text-muted-foreground w-16 flex-shrink-0">
                      {formatTime(pkt.receivedAt)}
                    </span>

                    {/* Type badge */}
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.bgColor} ${cfg.color} w-[100px] flex-shrink-0`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </div>

                    {/* From */}
                    <span className="font-bold text-foreground w-14 flex-shrink-0 truncate">
                      {pkt.fromName}
                    </span>

                    {/* Signal */}
                    <span className={`text-[11px] w-20 flex-shrink-0 ${rssiColor(pkt.rssi)}`}>
                      {pkt.rssi != null ? `${pkt.rssi} dBm` : '—'}
                    </span>
                    <span className={`text-[11px] w-14 flex-shrink-0 ${snrColor(pkt.snr)}`}>
                      {pkt.snr != null ? `${pkt.snr.toFixed(1)} SNR` : '—'}
                    </span>

                    {/* Channel */}
                    <span className="text-[11px] text-muted-foreground w-8 flex-shrink-0">
                      ch{pkt.channel ?? 0}
                    </span>

                    {/* Details preview */}
                    <span className="text-[11px] text-muted-foreground truncate min-w-0">
                      {pkt.details ? formatPacketDetails(pkt.details) : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </ScrollArea>

          {/* New packets indicator */}
          {paused && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <Button size="sm" variant="secondary" className="gap-1.5 shadow-lg" onClick={() => setPaused(false)}>
                <ArrowDown className="h-3.5 w-3.5" />
                Мониторинг на паузе — нажмите для продолжения
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail formatter
// ---------------------------------------------------------------------------

function formatPacketDetails(details: Record<string, unknown>): string {
  const parts: string[] = []

  if (details.lat != null && details.lon != null) {
    parts.push(`${Number(details.lat).toFixed(5)},${Number(details.lon).toFixed(5)}`)
    if (details.alt != null) parts.push(`alt=${details.alt}m`)
    if (details.sats != null) parts.push(`sat=${details.sats}`)
    if (details.hdop != null) parts.push(`hdop=${details.hdop}`)
    if (details.speed != null) parts.push(`v=${Number(details.speed).toFixed(1)}m/s`)
    if (details.heading != null) parts.push(`dir=${details.heading}°`)
  }
  if (details.battery != null) {
    parts.push(`${details.battery}%`)
    if (details.voltage != null) parts.push(`${Number(details.voltage).toFixed(2)}V`)
  }
  if (details.temperature != null) {
    parts.push(`${Number(details.temperature).toFixed(1)}C`)
  }
  if (details.humidity != null) {
    parts.push(`${Number(details.humidity).toFixed(0)}%`)
  }
  if (details.pressure != null) {
    parts.push(`${Number(details.pressure).toFixed(1)}hPa`)
  }
  if (details.channelUtilization != null) {
    parts.push(`chUtil=${Number(details.channelUtilization).toFixed(1)}%`)
  }
  if (details.airUtilTx != null) {
    parts.push(`airTx=${Number(details.airUtilTx).toFixed(2)}%`)
  }
  if (details.text != null) {
    parts.push(`"${details.text}"`)
  }
  if (details.shortName != null) {
    parts.push(`-> ${details.shortName}`)
  }

  return parts.join(' ')
}
