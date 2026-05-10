import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/utils'

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
        batteryLevel: body.batteryLevel ?? 100,
        voltage: body.voltage ?? 3.7,
        snr: body.snr ?? 0.0,
        rssi: body.rssi ?? 0,
        latitude: body.latitude,
        longitude: body.longitude,
        altitude: body.altitude,
        lsSecs: body.lsSecs ?? null,
        minWakeSecs: body.minWakeSecs ?? 10,
      },
    })
    return NextResponse.json(serializeBigInt(node), { status: 201 })
  } catch (error) {
    console.error('Failed to create node:', error)
    return NextResponse.json({ error: 'Failed to create node' }, { status: 500 })
  }
}
