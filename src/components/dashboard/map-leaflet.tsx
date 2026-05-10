'use client'

import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, Battery, Signal, Mountain, Moon, Sun, Repeat, EyeOff, Gauge, Navigation, Satellite } from 'lucide-react'
import type { MeshNode, NodeRole } from '@/lib/types'
import { ROLE_META } from '@/lib/types'

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Role-based marker colors
const ROLE_COLORS: Record<NodeRole, { primary: string; glow: string; label: string }> = {
  ROUTER:   { primary: '#0d9488', glow: '#14b8a6', label: 'R' }, // teal
  REPEATER: { primary: '#d97706', glow: '#f59e0b', label: 'P' }, // amber
  CLIENT:   { primary: '#3b82f6', glow: '#60a5fa', label: 'C' }, // blue
  TRACKER:  { primary: '#22c55e', glow: '#4ade80', label: 'T' }, // green
}

function createNodeIcon(node: MeshNode) {
  const roleInfo = ROLE_COLORS[node.role] || ROLE_COLORS.CLIENT
  const isOnline = node.status === 'online'
  const color = isOnline ? roleInfo.primary : '#9ca3af'
  const glowColor = isOnline ? roleInfo.glow : '#9ca3af'
  const pulseClass = isOnline ? 'animate-ping' : ''

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position:relative;width:28px;height:28px;">
        ${isOnline ? `<div style="position:absolute;width:28px;height:28px;border-radius:50%;background:${glowColor};opacity:0.25;" class="${pulseClass}"></div>` : ''}
        <div style="position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:10px;font-weight:bold;line-height:1;">${roleInfo.label}</span>
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function FitBounds({ nodes }: { nodes: MeshNode[] }) {
  const map = useMap()

  React.useEffect(() => {
    const nodesWithPosition = nodes.filter(n => n.latitude && n.longitude)
    if (nodesWithPosition.length > 0) {
      const bounds = L.latLngBounds(
        nodesWithPosition.map(n => [n.latitude!, n.longitude!])
      )
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [nodes, map])

  return null
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'online': return 'В сети'
    case 'offline': return 'Не в сети'
    default: return 'Неизвестно'
  }
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'online': return 'default'
    case 'offline': return 'destructive'
    default: return 'secondary'
  }
}

function formatSleepInterval(seconds: number | null): string {
  if (seconds == null) return '—'
  if (seconds < 60) return `${seconds} сек`
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин`
  return `${(seconds / 3600).toFixed(1)} ч`
}

// Get mesh line color based on whether both nodes are always-awake
function getMeshLineStyle(nodeA: MeshNode, nodeB: MeshNode) {
  const aAlwaysAwake = !ROLE_META[nodeA.role]?.sleeps
  const bAlwaysAwake = !ROLE_META[nodeB.role]?.sleeps
  // Both always awake = solid line; at least one sleeping = dashed
  if (aAlwaysAwake && bAlwaysAwake) {
    return { color: '#14b8a6', weight: 2, opacity: 0.6, dashArray: '' }
  }
  return { color: '#a78bfa', weight: 1.5, opacity: 0.4, dashArray: '5, 10' }
}

export default function MapLeaflet({ nodes }: MapViewProps) {
  const nodesWithPosition = nodes.filter(n => n.latitude && n.longitude)

  // Count by role
  const routerCount = nodes.filter(n => n.role === 'ROUTER').length
  const repeaterCount = nodes.filter(n => n.role === 'REPEATER').length
  const trackerCount = nodes.filter(n => n.role === 'TRACKER').length
  const clientCount = nodes.filter(n => n.role === 'CLIENT').length

  const onlineCount = nodes.filter(n => n.status === 'online').length
  const offlineCount = nodes.filter(n => n.status === 'offline').length

  // Generate mesh lines between all nodes with positions
  const meshLines: Array<{ positions: [number, number][]; key: string; style: ReturnType<typeof getMeshLineStyle> }> = []
  for (let i = 0; i < nodesWithPosition.length; i++) {
    for (let j = i + 1; j < nodesWithPosition.length; j++) {
      const style = getMeshLineStyle(nodesWithPosition[i], nodesWithPosition[j])
      meshLines.push({
        positions: [
          [nodesWithPosition[i].latitude!, nodesWithPosition[i].longitude!],
          [nodesWithPosition[j].latitude!, nodesWithPosition[j].longitude!],
        ],
        key: `${nodesWithPosition[i].id}-${nodesWithPosition[j].id}`,
        style,
      })
    }
  }

  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden border">
      {/* Custom CSS to fix Leaflet default marker styling */}
      <style jsx global>{`
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 0.5rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
        }
        .leaflet-popup-content {
          margin: 8px 12px;
          font-size: 13px;
          line-height: 1.5;
        }
      `}</style>

      <MapContainer
        center={[55.7558, 37.6173]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds nodes={nodes} />

        {/* Node markers */}
        {nodesWithPosition.map(node => {
          const meta = ROLE_META[node.role]
          const sleeps = meta?.sleeps ?? false
          const relays = meta?.relays ?? true

          return (
            <Marker
              key={node.id}
              position={[node.latitude!, node.longitude!]}
              icon={createNodeIcon(node)}
            >
              <Popup>
                <div className="min-w-[220px]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">{node.name}</h3>
                    <Badge variant={getStatusBadgeVariant(node.status)} className="text-[10px] ml-2">
                      {getStatusLabel(node.status)}
                    </Badge>
                  </div>

                  {node.shortName && (
                    <p className="text-xs text-gray-500 mb-1">
                      Позывной: <span className="font-mono font-medium">{node.shortName}</span>
                    </p>
                  )}

                  {/* Role with behavior indicators */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <Badge variant="outline" className="text-[10px] gap-0.5">
                      {meta?.label ?? node.role}
                    </Badge>
                    <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full ${
                      sleeps
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {sleeps ? <Moon className="h-2.5 w-2.5" /> : <Sun className="h-2.5 w-2.5" />}
                      {sleeps ? 'Спит' : 'Бодрствует'}
                    </span>
                    <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full ${
                      relays
                        ? 'bg-teal-100 text-teal-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {relays ? <Repeat className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                      {relays ? 'Mesh' : 'Свои'}
                    </span>
                  </div>

                  {/* Sleep interval info for sleeping roles */}
                  {sleeps && node.lsSecs != null && (
                    <div className="text-[10px] text-purple-700 bg-purple-50 rounded px-1.5 py-1 mb-1.5">
                      <Moon className="h-2.5 w-2.5 inline" /> Сон: каждые {formatSleepInterval(node.lsSecs)}, бодрствует {node.minWakeSecs || 10} сек
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Battery className="h-3 w-3 text-gray-500" />
                      <span>Батарея: <span className="font-medium">{node.batteryLevel != null ? `${node.batteryLevel}%` : '?'}</span></span>
                      {node.usbPower && <span className="text-amber-500 font-medium ml-1">USB</span>}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Signal className="h-3 w-3 text-gray-500" />
                      <span>
                        Сигнал: <span className="font-medium">SNR {node.snr} дБ / RSSI {node.rssi} дБм</span>
                      </span>
                    </div>

                    {node.altitude != null && (
                      <div className="flex items-center gap-1.5">
                        <Mountain className="h-3 w-3 text-gray-500" />
                        <span>Высота: <span className="font-medium">{node.altitude} м</span></span>
                      </div>
                    )}

                    {node.speed != null && node.speed > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Gauge className="h-3 w-3 text-gray-500" />
                        <span>Скорость: <span className="font-medium">{(node.speed * 3.6).toFixed(1)} км/ч</span></span>
                      </div>
                    )}

                    {node.heading != null && node.heading > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Navigation className="h-3 w-3 text-gray-500" />
                        <span>Курс: <span className="font-medium">{node.heading.toFixed(0)}°</span></span>
                      </div>
                    )}

                    {node.satsInView != null && (
                      <div className="flex items-center gap-1.5">
                        <Satellite className="h-3 w-3 text-gray-500" />
                        <span>Спутники: <span className={`font-medium ${node.satsInView >= 4 ? 'text-green-600' : node.satsInView >= 2 ? 'text-amber-600' : 'text-red-600'}`}>{node.satsInView}</span></span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      {node.status === 'online' ? (
                        <Wifi className="h-3 w-3 text-green-500" />
                      ) : (
                        <WifiOff className="h-3 w-3 text-red-500" />
                      )}
                      <span>
                        Статус: <span className="font-medium">{getStatusLabel(node.status)}</span>
                      </span>
                    </div>
                  </div>

                  {node.hardwareModel && (
                    <p className="text-[10px] text-gray-400 mt-2 pt-1.5 border-t">
                      {node.hardwareModel} · Узел #{node.nodeId}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Mesh network lines */}
        {meshLines.map(line => (
          <Polyline
            key={line.key}
            positions={line.positions}
            pathOptions={line.style}
          />
        ))}
      </MapContainer>

      {/* Stats overlay panel */}
      <div className="absolute top-3 right-3 z-[1000] bg-background/90 backdrop-blur-sm rounded-lg border shadow-md p-3 min-w-[180px]">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Сеть
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Узлов</span>
            <span className="font-semibold">{nodes.length}</span>
          </div>

          {/* Role counts */}
          {routerCount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
                ROUTER
              </span>
              <span className="font-semibold text-teal-600">{routerCount}</span>
            </div>
          )}
          {repeaterCount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                REPEATER
              </span>
              <span className="font-semibold text-amber-600">{repeaterCount}</span>
            </div>
          )}
          {trackerCount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                TRACKER
              </span>
              <span className="font-semibold text-green-600">{trackerCount}</span>
            </div>
          )}
          {clientCount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                CLIENT
              </span>
              <span className="font-semibold text-blue-600">{clientCount}</span>
            </div>
          )}

          <div className="border-t my-1" />

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Wifi className="h-3 w-3 text-green-500" />
              В сети
            </span>
            <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] h-5">
              {onlineCount}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <WifiOff className="h-3 w-3 text-red-500" />
              Не в сети
            </span>
            <Badge variant="destructive" className="text-[10px] h-5">
              {offlineCount}
            </Badge>
          </div>
        </div>

        {nodesWithPosition.length > 0 && (
          <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground">
            На карте: {nodesWithPosition.length} из {nodes.length} узлов
          </div>
        )}

        {/* Legend for mesh lines */}
        <div className="mt-2 pt-2 border-t space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <div className="w-6 h-0 border-t-2 border-teal-500" />
            <span>Постоянная связь</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <div className="w-6 h-0 border-t-2 border-dashed border-purple-400" />
            <span>Периодическая связь</span>
          </div>
        </div>
      </div>
    </div>
  )
}
