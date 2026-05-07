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
      // Find existing node by nodeId (Meshtastic node number)
      let existingNode = await db.node.findUnique({
        where: { nodeId: incoming.nodeId },
      })

      if (existingNode) {
        // Update existing node
        existingNode = await db.node.update({
          where: { id: existingNode.id },
          data: {
            name: incoming.name ?? existingNode.name,
            shortName: incoming.shortName ?? existingNode.shortName,
            role: incoming.role ?? existingNode.role,
            status: 'online',
            batteryLevel: incoming.batteryLevel ?? existingNode.batteryLevel,
            voltage: incoming.voltage ?? existingNode.voltage,
            snr: incoming.snr ?? existingNode.snr,
            rssi: incoming.rssi ?? existingNode.rssi,
            latitude: incoming.latitude ?? existingNode.latitude,
            longitude: incoming.longitude ?? existingNode.longitude,
            altitude: incoming.altitude ?? existingNode.altitude,
            lsSecs: incoming.lsSecs ?? existingNode.lsSecs,
            minWakeSecs: incoming.minWakeSecs ?? existingNode.minWakeSecs,
            lastSeen: new Date(),
          },
        })

        // Create telemetry entry
        await db.telemetry.create({
          data: {
            nodeId: existingNode.id,
            batteryLevel: incoming.batteryLevel ?? existingNode.batteryLevel,
            voltage: incoming.voltage ?? existingNode.voltage,
            snr: incoming.snr ?? existingNode.snr,
            rssi: incoming.rssi ?? existingNode.rssi,
            temperature: incoming.temperature,
            humidity: incoming.humidity,
          },
        })

        results.push({ action: 'updated', nodeId: existingNode.nodeId })
      } else {
        // Create new node
        const newNode = await db.node.create({
          data: {
            nodeId: incoming.nodeId,
            name: incoming.name || `Node ${incoming.nodeId}`,
            shortName: incoming.shortName || `N${incoming.nodeId}`.substring(0, 4),
            hardwareModel: incoming.hardwareModel || 'T-Echo',
            role: incoming.role || 'CLIENT',
            status: 'online',
            batteryLevel: incoming.batteryLevel ?? 100,
            voltage: incoming.voltage ?? 3.7,
            snr: incoming.snr ?? 0,
            rssi: incoming.rssi ?? 0,
            latitude: incoming.latitude,
            longitude: incoming.longitude,
            altitude: incoming.altitude,
            lsSecs: incoming.lsSecs ?? null,
            minWakeSecs: incoming.minWakeSecs ?? 10,
          },
        })

        // Create initial telemetry
        await db.telemetry.create({
          data: {
            nodeId: newNode.id,
            batteryLevel: incoming.batteryLevel ?? 100,
            voltage: incoming.voltage ?? 3.7,
            snr: incoming.snr ?? 0,
            rssi: incoming.rssi ?? 0,
            temperature: incoming.temperature,
            humidity: incoming.humidity,
          },
        })

        results.push({ action: 'created', nodeId: newNode.nodeId })
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
    return NextResponse.json({ error: 'Failed to sync data' }, { status: 500 })
  }
}
