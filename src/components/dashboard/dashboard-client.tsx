'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { MeshNode, Channel } from '@/lib/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import NodeStatusCard from '@/components/dashboard/node-status-card'
import NodeFormDialog from '@/components/dashboard/node-form-dialog'
import MapView from '@/components/dashboard/map-view'
import ChannelSettings from '@/components/dashboard/channel-settings'
import ConnectionTab from '@/components/dashboard/connection-tab'
import {
  Radio,
  Map,
  Settings,
  Wifi,
  WifiOff,
  Battery,
  Signal,
  RefreshCw,
  Download,
  Activity,
  Plus,
  Users,
  Cable,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Data fetching helpers (still used for client-side refresh / mutations)
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
// Network Stats Overview
// ---------------------------------------------------------------------------

function NetworkStats({ nodes }: { nodes: MeshNode[] }) {
  const onlineCount = nodes.filter(n => n.status === 'online').length
  const offlineCount = nodes.filter(n => n.status === 'offline').length
  const avgBattery = nodes.length > 0
    ? Math.round(nodes.reduce((acc, n) => acc + n.batteryLevel, 0) / nodes.length)
    : 0
  const avgSnr = nodes.length > 0
    ? (nodes.reduce((acc, n) => acc + n.snr, 0) / nodes.length).toFixed(1)
    : '0.0'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Wifi className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{onlineCount}</p>
              <p className="text-xs text-muted-foreground">В сети</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <WifiOff className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{offlineCount}</p>
              <p className="text-xs text-muted-foreground">Не в сети</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Battery className="h-4 w-4 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgBattery}%</p>
              <p className="text-xs text-muted-foreground">Ср. батарея</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <Signal className="h-4 w-4 text-teal-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgSnr}</p>
              <p className="text-xs text-muted-foreground">Ср. SNR (дБ)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
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
  const [addNodeOpen, setAddNodeOpen] = useState(false)
  const [editNodeOpen, setEditNodeOpen] = useState(false)
  const [editingNode, setEditingNode] = useState<MeshNode | null>(null)

  // Track consecutive errors for backoff
  const errorCountRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = useCallback(async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) {
      // We don't have a separate isLoading state anymore — data is already present
    }
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

  const handleCreateNode = async (data: Record<string, unknown>) => {
    const res = await fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create node')
    await loadData()
    toast({
      title: 'Узел добавлен',
      description: `Устройство «${data.name}» добавлено в сеть`,
    })
  }

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
      // Exponential backoff: 30s → 60s → 120s → 120s (max)
      const baseInterval = 30000
      const backoff = Math.min(baseInterval * Math.pow(2, errorCountRef.current), 120000)
      const interval = errorCountRef.current === 0 ? baseInterval : backoff

      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        loadData()
      }, interval)
    }

    // Initial auto-refresh
    startPolling()

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [loadData])

  // Sync with server-fetched data when initial props change (hot reload / navigation)
  useEffect(() => {
    setNodes(initialNodes)
    setChannels(initialChannels)
  }, [initialNodes, initialChannels])

  const hasData = nodes.length > 0 || channels.length > 0
  const nextNodeId = nodes.length > 0
    ? Math.max(...nodes.map((n) => n.nodeId)) + 1
    : 1001

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
          {/* Network Stats Overview */}
          <div className="mb-6">
            <NetworkStats nodes={nodes} />
          </div>

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
                <Cable className="h-4 w-4" />
                Подключение
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
                      Устройства T-Echo не найдены. Добавьте устройство вручную или
                      загрузите демо-данные для просмотра интерфейса.
                    </p>
                    <div className="flex items-center gap-3">
                      <Button onClick={() => setAddNodeOpen(true)} className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        Добавить узел
                      </Button>
                      <Button onClick={handleSeed} variant="outline" className="gap-1.5">
                        <Download className="h-4 w-4" />
                        Демо-данные
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Add node button bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{nodes.length} устройств в сети</span>
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setAddNodeOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Добавить узел
                    </Button>
                  </div>

                  {/* Node cards grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nodes.map(node => (
                      <NodeStatusCard
                        key={node.id}
                        node={node}
                        onDelete={handleDeleteNode}
                        onEdit={handleEditNode}
                      />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Map Tab ── */}
            <TabsContent value="map">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Map className="h-5 w-5 text-teal-500" />
                      Карта сети
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {nodes.filter(n => n.latitude && n.longitude).length} из{' '}
                      {nodes.length} с позицией
                    </Badge>
                  </div>
                </CardHeader>
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
              />
            </TabsContent>

            {/* ── Connection Tab ── */}
            <TabsContent value="connection">
              <ConnectionTab onSyncComplete={loadData} />
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

        {/* ── Add Node Dialog ── */}
        <NodeFormDialog
          open={addNodeOpen}
          onOpenChange={setAddNodeOpen}
          onSubmit={handleCreateNode}
          nextNodeId={nextNodeId}
        />

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
