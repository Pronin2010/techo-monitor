import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeBigInt } from '@/lib/utils'
import { BUILTIN_PRESETS } from '@/lib/builtin-presets'

// GET /api/presets — список всех пресетов (автосид + миграция встроенных)
export async function GET() {
  try {
    // Очистка осиротевших встроенных пресетов (созданных до появления builtinId)
    await db.preset.deleteMany({
      where: { isBuiltIn: true, builtinId: null },
    })

    // Upsert каждого встроенного пресета — атомарная операция,
    // исключающая дублирование при конкурентных запросах
    for (const builtin of BUILTIN_PRESETS) {
      const { builtinId, ...data } = builtin
      await db.preset.upsert({
        where: { builtinId },
        update: data,
        create: { ...data, builtinId },
      })
    }

    const presets = await db.preset.findMany({
      include: { channel: true },
      orderBy: [{ isBuiltIn: 'desc' }, { name: 'asc' }],
    })
    return NextResponse.json(serializeBigInt(presets))
  } catch (error) {
    console.error('Ошибка загрузки пресетов:', error)
    return NextResponse.json({ error: 'Не удалось загрузить пресеты' }, { status: 500 })
  }
}

// POST /api/presets — создать пресет
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const preset = await db.preset.create({
      data: {
        name: body.name,
        description: body.description || null,
        icon: body.icon || '📡',
        role: body.role || 'TRACKER',
        nodeInfoBroadcastSecs: body.nodeInfoBroadcastSecs ?? 900,
        powerSaving: body.powerSaving ?? false,
        lsSecs: body.lsSecs ?? 300,
        minWakeSecs: body.minWakeSecs ?? 10,
        gpsMode: body.gpsMode || 'ENABLED',
        gpsUpdateInterval: body.gpsUpdateInterval ?? 30,
        agpsEnabled: body.agpsEnabled ?? false,
        gpsAttemptTime: body.gpsAttemptTime ?? 90,
        positionPrecision: body.positionPrecision ?? 32,
        positionFlags: body.positionFlags ?? 299,
        positionBroadcastSecs: body.positionBroadcastSecs ?? 300,
        smartBroadcastEnabled: body.smartBroadcastEnabled ?? true,
        smartBroadcastMinDist: body.smartBroadcastMinDist ?? 100,
        smartBroadcastMinInterval: body.smartBroadcastMinInterval ?? 120,
        fixedPosition: body.fixedPosition ?? false,
        telemetryInterval: body.telemetryInterval ?? 300,
        region: body.region || 'EU_433',
        modemPreset: body.modemPreset || 'LONG_MODERATE',
        txPower: body.txPower ?? 0,
        hopLimit: body.hopLimit ?? 5,
        usePreamble: body.usePreamble ?? false,
        bluetoothEnabled: body.bluetoothEnabled ?? true,
        bluetoothFixedPin: body.bluetoothFixedPin || null,
        screenOnSecs: body.screenOnSecs ?? 60,
        ledDisabled: body.ledDisabled ?? true,
        rebroadcastMode: body.rebroadcastMode || 'ALL',
        channelId: body.channelId || null,
        isBuiltIn: false,
      },
      include: { channel: true },
    })

    return NextResponse.json(serializeBigInt(preset), { status: 201 })
  } catch (error) {
    console.error('Ошибка создания пресета:', error)
    return NextResponse.json({ error: 'Не удалось создать пресет' }, { status: 500 })
  }
}

// PUT /api/presets — обновить пресет
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ error: 'ID пресета обязателен' }, { status: 400 })
    }

    const existing = await db.preset.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Пресет не найден' }, { status: 404 })
    }

    const preset = await db.preset.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        icon: data.icon,
        role: data.role,
        nodeInfoBroadcastSecs: data.nodeInfoBroadcastSecs,
        powerSaving: data.powerSaving,
        lsSecs: data.lsSecs,
        minWakeSecs: data.minWakeSecs,
        gpsMode: data.gpsMode,
        gpsUpdateInterval: data.gpsUpdateInterval,
        agpsEnabled: data.agpsEnabled,
        gpsAttemptTime: data.gpsAttemptTime,
        positionPrecision: data.positionPrecision,
        positionFlags: data.positionFlags,
        positionBroadcastSecs: data.positionBroadcastSecs,
        smartBroadcastEnabled: data.smartBroadcastEnabled,
        smartBroadcastMinDist: data.smartBroadcastMinDist,
        smartBroadcastMinInterval: data.smartBroadcastMinInterval,
        fixedPosition: data.fixedPosition,
        telemetryInterval: data.telemetryInterval,
        region: data.region,
        modemPreset: data.modemPreset,
        txPower: data.txPower,
        hopLimit: data.hopLimit,
        usePreamble: data.usePreamble,
        bluetoothEnabled: data.bluetoothEnabled,
        bluetoothFixedPin: data.bluetoothFixedPin || null,
        screenOnSecs: data.screenOnSecs,
        ledDisabled: data.ledDisabled,
        rebroadcastMode: data.rebroadcastMode,
        channelId: data.channelId || null,
      },
      include: { channel: true },
    })

    return NextResponse.json(serializeBigInt(preset))
  } catch (error) {
    console.error('Ошибка обновления пресета:', error)
    return NextResponse.json({ error: 'Не удалось обновить пресет' }, { status: 500 })
  }
}

// DELETE /api/presets?id=xxx — удалить пресет
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID пресета обязателен' }, { status: 400 })
    }

    const existing = await db.preset.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Пресет не найден' }, { status: 404 })
    }
    if (existing.isBuiltIn) {
      return NextResponse.json({ error: 'Системный пресет нельзя удалить' }, { status: 403 })
    }

    await db.preset.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ошибка удаления пресета:', error)
    return NextResponse.json({ error: 'Не удалось удалить пресет' }, { status: 500 })
  }
}
