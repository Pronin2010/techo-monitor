// ============================================================================
// Типы и константы Meshtastic — актуальные для прошивки 2.7.15
// Protobuf: https://github.com/meshtastic/protobufs/blob/master/meshtastic/config.proto
// PSK: 256 бит (32 байта). Только диапазон 433 МГц.
// ============================================================================

// ---------------------------------------------------------------------------
// Device Roles (Config.DeviceConfig.Role)
// ---------------------------------------------------------------------------

export type NodeRole =
  | 'CLIENT'
  | 'CLIENT_MUTE'
  | 'CLIENT_HIDDEN'
  | 'ROUTER'
  | 'ROUTER_CLIENT'  // deprecated v2.3.15
  | 'TRACKER'
  | 'REPEATER'       // deprecated v2.7.x
  | 'SENSOR'
  | 'LOST_AND_FOUND'
  | 'TAK_TRACKER'    // new v2.7
  | 'ROUTER_LATE'    // new v2.7
  | 'CLIENT_BASE'    // new v2.7

export type NodeStatus = 'online' | 'offline' | 'unknown'

// ---------------------------------------------------------------------------
// Modem Presets (Config.LoRaConfig.ModemPreset)
// UPPER_SNAKE_CASE — как в protobuf enum
// ---------------------------------------------------------------------------

export type ModemPreset =
  | 'LONG_FAST'
  | 'LONG_MODERATE'
  | 'LONG_TURBO'
  | 'MEDIUM_FAST'
  | 'MEDIUM_SLOW'
  | 'SHORT_FAST'
  | 'SHORT_SLOW'
  | 'SHORT_TURBO'
  | 'LITE_FAST'      // new v2.7 — EU 866, 125 kHz
  | 'LITE_SLOW'      // new v2.7 — EU 866, 125 kHz
  | 'NARROW_FAST'    // new v2.7 — EU 868, 62.5 kHz
  | 'NARROW_SLOW'    // new v2.7 — EU 868, 62.5 kHz

// ---------------------------------------------------------------------------
// Regions — ТОЛЬКО 433 МГц (Config.LoRaConfig.RegionCode)
// ---------------------------------------------------------------------------

export type Region =
  | 'EU_433'    // LPD433 — основной для России/СНГ
  | 'ANZ_433'   // Australia / New Zealand 433 MHz
  | 'UA_433'    // Ukraine 433 MHz
  | 'KZ_433'    // Kazakhstan 433 MHz
  | 'PH_433'    // Philippines 433 MHz
  | 'MY_433'    // Malaysia 433 MHz

// ---------------------------------------------------------------------------
// GPS Mode (Config.PositionConfig.GpsMode) — замена gps_enabled
// ---------------------------------------------------------------------------

export type GpsMode = 'DISABLED' | 'ENABLED' | 'NOT_PRESENT'

// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------

export interface NodeTelemetry {
  id: string
  nodeId: string
  batteryLevel: number | null
  voltage: number | null
  snr: number
  rssi: number
  temperature?: number
  humidity?: number
  createdAt: string
}

// ---------------------------------------------------------------------------
// Mesh Node
// ---------------------------------------------------------------------------

export interface MeshNode {
  id: string
  nodeId: number
  name: string
  shortName: string
  hardwareModel: string
  role: NodeRole
  status: NodeStatus
  batteryLevel: number | null
  voltage: number | null
  usbPower: boolean
  snr: number
  rssi: number
  latitude: number | null
  longitude: number | null
  altitude: number | null
  lsSecs: number | null       // Light sleep interval in seconds
  minWakeSecs: number | null   // Minimum awake time in seconds
  lastSeen: string
  createdAt: string
  updatedAt: string
  telemetry: NodeTelemetry[]
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

export interface Channel {
  id: string
  index: number
  name: string
  psk: string
  uplink: boolean
  downlink: boolean
  modemPreset: ModemPreset
  region: Region
  frequency: number | null   // Переопределение частоты в МГц
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Role metadata for UI display
// ---------------------------------------------------------------------------

export const ROLE_META: Record<NodeRole, {
  label: string
  description: string
  sleeps: boolean
  relays: boolean
  color: string
  deprecated?: boolean
}> = {
  CLIENT:         { label: 'Клиент',            description: 'Обычный узел, ретранслирует пакеты',                       sleeps: false, relays: true,  color: 'blue' },
  CLIENT_MUTE:    { label: 'Молчаливый клиент', description: 'Как CLIENT, но не отвечает на пинги',                     sleeps: false, relays: true,  color: 'slate' },
  CLIENT_HIDDEN:  { label: 'Скрытый клиент',    description: 'Не отображается в списке узлов, минимум эфира',            sleeps: false, relays: true,  color: 'gray' },
  ROUTER:         { label: 'Маршрутизатор',      description: 'Ядро сети, всегда бодрствует, приоритет ретрансляции',      sleeps: false, relays: true,  color: 'teal' },
  ROUTER_CLIENT:  { label: 'Роутер+Клиент',     description: 'ROUTER с функциями CLIENT (устарело)',                     sleeps: false, relays: true,  color: 'emerald', deprecated: true },
  TRACKER:        { label: 'Трекер',            description: 'GPS-трекинг, спит для экономии батареи',                    sleeps: true,  relays: false, color: 'green' },
  REPEATER:       { label: 'Ретранслятор',      description: 'Только пересылка, всегда бодрствует (устарело)',            sleeps: false, relays: true,  color: 'amber',  deprecated: true },
  SENSOR:         { label: 'Сенсор',            description: 'Датчик с телеметрией, спящий режим',                        sleeps: true,  relays: false, color: 'purple' },
  LOST_AND_FOUND: { label: 'Потерянное',        description: 'Вещает GPS для поиска устройства',                          sleeps: false, relays: true,  color: 'red' },
  TAK_TRACKER:    { label: 'TAK Трекер',        description: 'ATAK PLI трансляции, уменьшенные broadcast\'ы',             sleeps: true,  relays: false, color: 'orange' },
  ROUTER_LATE:    { label: 'Роутер (поздний)',  description: 'Ретранслирует последним, для доп. покрытия',                sleeps: false, relays: true,  color: 'teal' },
  CLIENT_BASE:    { label: 'Базовая станция',   description: 'Мощный узел, приоритет для слабых узлов',                   sleeps: false, relays: true,  color: 'cyan' },
}

// ---------------------------------------------------------------------------
// Modem Presets — UPPER_SNAKE_CASE
// ============================================================================

export const MODEM_PRESETS: { value: ModemPreset; label: string; description: string; forestNote?: string; deprecated?: boolean }[] = [
  { value: 'SHORT_FAST',      label: 'Short Fast',       description: '~1.5 км, высокая скорость, 250 Baud' },
  { value: 'SHORT_SLOW',      label: 'Short Slow',       description: '~3 км, низкая скорость' },
  { value: 'SHORT_TURBO',     label: 'Short Turbo',      description: '~1.5 км, максимальная скорость, 500 кГц' },
  { value: 'MEDIUM_FAST',     label: 'Medium Fast',      description: '~5 км, хороший баланс скорости и дальности' },
  { value: 'MEDIUM_SLOW',     label: 'Medium Slow',      description: '~8 км, средняя скорость' },
  { value: 'LONG_FAST',       label: 'Long Fast',        description: '~7 км (433МГц), хороший баланс', forestNote: 'Открытая местность, редкий лес' },
  { value: 'LONG_MODERATE',   label: 'Long Moderate',    description: '~10 км (433МГц), сбалансированный', forestNote: 'Смешанный лес — рекомендуемый!' },
  { value: 'LONG_TURBO',      label: 'Long Turbo',       description: '~7 км, аналог LongFast, 500 кГц' },
  { value: 'LITE_FAST',       label: 'Lite Fast',        description: '~5 км, EU 866 МГц, 125 кГц' },
  { value: 'LITE_SLOW',       label: 'Lite Slow',        description: '~7 км, EU 866 МГц, 125 кГц, аналог LongFast' },
  { value: 'NARROW_FAST',     label: 'Narrow Fast',      description: '~3 км, EU 868 МГц, 62.5 кГц, узкая полоса' },
  { value: 'NARROW_SLOW',     label: 'Narrow Slow',      description: '~7 км, EU 868 МГц, 62.5 кГц, аналог LongFast' },
]

// ---------------------------------------------------------------------------
// Regions — только 433 МГц
// ---------------------------------------------------------------------------

export const REGIONS: { value: Region; label: string; note?: string }[] = [
  { value: 'EU_433',  label: 'EU 433 МГц',  note: 'LPD433 — для России/СНГ' },
  { value: 'ANZ_433', label: 'ANZ 433 МГц', note: 'Australia / New Zealand' },
  { value: 'UA_433',  label: 'UA 433 МГц',  note: 'Украина' },
  { value: 'KZ_433',  label: 'KZ 433 МГц',  note: 'Казахстан' },
  { value: 'PH_433',  label: 'PH 433 МГц',  note: 'Philippines' },
  { value: 'MY_433',  label: 'MY 433 МГц',  note: 'Malaysia' },
]
