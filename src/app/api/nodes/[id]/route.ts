import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const node = await db.node.findUnique({
      where: { id },
      include: {
        telemetry: {
          orderBy: { createdAt: 'desc' },
          take: 24,
        },
      },
    })
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }
    return NextResponse.json(node)
  } catch (error) {
    console.error('Failed to fetch node:', error)
    return NextResponse.json({ error: 'Failed to fetch node' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const node = await db.node.update({
      where: { id },
      data: body,
    })
    return NextResponse.json(node)
  } catch (error) {
    console.error('Failed to update node:', error)
    return NextResponse.json({ error: 'Failed to update node' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.node.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete node:', error)
    return NextResponse.json({ error: 'Failed to delete node' }, { status: 500 })
  }
}
