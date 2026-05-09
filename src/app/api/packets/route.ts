import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/utils'

// In-memory ring buffer for recent packets (last 200)
const MAX_PACKETS = 200
const packetBuffer: PacketEntry[] = []

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

// GET /api/packets — get recent real-time packets
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), MAX_PACKETS)
    const since = searchParams.get('since') // ISO timestamp — return only packets after this time
    const fromId = searchParams.get('fromId') // filter by sender nodeId
    const packetType = searchParams.get('type') // filter by packet type name

    let packets = [...packetBuffer].reverse() // newest first

    // Filter by time
    if (since) {
      const sinceDate = new Date(since)
      packets = packets.filter(p => new Date(p.receivedAt) > sinceDate)
    }

    // Filter by fromId
    if (fromId) {
      packets = packets.filter(p => String(p.fromId) === fromId)
    }

    // Filter by packet type
    if (packetType) {
      packets = packets.filter(p => p.packetType === packetType)
    }

    return NextResponse.json(serializeBigInt(packets.slice(0, limit)))
  } catch (error) {
    console.error('Failed to fetch packets:', error)
    return NextResponse.json({ error: 'Failed to fetch packets' }, { status: 500 })
  }
}

// POST /api/packets — receive a real-time packet from bridge
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const packet = body.packet

    if (!packet) {
      return NextResponse.json({ error: 'Expected { packet: {...} }' }, { status: 400 })
    }

    const entry: PacketEntry = {
      receivedAt: packet.receivedAt || new Date().toISOString(),
      fromId: packet.fromId,
      fromName: packet.fromName || `!${packet.fromId?.toString(16)?.padStart(8, '0')}`,
      toId: packet.toId ?? null,
      portnum: packet.portnum ?? 0,
      packetType: packet.packetType || 'UNKNOWN',
      channel: packet.channel ?? 0,
      rssi: packet.rssi ?? null,
      snr: packet.snr ?? null,
      hopLimit: packet.hopLimit ?? 0,
      details: packet.details ?? null,
    }

    // Add to ring buffer
    packetBuffer.push(entry)
    if (packetBuffer.length > MAX_PACKETS) {
      packetBuffer.shift()
    }

    // Also log to SyncLog for persistence
    try {
      await db.syncLog.create({
        data: {
          source: 'serial',
          nodeId: BigInt(entry.fromId || 0),
          nodeName: entry.fromName,
          action: 'packet',
          eventType: entry.packetType.toLowerCase(),
          details: JSON.stringify({
            portnum: entry.portnum,
            rssi: entry.rssi,
            snr: entry.snr,
            channel: entry.channel,
            ...entry.details,
          }),
          createdAt: new Date(entry.receivedAt),
        },
      })
    } catch {
      // DB write is optional for real-time packets — don't block
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Failed to store packet:', error)
    return NextResponse.json({ error: 'Failed to store packet' }, { status: 500 })
  }
}
