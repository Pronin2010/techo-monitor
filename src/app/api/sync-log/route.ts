import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/utils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '200')
    const nodeId = searchParams.get('nodeId')
    const source = searchParams.get('source')
    const eventType = searchParams.get('eventType')
    const action = searchParams.get('action')

    const where: Record<string, unknown> = {}

    if (nodeId) {
      // nodeId в запросе — decimal число из фронтенда
      // Hex только если содержит буквы a-f (Meshtastic hex-ID)
      const cleaned = String(nodeId).replace('!', '')
      const isHex = /^[0-9a-fA-F]+$/.test(cleaned) && /[a-fA-F]/.test(cleaned)
      const n = parseInt(cleaned, isHex ? 16 : 10)
      where.nodeId = BigInt(n || 0)
    }
    if (source) {
      where.source = source
    }
    if (eventType) {
      where.eventType = { contains: eventType }
    }
    if (action) {
      where.action = action
    }

    const logs = await db.syncLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json(serializeBigInt(logs))
  } catch (error) {
    console.error('Failed to fetch sync logs:', error)
    return NextResponse.json({ error: 'Failed to fetch sync logs' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    // Clear logs older than 24 hours (keep only recent)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const result = await db.syncLog.deleteMany({
      where: { createdAt: { lt: oneDayAgo } },
    })
    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    console.error('Failed to clean sync logs:', error)
    return NextResponse.json({ error: 'Failed to clean logs' }, { status: 500 })
  }
}
