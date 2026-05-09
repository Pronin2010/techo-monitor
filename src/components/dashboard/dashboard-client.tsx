'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { MeshNode, Channel } from '@/lib/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TooltipProvider } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import NodeStatusCard from '@/components/dashboard/node-status-card'
import NodeFormDialog from '@/components/dashboard/node-form-dialog'
import MapView from '@/components/dashboard/map-view'
import ChannelSettings from '@/components/dashboard/channel-settings'
import ConnectionTab from '@/components/dashboard/connection-tab'
import DeviceSetupTab from '@/components/dashboard/device-setup-tab'
import EventLogTab from '@/components/dashboard/event-log-tab'
import PacketStreamTab from '@/components/dashboard/packet-stream-tab'
import {
  Radio,
  Map,
  Settings,
  RefreshCw,
  Download,
  Activity,
  Search,
  Cpu,
  FileText,
  Zap,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

async function fetchNodes(): Promise<MeshNode[]> {
  const res = await fetch('/api/nodes')
  if (!res.ok) throw new Error('Failed to fetch nodes')
  return res.json()
}

async function fetchChannels(): Promise<Channel[]> {
  const res = await fetch('/api/channels')
  if (!res.ok) throw new Error('Failed to fetch channels')
  return res.json()
}

async function seedDatabase(): Promise<void> {
  const res = await fetch('/api/seed', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to seed')
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DashboardClientProps {
  initialNodes: MeshNode[]
  initialChannels: Channel[]
}

// ---------------------------------------------------------------------------
// Main Dashboard Client Component
// ---------------------------------------------------------------------------

export default function DashboardClient({ initialNodes, initialChannels }: DashboardClientProps) {
  const [nodes, setNodes] = useState<MeshNode[]>(initialNodes)
  const [channels, setChannels] = useState<Channel[]>(initialChannels)
  const [activeTab, setActiveTab] = useState('status')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [editNodeOpen, setEditNodeOpen] = useState(false)
  const [editingNode, setEditingNode] = useState<MeshNode | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [preselectedChannelId, setPreselectedChannelId] = useState<string | null>(null)

  // ── Handle channel selection from Channels tab ──
  const handleSelectChannelForConnection = useCallback((channel: Channel) => {
    setPreselectedChannelId(channel.id)
    setActiveTab('connection')
  }, [])

  const handlePreselectedHandled = useCallback(() => {
    // Small delay to let the effect fire first
    setTimeout(() => setPreselectedChannelId(null), 100)
  }, [])

  // Track consecutive errors for backoff
  const errorCountRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Filter nodes by search query
  const filteredNodes = searchQuery.trim()
    ? nodes.filter(n => {
        const q = searchQuery.toLowerCase()
        return (
          n.name.toLowerCase().includes(q) ||
          n.shortName.toLowerCase().includes(q)
        )
      })
    : nodes

  const loadData = useCallback(async () => {
    try {
      const [nodesData, channelsData] = await Promise.allSettled([
        fetchNodes(),
        fetchChannels(),
      ])

      if (nodesData.status === 'fulfilled') {
        setNodes(nodesData.value)
        errorCountRef.current = 0
      } else {
        errorCountRef.current += 1
      }

      if (channelsData.status === 'fulfilled') {
        setChannels(channelsData.value)
      }
    } catch (err) {
      console.error('Failed to load data:', err)
      errorCountRef.current += 1
    }
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await loadData()
      toast({
        title: 'Обновлено',
        description: 'Данные обновлены',
      })
    } catch {
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить данные. Попробуйте ещё раз.',
        variant: 'destructive',
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSeed = async () => {
    try {
      await seedDatabase()
      await loadData()
      toast({
        title: 'Демо-данные',
        description: 'Демо-данные успешно загружены',
      })
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить демо-данные',
        variant: 'destructive',
      })
    }
  }

  // ── Node CRUD handlers ──

  const handleUpdateNode = async (data: Record<string, unknown>) => {
    if (!editingNode) return
    const res = await fetch(`/api/nodes/${editingNode.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update node')
    await loadData()
    toast({
      title: 'Узел обновлён',
      description: `Параметры «${data.name}» сохранены`,
    })
  }

  const handleDeleteNode = async (id: string) => {
    const res = await fetch(`/api/nodes/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error('Failed to delete node')
    await loadData()
    toast({
      title: 'Узел удалён',
      description: 'Устройство удалено из сети',
    })
  }

  const handleEditNode = (node: MeshNode) => {
    setEditingNode(node)
    setEditNodeOpen(true)
  }

  // ── Channel CRUD handlers ──

  const handleUpdateChannel = async (id: string, data: Partial<Channel>) => {
    const res = await fetch('/api/channels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    })
    if (!res.ok) throw new Error('Failed to update channel')
    await loadData()
  }

  const handleCreateChannel = async (data: Partial<Channel>) => {
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create channel')
    await loadData()
  }

  const handleDeleteChannel = async (id: string) => {
    const res = await fetch(`/api/channels?id=${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error('Failed to delete channel')
    await loadData()
  }

  // ── Auto-refresh with exponential backoff ──

  useEffect(() => {
    const startPolling = () => {
      const baseInterval = 30000
      const backoff = Math.min(baseInterval * Math.pow(2, errorCountRef.current), 120000)
      const interval = errorCountRef.current === 0 ? baseInterval : backoff

      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        loadData()
      }, interval)
    }

    startPolling()

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [loadData])

  // Sync with server-fetched data when initial props change
  useEffect(() => {
    setNodes(initialNodes)
    setChannels(initialChannels)
  }, [initialNodes, initialChannels])

  const hasData = nodes.length > 0

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-background">
        {/* ── Header ── */}
        <header className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500/10">
                  <Radio className="h-6 w-6 text-teal-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">
                    T-Echo Monitor
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Панель управления Meshtastic сетью
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Обновить
                </Button>
                {!hasData && (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={handleSeed}
                  >
                    <Download className="h-4 w-4" />
                    Загрузить демо
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── Main Content ── */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="status" className="gap-1.5">
                <Activity className="h-4 w-4" />
                Статус
                {nodes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">
                    {nodes.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="map" className="gap-1.5">
                <Map className="h-4 w-4" />
                Карта
              </TabsTrigger>
              <TabsTrigger value="channels" className="gap-1.5">
                <Settings className="h-4 w-4" />
                Каналы
              </TabsTrigger>
              <TabsTrigger value="connection" className="gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1"></path><path d="M19 15V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V9"></path><path d="M21 21v-2h-4"></path><path d="M3 5h4V3"></path><path d="M7 5a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1V3"></path></svg>
                Подключение
              </TabsTrigger>
              <TabsTrigger value="setup" className="gap-1.5">
                <Cpu className="h-4 w-4" />
                Настройка
              </TabsTrigger>
              <TabsTrigger value="packets" className="gap-1.5">
                <Zap className="h-4 w-4" />
                Пакеты
              </TabsTrigger>
              <TabsTrigger value="log" className="gap-1.5">
                <FileText className="h-4 w-4" />
                Журнал
              </TabsTrigger>
            </TabsList>

            {/* ── Status Tab ── */}
            <TabsContent value="status">
              {nodes.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Radio className="h-16 w-16 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Нет устройств</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                      Устройства T-Echo не найдены. Загрузите демо-данные для
                      просмотра интерфейса или подключитесь к сети через вкладку «Подключение».
                    </p>
                    <Button onClick={handleSeed} variant="outline" className="gap-1.5">
                      <Download className="h-4 w-4" />
                      Демо-данные
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Search bar */}
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Поиск по названию или позывному..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Node count */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {searchQuery.trim()
                        ? `Найдено ${filteredNodes.length} из ${nodes.length}`
                        : `${nodes.length} устройств`}
                    </span>
                  </div>

                  {/* Node rows */}
                  {filteredNodes.length > 0 ? (
                    <div className="border rounded-lg divide-y overflow-hidden">
                      {filteredNodes.map(node => (
                        <NodeStatusCard
                          key={node.id}
                          node={node}
                          onDelete={handleDeleteNode}
                          onEdit={handleEditNode}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Ничего не найдено по запросу «{searchQuery}»
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Map Tab ── */}
            <TabsContent value="map">
              <Card>
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Map className="h-5 w-5 text-teal-500" />
                    <h3 className="text-base font-medium">Карта сети</h3>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {nodes.filter(n => n.latitude && n.longitude).length} из{' '}
                    {nodes.length} с позицией
                  </Badge>
                </div>
                <CardContent>
                  <div className="h-[500px] sm:h-[600px]">
                    <MapView nodes={nodes} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Channels Tab ── */}
            <TabsContent value="channels">
              <ChannelSettings
                channels={channels}
                onUpdateChannel={handleUpdateChannel}
                onCreateChannel={handleCreateChannel}
                onDeleteChannel={handleDeleteChannel}
                onSelectForConnection={handleSelectChannelForConnection}
              />
            </TabsContent>

            {/* ── Connection Tab ── */}
            <TabsContent value="connection">
              <ConnectionTab
                channels={channels}
                onSyncComplete={loadData}
                preselectedChannelId={preselectedChannelId}
                onPreselectedHandled={handlePreselectedHandled}
              />
            </TabsContent>

            {/* ── Device Setup Tab ── */}
            <TabsContent value="setup">
              <DeviceSetupTab channels={channels} />
            </TabsContent>

            {/* ── Packet Stream Tab ── */}
            <TabsContent value="packets">
              <PacketStreamTab nodes={nodes.map(n => ({ id: n.id, name: n.name, nodeId: n.nodeId }))} />
            </TabsContent>

            {/* ── Event Log Tab ── */}
            <TabsContent value="log">
              <EventLogTab nodes={nodes.map(n => ({ id: n.id, name: n.name, nodeId: n.nodeId }))} />
            </TabsContent>
          </Tabs>
        </main>

        {/* ── Footer ── */}
        <footer className="border-t bg-card mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>T-Echo Monitor · Meshtastic Dashboard</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  Автообновление: 30 сек
                </span>
                <span>
                  Узлов: {nodes.length} · Каналов: {channels.length}
                </span>
              </div>
            </div>
          </div>
        </footer>

        {/* ── Edit Node Dialog ── */}
        <NodeFormDialog
          open={editNodeOpen}
          onOpenChange={(open) => {
            setEditNodeOpen(open)
            if (!open) setEditingNode(null)
          }}
          editingNode={editingNode}
          onSubmit={handleUpdateNode}
        />
      </div>
    </TooltipProvider>
  )
}
