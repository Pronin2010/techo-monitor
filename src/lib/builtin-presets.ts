/**
 * Встроенные пресеты для T-Echo Meshtastic Monitor
 * Используются при автосоздании (GET /api/presets)
 *
 * builtinId — стабильный идентификатор для миграции:
 *   при изменении данных в коде, пресет в БД обновится автоматически
 */

export interface BuiltinPresetData {
  builtinId: string
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
  agpsEnabled: boolean
  gpsAttemptTime: number
  positionPrecision: number   // channel module_settings.position_precision (0-32 бита). 32 = макс. точность (~1м), 13 = дефолт прошивки (~2.9км), 0 = не передавать
  positionFlags: number      // position.position_flags (битовая маска PositionFlags protobuf).
                             // ALT=1, ALT_MSL=2, GEO=4, DOP=8, HVDOP=16, SAT=32, SEQ=64, TS=128, HEADING=256, SPEED=512
                             // 299 = дефолт без SPEED (пеший), 811 = дефолт прошивки (с SPEED), 1023 = все
  positionBroadcastSecs: number
  smartBroadcastEnabled: boolean
  smartBroadcastMinDist: number
  smartBroadcastMinInterval: number
  fixedPosition: boolean    // position.fixed_position: зафиксировать координаты. true = устройство использует последнюю позицию без обновления GPS. ⚠️ Баг #8403: нужен gps_mode=DISABLED
  telemetryInterval: number
  region: string
  modemPreset: string
  txPower: number
  hopLimit: number
  usePreamble: boolean
  bluetoothEnabled: boolean
  bluetoothFixedPin: string | null
  screenOnSecs: number
  ledDisabled: boolean
  rebroadcastMode: string
  isBuiltIn: true
}

export const BUILTIN_PRESETS: BuiltinPresetData[] = [
  {
    builtinId: 'tracker-forest-12h',
    name: 'Трекер лес 12ч',
    description:
      'Автономная работа без телефона. GPS всегда включён, EASY™ прогноз орбит. Автономность ~20 часов на 850 мАч.',
    icon: '🌲',
    role: 'TRACKER',
    nodeInfoBroadcastSecs: 900,
    powerSaving: false,
    lsSecs: 0,
    minWakeSecs: 10,
    gpsMode: 'ENABLED',
    gpsUpdateInterval: 1,
    agpsEnabled: false,
    gpsAttemptTime: 90,
    positionPrecision: 32,  // Максимальная точность координат (~1м)
    positionFlags: 299,     // ALT+MSL+DOP+SAT+HEADING (дефолт 811 без SPEED — пеший режим)
    positionBroadcastSecs: 60,
    smartBroadcastEnabled: true,
    smartBroadcastMinDist: 20,
    smartBroadcastMinInterval: 60,
    fixedPosition: false,
    telemetryInterval: 300,
    region: 'EU_433',
    modemPreset: 'LONG_MODERATE',
    txPower: 0,
    hopLimit: 5,
    usePreamble: false,
    bluetoothEnabled: true,
    bluetoothFixedPin: '113566',
    screenOnSecs: 60,
    ledDisabled: true,
    rebroadcastMode: 'ALL',
    isBuiltIn: true,
  },
  {
    builtinId: 'tracker-forest-5d',
    name: 'Трекер лес 5 дней',
    description:
      'Экономия батареи с циклом сон/бодрствование. Позиция каждые 5 мин. EASY™ прогноз орбит. Автономность ~5 дней на 1000 мАч.',
    icon: '🔋',
    role: 'TRACKER',
    nodeInfoBroadcastSecs: 900,
    powerSaving: true,
    lsSecs: 300,
    minWakeSecs: 10,
    gpsMode: 'ENABLED',
    gpsUpdateInterval: 30,
    agpsEnabled: false,
    gpsAttemptTime: 90,
    positionPrecision: 32,  // Максимальная точность координат (~1м)
    positionFlags: 299,     // ALT+MSL+DOP+SAT+HEADING (дефолт 811 без SPEED — пеший режим)
    positionBroadcastSecs: 300,
    smartBroadcastEnabled: true,
    smartBroadcastMinDist: 50,
    smartBroadcastMinInterval: 300,
    fixedPosition: false,
    telemetryInterval: 900,
    region: 'EU_433',
    modemPreset: 'LONG_MODERATE',
    txPower: 0,
    hopLimit: 5,
    usePreamble: false,
    bluetoothEnabled: true,
    bluetoothFixedPin: '113566',
    screenOnSecs: 30,
    ledDisabled: true,
    rebroadcastMode: 'ALL',
    isBuiltIn: true,
  },
  {
    builtinId: 'base-station',
    name: 'Базовая станция',
    description:
      'ROUTER: всегда бодрствует, ретранслирует все пакеты. Подключена к ПК по USB, передаёт данные в дашборд через Python-мост. GPS не нужен (в помещении), внешнее питание.',
    icon: '🏗️',
    role: 'ROUTER',
    nodeInfoBroadcastSecs: 900,
    powerSaving: false,
    lsSecs: 0,
    minWakeSecs: 0,
    gpsMode: 'NOT_PRESENT',
    gpsUpdateInterval: 0,
    agpsEnabled: false,
    gpsAttemptTime: 0,
    positionPrecision: 0,   // Не передавать координаты
    positionFlags: 0,       // Не передавать (GPS не нужен в помещении)
    positionBroadcastSecs: 900,
    smartBroadcastEnabled: false,
    smartBroadcastMinDist: 0,
    smartBroadcastMinInterval: 0,
    fixedPosition: false,     // Базовая станция в помещении — координаты не нужны
    telemetryInterval: 300,
    region: 'EU_433',
    modemPreset: 'LONG_MODERATE',
    txPower: 0,
    hopLimit: 5,
    usePreamble: false,
    bluetoothEnabled: true,
    bluetoothFixedPin: '113566',
    screenOnSecs: 300,
    ledDisabled: false,
    rebroadcastMode: 'ALL',
    isBuiltIn: true,
  },
  {
    builtinId: 'client-default',
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
    agpsEnabled: true,
    gpsAttemptTime: 30,
    positionPrecision: 32,  // Максимальная точность координат (~1м)
    positionFlags: 299,     // ALT+MSL+DOP+SAT+HEADING (дефолт 811 без SPEED — пеший режим)
    positionBroadcastSecs: 300,
    smartBroadcastEnabled: true,
    smartBroadcastMinDist: 100,
    smartBroadcastMinInterval: 300,
    fixedPosition: false,
    telemetryInterval: 300,
    region: 'EU_433',
    modemPreset: 'LONG_FAST',
    txPower: 0,
    hopLimit: 3,
    usePreamble: false,
    bluetoothEnabled: true,
    bluetoothFixedPin: '113566',
    screenOnSecs: 60,
    ledDisabled: false,
    rebroadcastMode: 'ALL',
    isBuiltIn: true,
  },
]
