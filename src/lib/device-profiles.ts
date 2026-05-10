/**
 * Профили устройств для пресетов Meshtastic
 *
 * Каждый профиль описывает:
 * - Аппаратную платформу (CPU, дисплей, GPS, батарея)
 * - Специфичные команды прошивки (до/после основного конфига)
 * - Инструкции по прошивке (flash)
 * - Ограничения и особенности
 * - Параметры по умолчанию, отличающиеся от стандартных
 *
 * Источники:
 * - Heltec FAQ: https://docs.heltec.org/zh_CN/node/esp32/wireless_tracker/frequently_asked_questions.html
 * - Meshtastic flash: https://meshtastic.org/docs/getting-started/flashing-firmware/esp32/
 * - Meshtastic device config: https://meshtastic.org/docs/configuration/radio/device
 * - Meshtastic power config: https://meshtastic.org/docs/configuration/radio/power
 * - UC6580 GPS bug #5088: https://github.com/meshtastic/firmware/issues/5088
 * - UC6580 config bug #10202: https://github.com/meshtastic/firmware/issues/10202
 */

/** Команда прошивки устройства */
export interface DeviceCommand {
  /** Текст команды (python -m meshtastic ... или shell) */
  command: string
  /** Описание команды */
  description: string
  /** Когда выполнять: 'before' = до основного конфига, 'after' = после */
  phase: 'before' | 'after'
  /** Опциональная? Команда может быть пропущена */
  optional?: boolean
}

/** Инструкция по прошивке устройства */
export interface FlashInstruction {
  /** Шаг (1, 2, 3...) */
  step: number
  /** Описание шага */
  description: string
  /** Команда для выполнения (если есть) */
  command?: string
  /** Важное примечание */
  note?: string
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
  /** Инструкции по прошивке Meshtastic */
  flashInstructions: FlashInstruction[]
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
    flashInstructions: [
      {
        step: 1,
        description: 'Подключить T-Echo к компьютеру через USB-C кабель (data-кабель, не только зарядка!)',
      },
      {
        step: 2,
        description: 'Открыть Web Flasher: https://flasher.meshtastic.org',
        note: 'Выбрать устройство "T-Echo" и версию прошивки 2.7.15',
      },
      {
        step: 3,
        description: 'Нажать "Flash" и дождаться завершения',
        note: 'T-Echo автоматически входит в boot mode при подключении',
      },
      {
        step: 4,
        description: 'Дождаться перезагрузки и проверить: LED мигает, экран показывает "Meshtastic"',
      },
    ],
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
      'ESP32-S3FN8 + SX1262 + UC6580 GNSS, LCD 0.96", USB-C. Компактный трекер — дешёвая альтернатива T-Echo. Версия V1.1: питание GNSS через GPIO3.',
    hardware: {
      cpu: 'ESP32-S3FN8 (Xtensa LX7, 240 МГц, 512 КБ SRAM, 8 МБ Flash)',
      display: '0.96" LCD 160×80 (ST7735)',
      gps: 'UC6580 (Unicore, двухчастотный GNSS L1+L5/L2: GPS/BDS/GLONASS/Galileo, 22 нм)',
      battery: 'Нет встроенной (питание через USB-C, можно подключить Li-Po к VEXT)',
      lora: 'SX1262 (433 МГц, до +21 дБм)',
      bluetooth: 'BLE 5.0 (ESP32-S3 встроен)',
    },
    flashInstructions: [
      {
        step: 1,
        description: 'Подключить Heltec Tracker к компьютеру через USB-C DATA-кабель (не только зарядка!)',
        note: 'Устройство появится как /dev/ttyACM0 (Linux) или COM порт (Windows)',
      },
      {
        step: 2,
        description: 'Войти в boot mode: удерживать кнопку USER → нажать RESET → отпустить RESET → отпустить USER',
        note: '⚠️ V1.1 использует внутренний USB ESP32-S3 (не USB-UART мост). В низкопотреблении устройство может не входить в boot автоматически — нужно вручную через USER+RESET!',
      },
      {
        step: 3,
        description: 'Способ A — Web Flasher (рекомендуется):',
        command: '# Открыть https://flasher.meshtastic.org\n# Выбрать "Heltec Wireless Tracker"\n# Версия прошивки: 2.7.15 (или новее)\n# Нажать "Flash"',
        note: '⚠️ Если Web Flasher не видит устройство — убедитесь что вошли в boot mode (шаг 2)',
      },
      {
        step: 4,
        description: 'Способ B — CLI (esptool / device-install.sh):',
        command: '# Скачать прошивку:\nwget https://github.com/meshtastic/firmware/releases/download/v2.7.15.firmware/firmware-esp32s3-2.7.15.firmware.zip\nunzip firmware-esp32s3-2.7.15.firmware.zip\ncd firmware-esp32s3-2.7.15.firmware/\n\n# Прошить (Linux/Mac):\n./device-install.sh -f firmware-heltec-wireless-tracker-2.7.15.firmware.bin\n\n# Или через esptool напрямую:\nesptool.py --port /dev/ttyACM0 write_flash 0x0 firmware-heltec-wireless-tracker-2.7.15.firmware.bin',
        note: '⚠️ Если не прошивается — войдите в boot mode вручную (шаг 2) и повторите',
      },
      {
        step: 5,
        description: 'Дождаться перезагрузки. На LCD экране появится "Meshtastic"',
        note: 'Если экран пустой — проверьте что прошили правильную версию (heltec-wireless-tracker, не heltec-v3!)',
      },
      {
        step: 6,
        description: 'Подключиться через Python CLI и проверить связь:',
        command: 'python -m meshtastic --info',
        note: 'Если устройство не видно — проверьте: ls /dev/ttyACM* (Linux) или Device Manager (Windows)',
      },
    ],
    preCommands: [
      {
        command: '# Heltec Wireless Tracker V1.1: проверка связи',
        description: 'Убедиться что устройство отвечает на команды: python -m meshtastic --info',
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
        description: 'Heltec Tracker: таймаут экрана — LCD жрёт батарею, уменьшаем. ⚠️ НЕ ставьте 0! При screen_on_secs=0 экран выключается и UC6580 периодически сбрасывается (bug #5088)',
        phase: 'after',
      },
      {
        command: 'python -m meshtastic --set power.is_power_saving true',
        description: 'Heltec Tracker: включить экономию энергии (TRACKER роль — сон между вещаниями позиции)',
        phase: 'after',
      },
      {
        command: 'python -m meshtastic --set power.ls_secs ${lsSecs}',
        description: 'Heltec Tracker: время сна (сек) — трекер спит между GPS-обновлениями, экономит батарею',
        phase: 'after',
      },
      {
        command: 'python -m meshtastic --set power.min_wake_secs ${minWakeSecs}',
        description: 'Heltec Tracker: минимальное время бодрствования (10 сек — хватит на GPS фикс + отправку)',
        phase: 'after',
      },
    ],
    warnings: [
      '⚠️ UC6580 GPS баг #5088: при выключенном экране (screen_on_secs=0) VEXT циклически переключается → UC6580 сбрасывается и перестаёт давать NMEA. РЕШЕНИЕ: НЕ выключайте экран полностью! Ставьте screen_on_secs ≥ 30 сек',
      '⚠️ UC6580 баг #10202: дефолтная конфигурация Meshtastic ухудшает GNSS-производительность UC6580 (переконфигурирует модуль при старте). Ожидайте фикса в будущих версиях прошивки',
      '⚠️ V1.1 специфично: питание GNSS чипа управляется через GPIO3 (в V1.0 был другой пин). Прошивка Meshtastic ≥ 2.2.17 автоматически распознаёт версию. Старые прошивки могут не работать!',
      '⚠️ Boot mode: ESP32-S3 использует внутренний USB. Для прошивки: удержать USER → нажать RESET → отпустить RESET → отпустить USER',
      '⚠️ Нет встроенной батареи — только USB-C питание. Для автономной работы нужен внешний Li-Po аккумулятор (подключается к контакту VEXT)',
      '⚠️ LCD 0.96" потребляет ~20 мА (e-ink T-Echo ≈ 0 мА) — автономность значительно ниже T-Echo при той же батарее',
      '⚠️ ESP32-S3 потребляет ~45-80 мА в активном режиме vs ~14 мА у nRF52840 (T-Echo). Сон ESP32-S3: ~10-20 мА (light sleep) vs ~2 мА у nRF52840',
      '⚠️ TRACKER роль + power_saving: устройство спит между вещаниями позиции. LoRa радио НЕ принимает пакеты во время сна! Трекер НЕ ретранслирует чужие пакеты',
    ],
    defaultsOverride: {
      gpsUpdateInterval: 30,
      gpsAttemptTime: 90,
      screenOnSecs: 30,     // LCD жрёт батарею — уменьшаем таймаут, но НЕ 0! (bug #5088)
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
