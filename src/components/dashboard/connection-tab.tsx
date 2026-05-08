'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import type { Channel } from '@/lib/types'
import {
  Usb,
  Wifi,
  Download,
  CheckCircle2,
  XCircle,
  Copy,
  RefreshCw,
  Cable,
  ArrowDownUp,
  Inbox,
  Clock,
  Radio,
  MapPin,
  ChevronDown,
  ChevronRight,
  Battery,
  Zap,
  Signal,
  Thermometer,
  Droplets,
  Shield,
  Globe,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectionConfig {
  id: string
  type: string
  serialPort: string
  mqttBroker: string
  mqttTopic: string
  mqttUsername: string
  mqttPassword: string
  channelId: string | null
  isEnabled: boolean
  lastSync: string | null
  status: string
}

interface SyncNodeDetail {
  action: string
  nodeId: number
  name?: string
  shortName?: string
  role?: string
  batteryLevel?: number
  voltage?: number
  snr?: number
  rssi?: number
  temperature?: number | null
  humidity?: number | null
  hasPosition?: boolean
  latitude?: number | null
  longitude?: number | null
}

interface SyncLogEntry {
  id: string
  source: string
  nodeId?: number
  nodeName?: string
  action: string
  nodeCount: number
  details?: string
  createdAt: string
}

interface ConnectionTabProps {
  channels: Channel[]
  onSyncComplete?: () => void
  preselectedChannelId?: string | null
  onPreselectedHandled?: () => void
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Скопировано' })
  }
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
      <Copy className="h-3.5 w-3.5" />
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ConnectionTab({ channels, onSyncComplete, preselectedChannelId, onPreselectedHandled }: ConnectionTabProps) {
  const [config, setConfig] = useState<ConnectionConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logs, setLogs] = useState<SyncLogEntry[]>([])
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  // Load config + logs
  const loadData = useCallback(async () => {
    try {
      const [configRes, logsRes] = await Promise.all([
        fetch('/api/meshtastic/sync'),
        fetch('/api/sync-log?limit=30'),
      ])
      if (configRes.ok) setConfig(await configRes.json())
      if (logsRes.ok) setLogs(await logsRes.json())
    } catch (err) {
      console.error('Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Config updater ──
  const updateConfig = (updates: Partial<ConnectionConfig>) => {
    setConfig(prev => prev ? { ...prev, ...updates } : prev)
  }

  // ── Channel selection ──
  const selectedChannel = config?.channelId
    ? channels.find(c => c.id === config.channelId)
    : null

  const handleChannelSelect = (channelId: string) => {
    if (!channelId || channelId === 'none') {
      updateConfig({ channelId: null, mqttTopic: 'msh/EU_433/#' })
      return
    }
    const channel = channels.find(c => c.id === channelId)
    if (!channel) return

    const regionCode = channel.region
    const topic = `msh/${regionCode}/#`
    updateConfig({
      channelId: channel.id,
      mqttTopic: topic,
    })
    toast({
      title: `Канал: ${channel.name}`,
      description: `PSK, регион и MQTT-топик обновлены`,
    })
  }

  // ── Auto-select channel when coming from Channels tab ──
  const handledRef = useRef<string | null>(null)
  useEffect(() => {
    if (preselectedChannelId && channels.length > 0 && handledRef.current !== preselectedChannelId) {
      handledRef.current = preselectedChannelId
      handleChannelSelect(preselectedChannelId)
      onPreselectedHandled?.()
    }
  }, [preselectedChannelId, channels.length])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      await fetch('/api/meshtastic/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      toast({ title: 'Сохранено' })
    } catch {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadScript = () => {
    window.open('/api/meshtastic/script', '_blank')
    toast({ title: 'Загрузка techo-bridge.py...' })
  }

  const generateRunCommand = () => {
    if (!config) return ''
    if (config.type === 'mqtt') {
      let cmd = `python techo-bridge.py --mode mqtt --broker ${config.mqttBroker || 'mqtt.meshtastic.org:1883'} --topic ${config.mqttTopic || 'msh/EU_433/#'}`
      if (config.mqttUsername) cmd += ` --mqtt-user ${config.mqttUsername}`
      if (config.mqttPassword) cmd += ` --mqtt-pass ${config.mqttPassword}`
      return cmd
    }
    return `python techo-bridge.py --mode serial --port ${config.serialPort || '/dev/ttyUSB0'} --dashboard http://localhost:3000`
  }

  const isConnected = config?.status === 'connected'
  const StatusIcon = isConnected ? CheckCircle2 : XCircle

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' + formatTime(iso)
  }

  const parseDetails = (details?: string): SyncNodeDetail[] | null => {
    if (!details) return null
    try {
      const parsed = JSON.parse(details)
      if (Array.isArray(parsed)) return parsed
      return null
    } catch {
      return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* ── Status Banner ── */}
      <Card className={isConnected ? 'border-green-300 dark:border-green-800' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon className={`h-5 w-5 ${isConnected ? 'text-green-500' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-medium text-sm">
                  {isConnected ? 'Подключено' : 'Отключено'}
                </p>
                {config?.lastSync && (
                  <p className="text-xs text-muted-foreground">
                    Последняя синхронизация: {formatDate(config.lastSync)}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Обновить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Channel Selection ── */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Radio className="h-3 w-3" />
              Канал
            </Label>
            <Select
              value={config?.channelId || 'none'}
              onValueChange={handleChannelSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите канал..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>Без канала (ручные настройки)</span>
                  </div>
                </SelectItem>
                {channels.map(channel => (
                  <SelectItem key={channel.id} value={channel.id}>
                    <div className="flex items-center gap-2">
                      <Radio className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{channel.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {channel.region} · {channel.modemPreset}
                      </span>
                      {channel.frequency && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600">
                          {channel.frequency} МГц
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              При выборе канала автоматически подтягиваются PSK, регион и MQTT-топик
            </p>
          </div>

          {/* Selected channel info */}
          {selectedChannel && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-primary" />
                {selectedChannel.name}
                <Badge variant="outline" className="text-[10px]">#{selectedChannel.index}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  <span>PSK:</span>
                  <code className="font-mono text-[11px] truncate max-w-[140px]">
                    {selectedChannel.psk.substring(0, 16)}...
                  </code>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe className="h-3 w-3" />
                  <span>Регион:</span>
                  <span className="font-medium">{selectedChannel.region}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3" />
                  <span>Модем:</span>
                  <span className="font-medium">{selectedChannel.modemPreset}</span>
                </div>
                {selectedChannel.frequency && (
                  <div className="flex items-center gap-1.5">
                    <Radio className="h-3 w-3" />
                    <span>Частота:</span>
                    <span className="font-mono font-medium">{selectedChannel.frequency} МГц</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <ArrowDownUp className="h-3 w-3" />
                  <span>Uplink:</span>
                  <span className={selectedChannel.uplink ? 'text-green-600' : 'text-muted-foreground'}>
                    {selectedChannel.uplink ? 'Вкл' : 'Выкл'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowDownUp className="h-3 w-3" />
                  <span>Downlink:</span>
                  <span className={selectedChannel.downlink ? 'text-green-600' : 'text-muted-foreground'}>
                    {selectedChannel.downlink ? 'Вкл' : 'Выкл'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Connection Settings ── */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Connection type */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => updateConfig({ type: 'serial' })}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all flex-1 ${
                config?.type !== 'mqtt'
                  ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <Usb className={`h-4 w-4 ${config?.type !== 'mqtt' ? 'text-teal-500' : 'text-muted-foreground'}`} />
              USB / Serial
            </button>
            <button
              onClick={() => updateConfig({ type: 'mqtt' })}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all flex-1 ${
                config?.type === 'mqtt'
                  ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <Wifi className={`h-4 w-4 ${config?.type === 'mqtt' ? 'text-teal-500' : 'text-muted-foreground'}`} />
              MQTT
            </button>
          </div>

          {/* Serial port */}
          {config?.type !== 'mqtt' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Порт устройства</Label>
              <Input
                value={config?.serialPort || '/dev/ttyUSB0'}
                onChange={(e) => updateConfig({ serialPort: e.target.value })}
                className="font-mono text-sm"
                placeholder="/dev/ttyUSB0"
              />
              <p className="text-[10px] text-muted-foreground">
                Linux: /dev/ttyUSB0 · Windows: COM3 · macOS: /dev/cu.usbmodem*
              </p>
            </div>
          )}

          {/* MQTT settings */}
          {config?.type === 'mqtt' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Брокер</Label>
                <Input
                  value={config?.mqttBroker || 'mqtt.meshtastic.org:1883'}
                  onChange={(e) => updateConfig({ mqttBroker: e.target.value })}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Топик
                  {selectedChannel && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-2 border-green-300 text-green-600">
                      из канала
                    </Badge>
                  )}
                </Label>
                <Input
                  value={config?.mqttTopic || 'msh/EU_433/#'}
                  onChange={(e) => updateConfig({ mqttTopic: e.target.value })}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}

          {/* Run command */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Cable className="h-3 w-3" />
              Команда запуска
            </Label>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-zinc-900 text-zinc-100 px-3 py-2 rounded flex-1 overflow-x-auto">
                {generateRunCommand()}
              </code>
              <CopyButton text={generateRunCommand()} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadScript} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Скачать скрипт
            </Button>
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`} />
              Сохранить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Sync Log ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">Лог синхронизаций</h3>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {logs.length} записей
            </Badge>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Radio className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Нет данных. Запустите bridge-скрипт для начала синхронизации.</p>
            </div>
          ) : (
            <div className="space-y-0.5 max-h-96 overflow-y-auto">
              {logs.map((log) => {
                const isExpanded = expandedLog === log.id
                const details = parseDetails(log.details)
                const hasExpandableDetails = details && details.length > 0

                return (
                  <div key={log.id} className="rounded-lg border border-transparent hover:border-border transition-colors">
                    <div
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer text-xs hover:bg-muted/50 rounded-lg"
                      onClick={() => hasExpandableDetails && setExpandedLog(isExpanded ? null : log.id)}
                    >
                      {/* Expand icon */}
                      {hasExpandableDetails ? (
                        <span className="text-muted-foreground shrink-0">
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </span>
                      ) : (
                        <span className="w-3" />
                      )}

                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground shrink-0 font-mono">
                        {formatTime(log.createdAt)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${
                          log.source === 'serial'
                            ? 'border-teal-300 text-teal-600'
                            : log.source === 'mqtt'
                            ? 'border-blue-300 text-blue-600'
                            : 'border-gray-300 text-gray-500'
                        }`}
                      >
                        {log.source}
                      </Badge>
                      <span className="flex-1 truncate">
                        {log.nodeCount} узлов
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && details && (
                      <div className="px-4 py-2 border-t bg-muted/20 rounded-b-lg">
                        <div className="space-y-1">
                          {details.map((node, idx) => (
                            <div key={idx} className="space-y-1 py-2">
                              {/* Row 1: name, role, action */}
                              <div className="flex items-center gap-3 text-xs">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                                  {node.shortName || `#${node.nodeId}`}
                                </Badge>
                                <span className="font-medium truncate max-w-[120px]">
                                  {node.name || `Node ${node.nodeId}`}
                                </span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {node.role || '—'}
                                </Badge>
                                <div className="flex-1" />
                                {node.action === 'created' && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-600">
                                    новый
                                  </Badge>
                                )}
                              </div>
                              {/* Row 2: telemetry data */}
                              <div className="flex items-center gap-4 text-[11px] text-muted-foreground pl-1 flex-wrap">
                                <div className="flex items-center gap-1">
                                  <Battery className={`h-3 w-3 ${node.batteryLevel && node.batteryLevel > 30 ? 'text-green-500' : 'text-red-500'}`} />
                                  <span>{node.batteryLevel ?? '—'}%</span>
                                  {node.voltage != null && (
                                    <span className="text-muted-foreground/60">({node.voltage.toFixed(2)} В)</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Signal className="h-3 w-3" />
                                  <span>SNR {node.snr != null ? node.snr.toFixed(1) : '—'} дБ</span>
                                  <span className="text-muted-foreground/40">/</span>
                                  <span>RSSI {node.rssi ?? '—'} дБм</span>
                                </div>
                                {node.temperature != null && (
                                  <div className="flex items-center gap-1">
                                    <Thermometer className="h-3 w-3" />
                                    <span>{node.temperature.toFixed(1)} °C</span>
                                  </div>
                                )}
                                {node.humidity != null && (
                                  <div className="flex items-center gap-1">
                                    <Droplets className="h-3 w-3" />
                                    <span>{node.humidity.toFixed(1)}%</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  {node.hasPosition ? (
                                    <>
                                      <MapPin className="h-3 w-3 text-green-500" />
                                      <span className="text-green-600 dark:text-green-400 font-mono">
                                        {node.latitude?.toFixed(4)}, {node.longitude?.toFixed(4)}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <MapPin className="h-3 w-3 text-muted-foreground" />
                                      <span>нет GPS</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
