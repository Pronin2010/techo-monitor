/**
 * Профили устройств для пресетов Meshtastic
 *
 * Каждый профиль описывает:
 * - Аппаратную платформу (CPU, дисплей, GPS, батарея)
 * - Специфичные команды прошивки (до/после основного конфига)
 * - Ограничения и особенности
 * - Параметры по умолчанию, отличающиеся от стандартных
 */

/** Команда прошивки устройства */
export interface DeviceCommand {
  /** Текст команды (python -m meshtastic ...) */
  command: string
  /** Описание команды */
  description: string
  /** Когда выполнять: 'before' = до основного конфига, 'after' = после */
  phase: 'before' | 'after'
  /** Опциональная? Команда может быть пропущена */
  optional?: boolean
}

/** Профиль устройства */
export interface DeviceProfile {
  /** Уникальный идентификатор */
  id: string
  /** Название устройства */
  name: string
  /** Короткое название */
  shortName: string
  /** Emoji-иконка */
  icon: string
  /** Описание платформы */
  description: string
  /** Аппаратные характеристики */
  hardware: {
    cpu: string
    display: string
    gps: string
    battery: string
    lora: string
    bluetooth: string
  }
  /** Специфичные команды прошивки (до основного конфига) */
  preCommands: DeviceCommand[]
  /** Специфичные команды прошивки (после основного конфига) */
  postCommands: DeviceCommand[]
  /** Ограничения (для отображения пользователю) */
  warnings: string[]
  /** Переопределения дефолтных значений пресета для данного устройства */
  defaultsOverride: Partial<{
    gpsMode: string
    gpsUpdateInterval: number
    gpsAttemptTime: number
    screenOnSecs: number
    ledDisabled: boolean
    bluetoothEnabled: boolean
    bluetoothFixedPin: string
    positionFlags: number
  }>
}

// ============================================================================
// Профили устройств
// ============================================================================

export const DEVICE_PROFILES: DeviceProfile[] = [
  {
    id: 't-echo',
    name: 'T-Echo (LilyGO)',
    shortName: 'T-Echo',
    icon: '📻',
    description:
      'nRF52840 + SX1262, e-ink 1.54" дисплей, L76K GPS, 850 мАч. Рабочий вариант — протестирован с Meshtastic 2.7.15.',
    hardware: {
      cpu: 'nRF52840 (ARM Cortex-M4, 64 МГц, 256 КБ RAM, 1 МБ Flash)',
      display: '1.54" e-ink (200×200, GDEW0154M09)',
      gps: 'L76K (Quectel, EASY™ прогноз орбит, 72 канала)',
      battery: '850 мАч Li-Po (встроенная), USB-C зарядка',
      lora: 'SX1262 (433 МГц, до +22 дБм)',
      bluetooth: 'BLE 5.0 (nRF52840 встроен)',
    },
    preCommands: [
      {
        command: '# T-Echo: специальная подготовка не требуется',
        description: 'T-Echo работает с meshtastic Python из коробки',
        phase: 'before',
        optional: true,
      },
    ],
    postCommands: [
      {
        command: 'python -m meshtastic --set position.gps_update_interval ${gpsUpdateInterval}',
        description: 'T-Echo: интервал обновления GPS (L76K — минимум 30 сек, дефолт 120)',
        phase: 'after',
      },
      {
        command: 'python -m meshtastic --set position.gps_attempt_time ${gpsAttemptTime}',
        description: 'T-Echo: таймаут GPS-фикса (L76K в лесу — 90 сек, дефолт 30)',
        phase: 'after',
      },
    ],
    warnings: [
      '⚠️ GPS дрейф: если координаты скачут при стационарной позиции — аппаратный дефект (LilyGO #32)',
      '⚠️ L76K не успевает дать качественный фикс при gps_update_interval < 30 сек',
      '⚠️ Фиксированный PIN Bluetooth 113566 — стандарт для T-Echo',
    ],
    defaultsOverride: {
      gpsUpdateInterval: 30,
      gpsAttemptTime: 90,
      bluetoothFixedPin: '113566',
    },
  },
  {
    id: 'heltec-wireless-tracker',
    name: 'Heltec Wireless Tracker V1.1',
    shortName: 'Heltec Tracker',
    icon: '📡',
    description:
      'ESP32-S3FN8 + SX1262 + UC6580 GNSS, LCD 0.96", USB-C питание. Компактный трекер с GNSS — дешёвая альтернатива T-Echo.',
    hardware: {
      cpu: 'ESP32-S3FN8 (Xtensa LX7, 240 МГц, 512 КБ SRAM, 8 МБ Flash)',
      display: '0.96" LCD 160×80 (ST7735)',
      gps: 'UC6580 (Unicore, двухчастотный GNSS: GPS/BDS/GLONASS/Galileo, 22 нм)',
      battery: 'Нет встроенной (питание через USB-C, можно подключить Li-Po)',
      lora: 'SX1262 (433 МГц, до +21 дБм)',
      bluetooth: 'BLE 5.0 (ESP32-S3 встроен)',
    },
    preCommands: [
      {
        command: '# Heltec Wireless Tracker: UC6580 GNSS подготовка',
        description: 'Heltec Tracker: UC6580 GNSS — проверить, что модуль определяется',
        phase: 'before',
        optional: true,
      },
    ],
    postCommands: [
      {
        command: 'python -m meshtastic --set position.gps_update_interval ${gpsUpdateInterval}',
        description: 'Heltec Tracker: интервал обновления GPS (UC6580 — минимум 30 сек, дефолт 120)',
        phase: 'after',
      },
      {
        command: 'python -m meshtastic --set position.gps_attempt_time ${gpsAttemptTime}',
        description: 'Heltec Tracker: таймаут GPS-фикса (UC6580 в лесу — 90 сек, дефолт 30)',
        phase: 'after',
      },
      {
        command: 'python -m meshtastic --set display.screen_on_secs ${screenOnSecs}',
        description: 'Heltec Tracker: таймаут экрана — LCD жрёт батарею, уменьшаем',
        phase: 'after',
      },
    ],
    warnings: [
      '⚠️ UC6580 GPS: известный баг — при выключенном экране модуль периодически сбрасывается (firmware #5088)',
      '⚠️ UC6580: дефолтная конфигурация Meshtastic ухудшает GNSS-производительность (firmware #10202)',
      '⚠️ Нет встроенной батареи — только USB-C питание (или внешний Li-Po)',
      '⚠️ LCD 0.96" потребляет ~20 мА (e-ink T-Echo ≈ 0 мА) — автономность ниже',
      '⚠️ ESP32-S3 потребляет больше энергии, чем nRF52840 — автономность ниже T-Echo',
    ],
    defaultsOverride: {
      gpsUpdateInterval: 30,
      gpsAttemptTime: 90,
      screenOnSecs: 30,     // LCD жрёт батарею — уменьшаем таймаут
      ledDisabled: false,   // LED полезен как индикатор (LCD маленький)
    },
  },
]

// ============================================================================
// Хелперы
// ============================================================================

/** Найти профиль по ID */
export function getDeviceProfile(id: string): DeviceProfile | undefined {
  return DEVICE_PROFILES.find(p => p.id === id)
}

/** Найти профиль по имени hardwareModel из MeshNode */
export function getDeviceProfileByHardware(hardwareModel: string): DeviceProfile {
  const lower = hardwareModel.toLowerCase()

  if (lower.includes('t-echo') || lower.includes('techo')) return DEVICE_PROFILES[0]
  if (lower.includes('heltec') && (lower.includes('tracker') || lower.includes('wireless-tracker'))) return DEVICE_PROFILES[1]

  // По умолчанию — T-Echo (первый профиль)
  return DEVICE_PROFILES[0]
}

/** Получить все ID профилей */
export function getDeviceProfileIds(): string[] {
  return DEVICE_PROFILES.map(p => p.id)
}
