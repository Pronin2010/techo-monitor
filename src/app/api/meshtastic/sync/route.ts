import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/meshtastic/sync — get connection config
export async function GET() {
  try {
    let config = await db.connectionConfig.findFirst()
    if (!config) {
      config = await db.connectionConfig.create({
        data: {
          type: 'serial',
          serialPort: '',
          mqttBroker: '',
          mqttTopic: 'msh/EU_433/#',
          isEnabled: false,
          status: 'disconnected',
        },
      })
    }
    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to fetch connection config:', error)
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
  }
}

// PUT /api/meshtastic/sync — update connection config
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    let config = await db.connectionConfig.findFirst()

    if (config) {
      config = await db.connectionConfig.update({
        where: { id: config.id },
        data: {
          type: body.type,
          serialPort: body.serialPort ?? '',
          mqttBroker: body.mqttBroker ?? '',
          mqttTopic: body.mqttTopic ?? 'msh/EU_433/#',
          mqttUsername: body.mqttUsername ?? '',
          mqttPassword: body.mqttPassword ?? '',
          isEnabled: body.isEnabled ?? false,
        },
      })
    } else {
      config = await db.connectionConfig.create({
        data: {
          type: body.type,
          serialPort: body.serialPort ?? '',
          mqttBroker: body.mqttBroker ?? '',
          mqttTopic: body.mqttTopic ?? 'msh/EU_433/#',
          mqttUsername: body.mqttUsername ?? '',
          mqttPassword: body.mqttPassword ?? '',
          isEnabled: body.isEnabled ?? false,
        },
      })
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to update connection config:', error)
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
  }
}

/** Конвертация nodeId (string/int/number) в BigInt для Prisma */
function toBigIntNodeId(raw: unknown): bigint {
  if (typeof raw === 'bigint') return raw
  if (typeof raw === 'number') return BigInt(raw)
  if (typeof raw === 'string') {
    const cleaned = raw.replace('!', '')
    // Hex только если содержит буквы a-f (Meshtastic hex-ID вроде "!d4b597d0")
    // Чистые цифры — decimal (например "3570512816" из JSON)
    const isHex = /^[0-9a-fA-F]+$/.test(cleaned) && /[a-fA-F]/.test(cleaned)
    const n = parseInt(cleaned, isHex ? 16 : 10)
    return BigInt(n || 0)
  }
  return BigInt(0)
}

/**
 * Определяет типы событий на основе того, какие поля пришли от трекера.
 * Возвращает массив строк-типов и JSON-объект с деталями.
 */
function detectEventTypes(incoming: Record<string, unknown>, prevNode?: Record<string, unknown> | null) {
  const types: string[] = []
  const details: Record<string, unknown> = {}

  // Battery
  if (incoming.batteryLevel != null) {
    types.push('battery')
    details.battery = incoming.batteryLevel
    if (prevNode && prevNode.batteryLevel != null) {
      const diff = (incoming.batteryLevel as number) - (prevNode.batteryLevel as number)
      if (diff !== 0) details.batteryDiff = diff
    }
  }

  // Voltage
  if (incoming.voltage != null) {
    details.voltage = incoming.voltage
  }

  // Position (GPS)
  if (incoming.latitude != null && incoming.longitude != null) {
    types.push('position')
    details.latitude = incoming.latitude
    details.longitude = incoming.longitude
    if (incoming.altitude != null) details.altitude = incoming.altitude
    if (incoming.speed != null) details.speed = incoming.speed
    if (incoming.heading != null) details.heading = incoming.heading
    if (incoming.satsInView != null) details.satsInView = incoming.satsInView
    if (incoming.hdop != null) details.hdop = incoming.hdop
    // Проверяем, изменилась ли позиция
    if (prevNode && prevNode.latitude != null && prevNode.longitude != null) {
      const latDiff = Math.abs((incoming.latitude as number) - (prevNode.latitude as number))
      const lonDiff = Math.abs((incoming.longitude as number) - (prevNode.longitude as number))
      details.positionMoved = latDiff > 0.00001 || lonDiff > 0.00001
    } else {
      details.positionMoved = true
    }
  }

  // Environment (temperature/humidity/pressure)
  if (incoming.temperature != null || incoming.humidity != null || incoming.pressure != null) {
    types.push('environment')
    if (incoming.temperature != null) details.temperature = incoming.temperature
    if (incoming.humidity != null) details.humidity = incoming.humidity
    if (incoming.pressure != null) details.pressure = incoming.pressure
  }

  // Network (channelUtilization/airUtilTx)
  if (incoming.channelUtilization != null || incoming.airUtilTx != null) {
    types.push('network')
    if (incoming.channelUtilization != null) details.channelUtilization = incoming.channelUtilization
    if (incoming.airUtilTx != null) details.airUtilTx = incoming.airUtilTx
  }

  // Signal (SNR/RSSI)
  if (incoming.snr != null || incoming.rssi != null) {
    types.push('signal')
    if (incoming.snr != null) details.snr = incoming.snr
    if (incoming.rssi != null) details.rssi = incoming.rssi
  }

  // Если нет специфичных событий — это heartbeat (узел просто обнаружен)
  if (types.length === 0) {
    types.push('heartbeat')
  }

  return { types, details }
}

// POST /api/meshtastic/sync — receive data from a Meshtastic bridge script
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nodes: incomingNodes, source } = body

    if (!incomingNodes || !Array.isArray(incomingNodes)) {
      return NextResponse.json(
        { error: 'Expected { nodes: [...], source: "serial"|"mqtt" }' },
        { status: 400 }
      )
    }

    const results = []

    for (const incoming of incomingNodes) {
      const nodeId = toBigIntNodeId(incoming.nodeId)

      let existingNode = await db.node.findUnique({
        where: { nodeId },
      })

      if (existingNode) {
        // Определяем какие данные пришли
        const { types, details } = detectEventTypes(incoming, existingNode)

        existingNode = await db.node.update({
          where: { id: existingNode.id },
          data: {
            name: incoming.name ?? existingNode.name,
            shortName: incoming.shortName ?? existingNode.shortName,
            role: incoming.role ?? existingNode.role,
            status: 'online',
            ...(incoming.batteryLevel != null && { batteryLevel: incoming.batteryLevel }),
            ...(incoming.voltage != null && { voltage: incoming.voltage }),
            ...(incoming.snr != null && { snr: incoming.snr }),
            ...(incoming.rssi != null && { rssi: incoming.rssi }),
            ...(incoming.latitude != null && { latitude: incoming.latitude }),
            ...(incoming.longitude != null && { longitude: incoming.longitude }),
            ...(incoming.altitude != null && { altitude: incoming.altitude }),
            ...(incoming.speed != null && { speed: incoming.speed }),
            ...(incoming.heading != null && { heading: incoming.heading }),
            ...(incoming.satsInView != null && { satsInView: incoming.satsInView }),
            ...(incoming.hdop != null && { hdop: incoming.hdop }),
            ...(incoming.pressure != null && { pressure: incoming.pressure }),
            ...(incoming.channelUtilization != null && { channelUtilization: incoming.channelUtilization }),
            ...(incoming.airUtilTx != null && { airUtilTx: incoming.airUtilTx }),
            usbPower: incoming.usbPower === true || (incoming.voltage != null && incoming.voltage > 3.9),
            lsSecs: incoming.lsSecs ?? existingNode.lsSecs,
            minWakeSecs: incoming.minWakeSecs ?? existingNode.minWakeSecs,
            lastSeen: incoming.lastHeard
              ? new Date(incoming.lastHeard as string)
              : new Date(),
          },
        })

        // Telemetry entry — с позицией
        await db.telemetry.create({
          data: {
            nodeId: existingNode.id,
            batteryLevel: incoming.batteryLevel ?? existingNode.batteryLevel,
            voltage: incoming.voltage ?? existingNode.voltage,
            snr: incoming.snr ?? existingNode.snr,
            rssi: incoming.rssi ?? existingNode.rssi,
            temperature: incoming.temperature ?? null,
            humidity: incoming.humidity ?? null,
            pressure: incoming.pressure ?? null,
            latitude: incoming.latitude ?? null,
            longitude: incoming.longitude ?? null,
            altitude: incoming.altitude ?? null,
            speed: incoming.speed ?? null,
            heading: incoming.heading ?? null,
            satsInView: incoming.satsInView ?? null,
            hdop: incoming.hdop ?? null,
            channelUtilization: incoming.channelUtilization ?? null,
            airUtilTx: incoming.airUtilTx ?? null,
            createdAt: incoming.lastHeard
              ? new Date(incoming.lastHeard as string)
              : new Date(),
          },
        })

        // Per-node SyncLog — используем lastHeard от бриджа как реальное время приёма
        const eventTimestamp = incoming.lastHeard
          ? new Date(incoming.lastHeard as string)
          : new Date()

        await db.syncLog.create({
          data: {
            source,
            nodeId: existingNode.nodeId,
            nodeName: existingNode.name,
            action: 'updated',
            eventType: types.join(','),
            details: JSON.stringify(details),
            createdAt: eventTimestamp,
          },
        })

        results.push({
          action: 'updated',
          nodeId: Number(existingNode.nodeId),
          name: existingNode.name,
          shortName: existingNode.shortName,
          role: existingNode.role,
          batteryLevel: existingNode.batteryLevel,
          voltage: existingNode.voltage,
          snr: existingNode.snr,
          rssi: existingNode.rssi,
          temperature: incoming.temperature,
          humidity: incoming.humidity,
          hasPosition: existingNode.latitude !== null && existingNode.longitude !== null,
          latitude: existingNode.latitude,
          longitude: existingNode.longitude,
          events: types,
        })
      } else {
        // New node
        const { types, details } = detectEventTypes(incoming)

        const newNode = await db.node.create({
          data: {
            nodeId,
            name: incoming.name || `Node ${nodeId}`,
            shortName: incoming.shortName || `N${nodeId}`.substring(0, 4),
            hardwareModel: incoming.hardwareModel || 'T-Echo',
            role: incoming.role || 'CLIENT',
            status: 'online',
            batteryLevel: incoming.batteryLevel ?? null,
            voltage: incoming.voltage ?? null,
            snr: incoming.snr ?? 0,
            rssi: incoming.rssi ?? 0,
            usbPower: incoming.usbPower === true || (incoming.voltage != null && incoming.voltage > 3.9),
            latitude: incoming.latitude,
            longitude: incoming.longitude,
            altitude: incoming.altitude,
            speed: incoming.speed ?? null,
            heading: incoming.heading ?? null,
            satsInView: incoming.satsInView ?? null,
            hdop: incoming.hdop ?? null,
            pressure: incoming.pressure ?? null,
            channelUtilization: incoming.channelUtilization ?? null,
            airUtilTx: incoming.airUtilTx ?? null,
            lsSecs: incoming.lsSecs ?? null,
            minWakeSecs: incoming.minWakeSecs ?? 10,
            lastSeen: incoming.lastHeard
              ? new Date(incoming.lastHeard as string)
              : new Date(),
          },
        })

        await db.telemetry.create({
          data: {
            nodeId: newNode.id,
            batteryLevel: incoming.batteryLevel ?? null,
            voltage: incoming.voltage ?? null,
            snr: incoming.snr ?? 0,
            rssi: incoming.rssi ?? 0,
            temperature: incoming.temperature,
            humidity: incoming.humidity,
            pressure: incoming.pressure ?? null,
            latitude: incoming.latitude,
            longitude: incoming.longitude,
            altitude: incoming.altitude,
            speed: incoming.speed ?? null,
            heading: incoming.heading ?? null,
            satsInView: incoming.satsInView ?? null,
            hdop: incoming.hdop ?? null,
            channelUtilization: incoming.channelUtilization ?? null,
            airUtilTx: incoming.airUtilTx ?? null,
            createdAt: incoming.lastHeard
              ? new Date(incoming.lastHeard as string)
              : new Date(),
          },
        })

        // SyncLog для нового узла
        const newEventTimestamp = incoming.lastHeard
          ? new Date(incoming.lastHeard as string)
          : new Date()

        await db.syncLog.create({
          data: {
            source,
            nodeId: newNode.nodeId,
            nodeName: newNode.name,
            action: 'created',
            eventType: 'device_info,' + types.join(','),
            details: JSON.stringify({
              hardwareModel: newNode.hardwareModel,
              role: newNode.role,
              ...details,
            }),
            createdAt: newEventTimestamp,
          },
        })

        results.push({
          action: 'created',
          nodeId: Number(newNode.nodeId),
          name: newNode.name,
          shortName: newNode.shortName,
          role: newNode.role,
          batteryLevel: newNode.batteryLevel,
          voltage: newNode.voltage,
          snr: newNode.snr,
          rssi: newNode.rssi,
          temperature: incoming.temperature,
          humidity: incoming.humidity,
          hasPosition: newNode.latitude !== null && newNode.longitude !== null,
          latitude: newNode.latitude,
          longitude: newNode.longitude,
          events: types,
        })
      }
    }

    // Update connection config lastSync
    const config = await db.connectionConfig.findFirst()
    if (config) {
      await db.connectionConfig.update({
        where: { id: config.id },
        data: { lastSync: new Date(), status: 'connected' },
      })
    }

    return NextResponse.json({
      success: true,
      source,
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error('Failed to sync Meshtastic data:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Failed to sync data', details: message }, { status: 500 })
  }
}
