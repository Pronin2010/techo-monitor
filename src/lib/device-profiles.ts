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
    id: 't-beam-supreme',
    name: 'T-Beam Supreme (LilyGO)',
    shortName: 'T-Beam S',
    icon: '🛰️',
    description:
      'ESP32-S3 + SX1262, OLED 0.96", L76K GPS, 18650 батарея. Популярный трекер с OLED-дисплеем.',
    hardware: {
      cpu: 'ESP32-S3 (Xtensa LX7, 240 МГц, 512 КБ SRAM, 8 МБ Flash)',
      display: '0.96" OLED 128×64 (SSD1306)',
      gps: 'L76K (Quectel, EASY™ прогноз орбит)',
      battery: '18650 Li-Ion (съёмная, ~2500 мАч)',
      lora: 'SX1262 (433 МГц, до +22 дБм)',
      bluetooth: 'BLE (ESP32-S3 встроен)',
    },
    preCommands: [
      {
        command: '# T-Beam Supreme: специальная подготовка не требуется',
        description: 'T-Beam Supreme работает с meshtastic Python из коробки',
        phase: 'before',
        optional: true,
      },
    ],
    postCommands: [
      {
        command: 'python -m meshtastic --set position.gps_update_interval ${gpsUpdateInterval}',
        description: 'T-Beam S: интервал обновления GPS (L76K — минимум 30 сек)',
        phase: 'after',
      },
    ],
    warnings: [
      '⚠️ ESP32-S3 потребляет больше энергии, чем nRF52840 — автономность ниже',
      '⚠️ L76K аналогичен T-Echo — те же ограничения по интервалу GPS',
      '⚠️ OLED дисплей потребляет ~20 мА (e-ink T-Echo ≈ 0 мА)',
    ],
    defaultsOverride: {
      gpsUpdateInterval: 30,
      gpsAttemptTime: 90,
      screenOnSecs: 30,  // OLED — жрёт батарею, уменьшаем таймаут
      ledDisabled: false, // На T-Beam LED полезен (нет e-ink экрана)
    },
  },
  {
    id: 't-lora-v2-1',
    name: 'T-LoRa V2.1 (LilyGO)',
    shortName: 'T-LoRa',
    icon: '📡',
    description:
      'ESP32 + SX1276, без дисплея, без GPS, USB-C. Минимальная плата — ретранслятор или базовая станция.',
    hardware: {
      cpu: 'ESP32 (Xtensa LX6, 240 МГц, 520 КБ SRAM, 4 МБ Flash)',
      display: 'Нет (можно подключить OLED externally)',
      gps: 'Нет (можно подключить externally)',
      battery: 'Нет встроенной (питание через USB-C)',
      lora: 'SX1276 (433 МГц, до +20 дБм)',
      bluetooth: 'BLE (ESP32 встроен)',
    },
    preCommands: [
      {
        command: '# T-LoRa V2.1: нет GPS, нет дисплея',
        description: 'Устройство без GPS и дисплея — настраиваем соответствующие параметры',
        phase: 'before',
      },
    ],
    postCommands: [
      {
        command: 'python -m meshtastic --set position.gps_mode NOT_PRESENT',
        description: 'T-LoRa V2.1: нет встроенного GPS → NOT_PRESENT',
        phase: 'after',
      },
      {
        command: 'python -m meshtastic --set display.screen_on_secs 0',
        description: 'T-LoRa V2.1: нет дисплея → экран выключен',
        phase: 'after',
      },
    ],
    warnings: [
      '⚠️ Нет встроенного GPS — позиция не будет обновляться',
      '⚠️ Нет дисплея — настройки экрана игнорируются',
      '⚠️ Нет батареи — только USB питание, power saving не имеет смысла',
      '⚠️ SX1276 (вместо SX1262) — другой чип, другие пресеты модема',
    ],
    defaultsOverride: {
      gpsMode: 'NOT_PRESENT',
      gpsUpdateInterval: 0,
      gpsAttemptTime: 0,
      screenOnSecs: 0,
      ledDisabled: false, // LED — единственный индикатор на плате
    },
  },
  {
    id: 'heltec-v3',
    name: 'Heltec V3',
    shortName: 'Heltec V3',
    icon: '📟',
    description:
      'ESP32-S3 + SX1262, OLED 0.49", без GPS, USB-C. Компактная плата с мини-дисплеем.',
    hardware: {
      cpu: 'ESP32-S3 (Xtensa LX7, 240 МГц, 512 КБ SRAM, 8 МБ Flash)',
      display: '0.49" OLED 64×32 (SSD1306, mini)',
      gps: 'Нет (можно подключить externally)',
      battery: 'Нет встроенной (питание через USB-C)',
      lora: 'SX1262 (433 МГц, до +22 дБм)',
      bluetooth: 'BLE (ESP32-S3 встроен)',
    },
    preCommands: [
      {
        command: '# Heltec V3: нет встроенного GPS',
        description: 'Устройство без GPS — позиция не обновляется автоматически',
        phase: 'before',
      },
    ],
    postCommands: [
      {
        command: 'python -m meshtastic --set position.gps_mode NOT_PRESENT',
        description: 'Heltec V3: нет встроенного GPS → NOT_PRESENT',
        phase: 'after',
      },
    ],
    warnings: [
      '⚠️ Нет встроенного GPS — позиция не будет обновляться',
      '⚠️ Мини-OLED 0.49" — очень маленький, мало информации',
      '⚠️ Нет батареи — только USB питание',
    ],
    defaultsOverride: {
      gpsMode: 'NOT_PRESENT',
      gpsUpdateInterval: 0,
      gpsAttemptTime: 0,
      screenOnSecs: 30,
      ledDisabled: false,
    },
  },
  {
    id: 'rak-wisblock',
    name: 'RAK WisBlock (RAK4631)',
    shortName: 'RAK',
    icon: '🧩',
    description:
      'nRF52840 + SX1262, модульная система. GPS-модуль RAK1910 опционально. Рекомендуется для custom-сборок.',
    hardware: {
      cpu: 'nRF52840 (ARM Cortex-M4, 64 МГц, 256 КБ RAM, 1 МБ Flash)',
      display: 'Нет (можно подключить OLED/epaper через I2C)',
      gps: 'Опционально RAK1910 (u-blox MAX-7Q)',
      battery: 'Li-Po через Solar/WisBlock connector (до 4200 мАч)',
      lora: 'SX1262 (433 МГц, до +22 дБм)',
      bluetooth: 'BLE 5.0 (nRF52840 встроен)',
    },
    preCommands: [
      {
        command: '# RAK WisBlock: конфигурация зависит от установленных модулей',
        description: 'Модульная система — настройка зависит от комплекта',
        phase: 'before',
      },
    ],
    postCommands: [
      {
        command: '# Если установлен GPS-модуль RAK1910:',
        description: 'RAK1910 поддерживает EASY™ прогноз орбит, аналогично L76K',
        phase: 'after',
        optional: true,
      },
    ],
    warnings: [
      '⚠️ GPS опционален — проверьте установлен ли RAK1910 перед настройкой',
      '⚠️ Нет встроенного дисплея — настройки экрана могут не применяться',
      '⚠️ Модульная система — набор команд зависит от установленных модулей',
    ],
    defaultsOverride: {
      gpsUpdateInterval: 30,
      gpsAttemptTime: 90,
    },
  },
  {
    id: 'meshtastic-diy',
    name: 'DIY / Другое',
    shortName: 'DIY',
    icon: '🔧',
    description:
      'Кастомная сборка или другое устройство Meshtastic. Стандартные настройки без специфики.',
    hardware: {
      cpu: 'Зависит от сборки',
      display: 'Зависит от сборки',
      gps: 'Зависит от сборки',
      battery: 'Зависит от сборки',
      lora: 'Зависит от сборки (433 МГц)',
      bluetooth: 'Зависит от сборки',
    },
    preCommands: [],
    postCommands: [],
    warnings: [
      '⚠️ Универсальный профиль — проверьте совместимость настроек с вашим устройством',
    ],
    defaultsOverride: {},
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
  if (lower.includes('t-beam') && lower.includes('supreme')) return DEVICE_PROFILES[1]
  if (lower.includes('t-lora') || lower.includes('tlora')) return DEVICE_PROFILES[2]
  if (lower.includes('heltec') && lower.includes('v3')) return DEVICE_PROFILES[3]
  if (lower.includes('rak') || lower.includes('wisblock')) return DEVICE_PROFILES[4]

  return DEVICE_PROFILES[5] // DIY
}

/** Получить все ID профилей */
export function getDeviceProfileIds(): string[] {
  return DEVICE_PROFILES.map(p => p.id)
}
