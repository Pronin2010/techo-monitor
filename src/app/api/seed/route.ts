import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { BUILTIN_PRESETS } from '@/lib/builtin-presets'

export async function POST() {
  try {
    // Clear existing data
    await db.telemetry.deleteMany()
    await db.node.deleteMany()
    await db.channel.deleteMany()

    // ── Forest tracker scenario ──
    // Node 1: Base Station (ROUTER) — connected to PC via USB
    const node1 = await db.node.create({
      data: {
        nodeId: 1001,
        name: 'Base Station',
        shortName: 'BASE',
        hardwareModel: 'T-Echo',
        role: 'ROUTER',
        status: 'online',
        batteryLevel: 95,
        voltage: 4.12,
        snr: 8.5,
        rssi: -38,
        latitude: 55.7558,
        longitude: 37.6173,
        altitude: 165.0,
        lastSeen: new Date(),
      },
    })

    // Node 2: Tracker Alpha — in the forest
    const node2 = await db.node.create({
      data: {
        nodeId: 1002,
        name: 'Tracker Alpha',
        shortName: 'TALF',
        hardwareModel: 'T-Echo',
        role: 'TRACKER',
        status: 'online',
        batteryLevel: 72,
        voltage: 3.78,
        snr: 5.25,
        rssi: -68,
        latitude: 55.7618,
        longitude: 37.6236,
        altitude: 148.0,
        lsSecs: 300,      // Sleep 5 min between transmissions
        minWakeSecs: 10,   // Awake 10 sec
        lastSeen: new Date(Date.now() - 15000),
      },
    })

    // Node 3: Tracker Bravo — in the forest
    const node3 = await db.node.create({
      data: {
        nodeId: 1003,
        name: 'Tracker Bravo',
        shortName: 'TBRA',
        hardwareModel: 'T-Echo',
        role: 'TRACKER',
        status: 'offline',
        batteryLevel: 31,
        voltage: 3.32,
        snr: 2.0,
        rssi: -105,
        latitude: 55.7488,
        longitude: 37.6086,
        altitude: 139.0,
        lsSecs: 2700,     // Sleep 45 min between transmissions
        minWakeSecs: 10,   // Awake 10 sec
        lastSeen: new Date(Date.now() - 1800000),
      },
    })

    // Create telemetry history for each node
    const now = Date.now()
    for (const node of [node1, node2, node3]) {
      for (let i = 0; i < 24; i++) {
        const time = new Date(now - i * 300000) // every 5 min
        await db.telemetry.create({
          data: {
            nodeId: node.id,
            batteryLevel: Math.max(0, node.batteryLevel - i * Math.floor(Math.random() * 3)),
            voltage: Math.max(2.8, node.voltage - i * 0.01 * Math.random()),
            snr: node.snr + (Math.random() - 0.5) * 4,
            rssi: node.rssi + Math.floor((Math.random() - 0.5) * 20),
            temperature: 8 + Math.random() * 6, // Forest temperature ~8-14°C
            humidity: 60 + Math.random() * 25, // Forest humidity ~60-85%
            createdAt: time,
          },
        })
      }
    }

    // ── Forest-optimized private channel ──
    await db.channel.create({
      data: {
        index: 1,
        name: 'forest-track',
        psk: 'AQ==',
        uplink: true,
        downlink: true,
        modemPreset: 'LONG_MODERATE', // Better range in forest
        region: 'EU_433',
        isDefault: true,
      },
    })

    // Secondary channel for telemetry data
    await db.channel.create({
      data: {
        index: 2,
        name: 'forest-data',
        psk: 'SGVsbG8gV29ybGQ=',
        uplink: true,
        downlink: true,
        modemPreset: 'LONG_FAST',
        region: 'EU_433',
        isDefault: false,
      },
    })

    // ── Встроенные пресеты ──
    // Создаём только если их ещё нет
    const existingPresets = await db.preset.count()
    if (existingPresets === 0) {
      await db.preset.createMany({ data: BUILTIN_PRESETS })
    }

    return NextResponse.json({ success: true, message: 'Forest tracker demo data seeded successfully' })
    // Note: seed uses small nodeId values (1001-1003) which fit in JSON-safe range
  } catch (error) {
    console.error('Failed to seed data:', error)
    return NextResponse.json({ error: 'Failed to seed data' }, { status: 500 })
  }
}
