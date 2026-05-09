/**
 * Встроенные пресеты для T-Echo Meshtastic Monitor
 * Используются при автосоздании (первый GET /api/presets) и в /api/seed
 */

export interface BuiltinPresetData {
  name: string
  description: string
  icon: string
  role: string
  nodeInfoBroadcastSecs: number
  powerSaving: boolean
  lsSecs: number
  minWakeSecs: number
  gpsMode: string
  gpsUpdateInterval: number
  positionPrecision: number
  positionBroadcastSecs: number
  smartBroadcastEnabled: boolean
  smartBroadcastMinDist: number
  smartBroadcastMinInterval: number
  telemetryInterval: number
  region: string
  modemPreset: string
  txPower: number
  hopLimit: number
  usePreamble: boolean
  bluetoothEnabled: boolean
  screenOnSecs: number
  ledDisabled: boolean
  rebroadcastMode: string
  isBuiltIn: true
}

export const BUILTIN_PRESETS: BuiltinPresetData[] = [
  {
    name: 'Трекер лес 12ч',
    description:
      'Максимальное обновление позиции, без сна, полная mesh-участие. Автономность ~12-15 часов на 1000 мАч.',
    icon: '🌲',
    role: 'TRACKER',
    nodeInfoBroadcastSecs: 900,
    powerSaving: false,
    lsSecs: 60,
    minWakeSecs: 10,
    gpsMode: 'ENABLED',
    gpsUpdateInterval: 15,
    positionPrecision: 32,
    positionBroadcastSecs: 60,
    smartBroadcastEnabled: true,
    smartBroadcastMinDist: 20,
    smartBroadcastMinInterval: 60,
    telemetryInterval: 300,
    region: 'EU_433',
    modemPreset: 'LONG_MODERATE',
    txPower: 0,
    hopLimit: 5,
    usePreamble: false,
    bluetoothEnabled: true,
    screenOnSecs: 60,
    ledDisabled: true,
    rebroadcastMode: 'ALL',
    isBuiltIn: true,
  },
  {
    name: 'Трекер лес 5 дней',
    description:
      'Экономия батареи с циклом сон/бодрствование. Позиция каждые 5 мин. Автономность ~5 дней на 1000 мАч.',
    icon: '🔋',
    role: 'TRACKER',
    nodeInfoBroadcastSecs: 900,
    powerSaving: true,
    lsSecs: 300,
    minWakeSecs: 10,
    gpsMode: 'ENABLED',
    gpsUpdateInterval: 30,
    positionPrecision: 32,
    positionBroadcastSecs: 300,
    smartBroadcastEnabled: true,
    smartBroadcastMinDist: 50,
    smartBroadcastMinInterval: 300,
    telemetryInterval: 900,
    region: 'EU_433',
    modemPreset: 'LONG_MODERATE',
    txPower: 0,
    hopLimit: 5,
    usePreamble: false,
    bluetoothEnabled: true,
    screenOnSecs: 30,
    ledDisabled: true,
    rebroadcastMode: 'ALL',
    isBuiltIn: true,
  },
  {
    name: 'Базовая станция',
    description:
      'Всегда бодрствует, ретранслирует все пакеты, приоритет маршрутизации. Внешнее питание.',
    icon: '🏗️',
    role: 'ROUTER',
    nodeInfoBroadcastSecs: 3600,
    powerSaving: false,
    lsSecs: 0,
    minWakeSecs: 0,
    gpsMode: 'ENABLED',
    gpsUpdateInterval: 30,
    positionPrecision: 32,
    positionBroadcastSecs: 900,
    smartBroadcastEnabled: false,
    smartBroadcastMinDist: 100,
    smartBroadcastMinInterval: 900,
    telemetryInterval: 3600,
    region: 'EU_433',
    modemPreset: 'LONG_MODERATE',
    txPower: 0,
    hopLimit: 5,
    usePreamble: false,
    bluetoothEnabled: true,
    screenOnSecs: 300,
    ledDisabled: false,
    rebroadcastMode: 'ALL',
    isBuiltIn: true,
  },
  {
    name: 'Клиент по умолчанию',
    description:
      'Стандартный узел с экраном, ретранслирует пакеты. Подходит для ручного использования.',
    icon: '📱',
    role: 'CLIENT',
    nodeInfoBroadcastSecs: 900,
    powerSaving: false,
    lsSecs: 0,
    minWakeSecs: 0,
    gpsMode: 'ENABLED',
    gpsUpdateInterval: 30,
    positionPrecision: 13,
    positionBroadcastSecs: 300,
    smartBroadcastEnabled: true,
    smartBroadcastMinDist: 100,
    smartBroadcastMinInterval: 300,
    telemetryInterval: 300,
    region: 'EU_433',
    modemPreset: 'LONG_FAST',
    txPower: 0,
    hopLimit: 3,
    usePreamble: false,
    bluetoothEnabled: true,
    screenOnSecs: 60,
    ledDisabled: false,
    rebroadcastMode: 'ALL',
    isBuiltIn: true,
  },
]
