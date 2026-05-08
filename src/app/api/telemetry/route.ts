import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/utils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const nodeId = searchParams.get('nodeId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where = nodeId ? { nodeId } : {}

    const telemetry = await db.telemetry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return NextResponse.json(serializeBigInt(telemetry))
  } catch (error) {
    console.error('Failed to fetch telemetry:', error)
    return NextResponse.json({ error: 'Failed to fetch telemetry' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const telemetry = await db.telemetry.create({
      data: {
        nodeId: body.nodeId,
        batteryLevel: body.batteryLevel ?? 100,
        voltage: body.voltage ?? 3.7,
        snr: body.snr ?? 0.0,
        rssi: body.rssi ?? 0,
        temperature: body.temperature,
        humidity: body.humidity,
      },
    })

    // Update the node's last seen and current values
    await db.node.update({
      where: { id: body.nodeId },
      data: {
        lastSeen: new Date(),
        batteryLevel: body.batteryLevel ?? 100,
        voltage: body.voltage ?? 3.7,
        snr: body.snr ?? 0.0,
        rssi: body.rssi ?? 0,
      },
    })

    return NextResponse.json(serializeBigInt(telemetry), { status: 201 })
  } catch (error) {
    console.error('Failed to create telemetry:', error)
    return NextResponse.json({ error: 'Failed to create telemetry' }, { status: 500 })
  }
}
