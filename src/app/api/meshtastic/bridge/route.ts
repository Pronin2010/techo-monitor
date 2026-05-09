import { NextResponse } from 'next/server'

/**
 * GET /api/meshtastic/bridge — статус моста и список доступных узлов.
 *
 * Проксирует запрос к HTTP API моста (localhost:8420/api/status).
 * Возвращает: { connected, mode, nodes: [...] }
 */
export async function GET() {
  const bridgeApiPort = 8420
  const bridgeUrl = `http://localhost:${bridgeApiPort}/api/status`

  try {
    const resp = await fetch(bridgeUrl, {
      signal: AbortSignal.timeout(5_000),
    })
    const data = await resp.json()
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      connected: false,
      mode: 'serial',
      nodes: [],
      error: `Мост не доступен (порт ${bridgeApiPort}): ${msg}`,
    }, { status: 502 })
  }
}
