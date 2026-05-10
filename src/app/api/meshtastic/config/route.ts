import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * POST /api/meshtastic/config — применить пресет к устройству через мост.
 *
 * Тело запроса:
 *   presetId: string          — ID пресета из БД
 *   nodeId: string            — nodeId устройства ('!hexid' или '' для локального BASE)
 *   rebootSecs?: number       — задержка перезагрузки (по умолчанию 5 сек, 0 = без перезагрузки)
 *   deviceName?: string       — длинное имя устройства (например, 'Tracker 01')
 *   deviceShortName?: string  — короткое имя (макс. 4 символа, например, 'TR01')
 *   factoryReset?: boolean    — сбросить до заводских перед применением пресета
 *
 * Логика:
 *   1. Загрузить пресет из БД
 *   2. Сформировать конфиг для моста
 *   3. Отправить POST на HTTP API моста (http://localhost:8420/api/apply-config)
 *   4. Вернуть результат
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { presetId, nodeId = '', rebootSecs = 5,
            deviceName, deviceShortName, factoryReset = false } = body

    if (!presetId) {
      return NextResponse.json(
        { success: false, message: 'Укажите presetId' },
        { status: 400 }
      )
    }

    // Загрузить пресет из БД с каналом
    const preset = await db.preset.findUnique({
      where: { id: presetId },
      include: { channel: true },
    })
    if (!preset) {
      return NextResponse.json(
        { success: false, message: 'Пресет не найден' },
        { status: 404 }
      )
    }

    // Загрузить порт API моста из ConnectionConfig
    const connConfig = await db.connectionConfig.findFirst()
    const bridgeApiPort = 8420 // Фиксированный порт моста (можно вынести в ConnectionConfig)
    const bridgeUrl = `http://localhost:${bridgeApiPort}`

    // Сформировать конфиг для моста
    const config = {
      role: preset.role,
      nodeInfoBroadcastSecs: preset.nodeInfoBroadcastSecs,
      gpsMode: preset.gpsMode,
      gpsUpdateInterval: preset.gpsUpdateInterval,
      gpsAttemptTime: preset.gpsAttemptTime,
      agpsEnabled: preset.agpsEnabled,
      positionPrecision: preset.positionPrecision,
      positionFlags: preset.positionFlags,
      positionBroadcastSecs: preset.positionBroadcastSecs,
      smartBroadcastEnabled: preset.smartBroadcastEnabled,
      smartBroadcastMinDist: preset.smartBroadcastMinDist,
      smartBroadcastMinInterval: preset.smartBroadcastMinInterval,
      powerSaving: preset.powerSaving,
      lsSecs: preset.lsSecs,
      minWakeSecs: preset.minWakeSecs,
      region: preset.region,
      modemPreset: preset.modemPreset,
      txPower: preset.txPower,
      hopLimit: preset.hopLimit,
      // usePreamble удалён — не существует в LoRaConfig прошивки 2.7.15
      rebroadcastMode: preset.rebroadcastMode,
      bluetoothEnabled: preset.bluetoothEnabled,
      bluetoothFixedPin: preset.bluetoothFixedPin,
      screenOnSecs: preset.screenOnSecs,
      ledDisabled: preset.ledDisabled,
      telemetryInterval: preset.telemetryInterval,
      // Данные канала (из привязанного Channel)
      channelName: preset.channel?.name || '',
      channelPsk: preset.channel?.psk || '',
      channelUplink: preset.channel?.uplink ?? true,
      channelDownlink: preset.channel?.downlink ?? true,
    }

    // Отправить на HTTP API моста
    const applyUrl = `${bridgeUrl}/api/apply-config`
    const bridgePayload = {
      config,
      nodeId,
      rebootSecs,
      presetName: preset.name,
      deviceName: deviceName || undefined,
      deviceShortName: deviceShortName || undefined,
      factoryReset,
    }

    let bridgeResult: { success: boolean; message: string; sections?: string[] }

    try {
      const resp = await fetch(applyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bridgePayload),
        signal: AbortSignal.timeout(120_000), // 120 сек таймаут (reboot + reconnect + factory reset)
      })
      bridgeResult = await resp.json()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({
        success: false,
        message: `Не удалось подключиться к мосту (порт ${bridgeApiPort}): ${msg}. Убедитесь, что мост запущен: python techo-bridge.py --mode serial --port /dev/ttyUSB0`,
      }, { status: 502 })
    }

    // Записать SyncLog
    await db.syncLog.create({
      data: {
        source: 'config_push',
        nodeName: preset.name,
        action: bridgeResult.success ? 'config_applied' : 'config_failed',
        eventType: 'admin',
        details: JSON.stringify({
          presetId: preset.id,
          presetName: preset.name,
          nodeId: nodeId || 'local',
          deviceName: deviceName || null,
          deviceShortName: deviceShortName || null,
          factoryReset,
          sections: bridgeResult.sections,
          message: bridgeResult.message,
        }),
      },
    })

    return NextResponse.json(bridgeResult, {
      status: bridgeResult.success ? 200 : 500,
    })
  } catch (error) {
    console.error('Failed to apply config:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, message: `Ошибка сервера: ${message}` },
      { status: 500 }
    )
  }
}
