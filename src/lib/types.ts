export type NodeRole = 'CLIENT' | 'ROUTER' | 'REPEATER' | 'TRACKER'
export type NodeStatus = 'online' | 'offline' | 'unknown'
export type ModemPreset = 'ShortFast' | 'ShortModerate' | 'LongFast' | 'LongModerate' | 'VeryLongFast' | 'VeryLongModerate'
export type Region = 'EU_433' | 'EU_868' | 'RU_868' | 'US' | 'CN' | 'JP' | 'ANZ' | 'KR' | 'TW' | 'IN'

export interface NodeTelemetry {
  id: string
  nodeId: string
  batteryLevel: number
  voltage: number
  snr: number
  rssi: number
  temperature?: number
  humidity?: number
  createdAt: string
}

export interface MeshNode {
  id: string
  nodeId: number
  name: string
  shortName: string
  hardwareModel: string
  role: NodeRole
  status: NodeStatus
  batteryLevel: number
  voltage: number
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

// Role metadata for UI display
export const ROLE_META: Record<NodeRole, { label: string; description: string; sleeps: boolean; relays: boolean; color: string }> = {
  ROUTER:   { label: 'Маршрутизатор', description: 'Ретранслирует пакеты, всегда бодрствует', sleeps: false, relays: true, color: 'teal' },
  REPEATER: { label: 'Ретранслятор',  description: 'Только ретрансляция, всегда бодрствует', sleeps: false, relays: true, color: 'amber' },
  CLIENT:   { label: 'Клиент',        description: 'Обычный узел с экраном', sleeps: true, relays: true, color: 'blue' },
  TRACKER:  { label: 'Трекер',        description: 'GPS-трекинг, спит для экономии батареи', sleeps: true, relays: false, color: 'green' },
}

export interface Channel {
  id: string
  index: number
  name: string
  psk: string
  uplink: boolean
  downlink: boolean
  modemPreset: ModemPreset
  region: Region
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export const MODEM_PRESETS: { value: ModemPreset; label: string; description: string; forestNote?: string }[] = [
  { value: 'ShortFast', label: 'ShortFast', description: '~1.5 км (433МГц), высокая скорость' },
  { value: 'ShortModerate', label: 'ShortModerate', description: '~3 км (433МГц), средняя скорость' },
  { value: 'LongFast', label: 'LongFast', description: '~7 км (433МГц), хороший баланс', forestNote: 'Открытая местность, редкий лес' },
  { value: 'LongModerate', label: 'LongModerate', description: '~10 км (433МГц), средний баланс', forestNote: 'Смешанный лес — рекомендуемый!' },
  { value: 'VeryLongFast', label: 'VeryLongFast', description: '~15 км (433МГц), дальняя связь', forestNote: 'Густой лес, холмистая местность' },
  { value: 'VeryLongModerate', label: 'VeryLongModerate', description: '~20 км (433МГц), максимальная дальность', forestNote: 'Максимальная дальность в лесу' },
]

export const REGIONS: { value: Region; label: string; note?: string }[] = [
  { value: 'EU_433', label: 'EU 433 МГц', note: 'LPD433 — для России/СНГ' },
  { value: 'EU_868', label: 'EU 868 МГц' },
  { value: 'RU_868', label: 'RU 868 МГц' },
  { value: 'US', label: 'US 906 МГц' },
  { value: 'CN', label: 'CN 470 МГц' },
  { value: 'JP', label: 'JP 920 МГц' },
  { value: 'ANZ', label: 'ANZ 915 МГц' },
  { value: 'KR', label: 'KR 920 МГц' },
  { value: 'TW', label: 'TW 920 МГц' },
  { value: 'IN', label: 'IN 865 МГц' },
]
