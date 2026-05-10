import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * POST /api/meshtastic/set-owner — установить имя устройства через мост.
 *
 * Тело запроса:
 *   nodeId: string            — nodeId устройства ('!hexid' или '' для локального BASE)
 *   deviceName: string        — длинное имя (например, 'Tracker 01')
 *   deviceShortName: string   — короткое имя (макс. 4 символа, например, 'TR01')
 *
 * Логика:
 *   1. Отправить POST на HTTP API моста (http://localhost:8420/api/set-owner)
 *   2. Обновить имя в БД дашборда
 *   3. Вернуть результат
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nodeId = '', deviceName, deviceShortName } = body

    if (!deviceName && !deviceShortName) {
      return NextResponse.json(
        { success: false, message: 'Укажите хотя бы одно имя (длинное или короткое)' },
        { status: 400 }
      )
    }

    // Порт API моста
    const bridgeApiPort = 8420
    const bridgeUrl = `http://localhost:${bridgeApiPort}/api/set-owner`

    const bridgePayload = {
      nodeId,
      deviceName: deviceName || undefined,
      deviceShortName: deviceShortName || undefined,
    }

    let bridgeResult: { success: boolean; message: string; longName?: string; shortName?: string }

    try {
      const resp = await fetch(bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bridgePayload),
        signal: AbortSignal.timeout(30_000), // 30 сек — setOwner() быстрый, без перезагрузки
      })
      bridgeResult = await resp.json()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({
        success: false,
        message: `Не удалось подключиться к мосту (порт ${bridgeApiPort}): ${msg}. Убедитесь, что мост запущен.`,
      }, { status: 502 })
    }

    // Если имя установлено на устройстве — обновляем также в БД дашборда
    if (bridgeResult.success) {
      // Конвертируем nodeId в BigInt для поиска в БД
      let nodeIdBig: bigint
      if (nodeId && nodeId.startsWith('!')) {
        nodeIdBig = BigInt(parseInt(nodeId.substring(1), 16))
      } else if (nodeId) {
        const cleaned = nodeId.replace('!', '')
        const isHex = /^[0-9a-fA-F]+$/.test(cleaned) && /[a-fA-F]/.test(cleaned)
        nodeIdBig = BigInt(parseInt(cleaned, isHex ? 16 : 10))
      } else {
        // Локальный узел — найдём по isLocal из статуса моста
        // Получаем статус моста для определения локального nodeId
        try {
          const statusResp = await fetch(`http://localhost:${bridgeApiPort}/api/status`)
          const statusData = await statusResp.json() as { nodes?: Array<{ nodeId: string; isLocal: boolean }> }
          const localNode = statusData.nodes?.find((n) => n.isLocal)
          if (localNode) {
            const localId = String(localNode.nodeId)
            const cleaned = localId.replace('!', '')
            const isHex = /^[0-9a-fA-F]+$/.test(cleaned) && /[a-fA-F]/.test(cleaned)
            nodeIdBig = BigInt(parseInt(cleaned, isHex ? 16 : 10))
          } else {
            nodeIdBig = BigInt(0)
          }
        } catch {
          nodeIdBig = BigInt(0)
        }
      }

      if (nodeIdBig > BigInt(0)) {
        try {
          const existingNode = await db.node.findUnique({
            where: { nodeId: nodeIdBig },
          })
          if (existingNode) {
            await db.node.update({
              where: { id: existingNode.id },
              data: {
                name: deviceName || existingNode.name,
                shortName: deviceShortName || existingNode.shortName,
              },
            })
          }
        } catch (dbErr) {
          // Ошибка обновления БД — не критично, имя уже установлено на устройстве
          console.error('Failed to update node name in DB:', dbErr)
        }
      }

      // Записываем SyncLog
      await db.syncLog.create({
        data: {
          source: 'set_owner',
          nodeId: nodeIdBig,
          nodeName: deviceName || undefined,
          action: 'name_changed',
          eventType: 'admin',
          details: JSON.stringify({
            nodeId: nodeId || 'local',
            longName: deviceName || null,
            shortName: deviceShortName || null,
            message: bridgeResult.message,
          }),
        },
      })
    }

    return NextResponse.json(bridgeResult, {
      status: bridgeResult.success ? 200 : 500,
    })
  } catch (error) {
    console.error('Failed to set owner:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, message: `Ошибка сервера: ${message}` },
      { status: 500 }
    )
  }
}
