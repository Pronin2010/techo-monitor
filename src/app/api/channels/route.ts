import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const channels = await db.channel.findMany({
      orderBy: { index: 'asc' },
    })
    return NextResponse.json(channels)
  } catch (error) {
    console.error('Failed to fetch channels:', error)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const channel = await db.channel.create({
      data: {
        index: body.index ?? 0,
        name: body.name,
        psk: body.psk,
        uplink: body.uplink ?? true,
        downlink: body.downlink ?? true,
        modemPreset: body.modemPreset || 'LongFast',
        region: body.region || 'EU_868',
        isDefault: body.isDefault ?? false,
      },
    })
    return NextResponse.json(channel, { status: 201 })
  } catch (error) {
    console.error('Failed to create channel:', error)
    return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...data } = body
    if (!id) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
    }
    const channel = await db.channel.update({
      where: { id },
      data,
    })
    return NextResponse.json(channel)
  } catch (error) {
    console.error('Failed to update channel:', error)
    return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
    }
    await db.channel.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete channel:', error)
    return NextResponse.json({ error: 'Failed to delete channel' }, { status: 500 })
  }
}
