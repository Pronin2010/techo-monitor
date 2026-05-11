import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/utils'

/** Порог автоопределения offline — 15 минут без пакетов */
const OFFLINE_TTL_MS = 15 * 60 * 1000

export async function GET() {
  try {
    const nodes = await db.node.findMany({
      orderBy: { nodeId: 'asc' },
      include: {
        telemetry: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    // Автоопределение offline: если lastSeen старше OFFLINE_TTL_MS — перевести в offline
    const now = Date.now()
    const staleNodes = nodes.filter(n =>
      n.status === 'online' &&
      n.lastSeen &&
      (now - new Date(n.lastSeen).getTime()) > OFFLINE_TTL_MS
    )

    // Пакетное обновление stale-узлов (без await — не блокируем ответ)
    if (staleNodes.length > 0) {
      Promise.all(
        staleNodes.map(n =>
          db.node.update({ where: { id: n.id }, data: { status: 'offline' } })
        )
      ).catch(err => console.error('Failed to mark nodes offline:', err))

      // Отражаем изменение в текущем ответе
      for (const n of staleNodes) {
        n.status = 'offline'
      }
    }

    return NextResponse.json(serializeBigInt(nodes))
  } catch (error) {
    console.error('Failed to fetch nodes:', error)
    return NextResponse.json({ error: 'Failed to fetch nodes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const node = await db.node.create({
      data: {
        nodeId: BigInt(body.nodeId),
        name: body.name,
        shortName: body.shortName || body.name.substring(0, 4).toUpperCase(),
        hardwareModel: body.hardwareModel || 'T-Echo',
        role: body.role || 'CLIENT',
        status: body.status || 'unknown',
        batteryLevel: body.batteryLevel != null ? Math.min(Number(body.batteryLevel), 100) : null,
        voltage: body.voltage ?? null,
        usbPower: body.usbPower === true ||
          (body.batteryLevel != null && Number(body.batteryLevel) >= 101) ||
          (body.voltage != null && Number(body.voltage) >= 4.4),
        snr: body.snr ?? 0.0,
        rssi: body.rssi ?? 0,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        altitude: body.altitude ?? null,
        speed: body.speed ?? null,
        heading: body.heading ?? null,
        satsInView: body.satsInView ?? null,
        hdop: body.hdop ?? null,
        pressure: body.pressure ?? null,
        channelUtilization: body.channelUtilization ?? null,
        airUtilTx: body.airUtilTx ?? null,
        lsSecs: body.lsSecs ?? null,
        minWakeSecs: body.minWakeSecs ?? 10,
        lastInfoPacket: body.lastInfoPacket ? new Date(body.lastInfoPacket) : null,
        lastTelemetryPacket: body.lastTelemetryPacket ? new Date(body.lastTelemetryPacket) : null,
        lastPositionPacket: body.lastPositionPacket ? new Date(body.lastPositionPacket) : null,
      },
    })
    return NextResponse.json(serializeBigInt(node), { status: 201 })
  } catch (error) {
    console.error('Failed to create node:', error)
    return NextResponse.json({ error: 'Failed to create node' }, { status: 500 })
  }
}
