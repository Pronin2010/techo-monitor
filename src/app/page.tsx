import { db } from '@/lib/db'
import type { MeshNode, Channel } from '@/lib/types'
import DashboardClient from '@/components/dashboard/dashboard-client'

// ---------------------------------------------------------------------------
// Serialize Prisma results for client-side consumption
// Prisma returns Date objects; we need ISO strings to match the MeshNode / Channel types
// ---------------------------------------------------------------------------

function serializeNode(node: Awaited<ReturnType<typeof db.node.findMany>>[number]): MeshNode {
  return {
    id: node.id,
    nodeId: node.nodeId,
    name: node.name,
    shortName: node.shortName,
    hardwareModel: node.hardwareModel,
    role: node.role as MeshNode['role'],
    status: node.status as MeshNode['status'],
    batteryLevel: node.batteryLevel,
    voltage: node.voltage,
    snr: node.snr,
    rssi: node.rssi,
    latitude: node.latitude,
    longitude: node.longitude,
    altitude: node.altitude,
    lsSecs: node.lsSecs,
    minWakeSecs: node.minWakeSecs,
    lastSeen: node.lastSeen.toISOString(),
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
    telemetry: node.telemetry.map(t => ({
      id: t.id,
      nodeId: t.nodeId,
      batteryLevel: t.batteryLevel,
      voltage: t.voltage,
      snr: t.snr,
      rssi: t.rssi,
      temperature: t.temperature,
      humidity: t.humidity,
      createdAt: t.createdAt.toISOString(),
    })),
  }
}

function serializeChannel(channel: Awaited<ReturnType<typeof db.channel.findMany>>[number]): Channel {
  return {
    id: channel.id,
    index: channel.index,
    name: channel.name,
    psk: channel.psk,
    uplink: channel.uplink,
    downlink: channel.downlink,
    modemPreset: channel.modemPreset as Channel['modemPreset'],
    region: channel.region as Channel['region'],
    isDefault: channel.isDefault,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Server Component — fetches data directly from the database
// This eliminates the need for client-side fetch('/api/*') calls on initial load
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  let initialNodes: MeshNode[] = []
  let initialChannels: Channel[] = []

  try {
    const [rawNodes, rawChannels] = await Promise.all([
      db.node.findMany({
        orderBy: { nodeId: 'asc' },
        include: {
          telemetry: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      db.channel.findMany({
        orderBy: { index: 'asc' },
      }),
    ])

    initialNodes = rawNodes.map(serializeNode)
    initialChannels = rawChannels.map(serializeChannel)
  } catch (error) {
    console.error('Failed to load initial data from database:', error)
    // Return empty data — the client component will show "no devices" state
  }

  return <DashboardClient initialNodes={initialNodes} initialChannels={initialChannels} />
}
