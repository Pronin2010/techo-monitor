/**
 * Профили устройств для пресетов Meshtastic
 *
 * Каждый профиль описывает:
 * - Аппаратную платформу (CPU, дисплей, GPS, батарея)
 * - Инструкции по прошивке (flash firmware)
 * - Инструкции по импорту настроек (через meshtastic --configure)
 * - Специфичные YAML-переопределения для данного устройства
 * - Ограничения и особенности
 * - Параметры по умолчанию, отличающиеся от стандартных
 *
 * Метод конфигурации: ИМПОРТ НАСТРОЕК через YAML
 * - Экспорт: python -m meshtastic --export-config > config.yaml
 * - Импорт: python -m meshtastic --configure config.yaml
 * - Формат: YAML (snake_case или camelCase ключи)
 * - Источник: https://meshtastic.org/docs/software/python/cli
 * - Пример: https://github.com/meshtastic/python/blob/master/example_config.yaml
 *
 * Источники:
 * - Heltec Low Power: https://docs.heltec.org/en/node/esp32/wireless_tracker/meshtastic_tracker.html
 * - Heltec FAQ: https://docs.heltec.org/zh_CN/node/esp32/wireless_tracker/frequently_asked_questions.html
 * - Meshtastic flash: https://meshtastic.org/docs/getting-started/flashing-firmware/esp32/
 * - Meshtastic device config: https://meshtastic.org/docs/configuration/radio/device
 * - Meshtastic power config: https://meshtastic.org/docs/configuration/radio/power
 * - UC6580 GPS bug #5088: https://github.com/meshtastic/firmware/issues/5088
 * - UC6580 config bug #10202: https://github.com/meshtastic/firmware/issues/10202
 */

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

/** Шаг импорта настроек */
export interface ImportStep {
  /** Номер шага */
  step: number
  /** Описание шага */
  description: string
  /** Команда для выполнения */
  command?: string
  /** Важное примечание */
  note?: string
}

/** Специфичное YAML-добавление для устройства (то, что не покрывается пресетом) */
export interface DeviceYamlExtra {
  /** YAML-секция (например 'position', 'power', 'device') */
  section: 'config' | 'module_config'
  /** Подсекция (например 'position', 'power', 'device') */
  subsection: string
  /** Ключ настройки (snake_case) */
  key: string
  /** Значение */
  value: string | number | boolean
  /** Описание (для подсказки в UI) */
  description: string
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
  /** Инструкции по прошивке Meshtastic (firmware flash) */
  flashInstructions: FlashInstruction[]
  /** Инструкции по импорту настроек через YAML */
  importInstructions: ImportStep[]
  /** Специфичные YAML-добавления (устройство-зависимые настройки, не входящие в пресет) */
  yamlExtras: DeviceYamlExtra[]
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
    powerSaving: boolean
    lsSecs: number
    minWakeSecs: number
    positionBroadcastSecs: number
    smartBroadcastMinDist: number
    smartBroadcastMinInterval: number
    waitBluetoothSecs: number
    role: string
  }>
  /** Рекомендуемый конфиг от производителя (Heltec docs и т.д.) — для справки */
  vendorRecommendedConfig?: string
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
    importInstructions: [
      {
        step: 1,
        description: 'Подключить T-Echo к компьютеру через USB-C',
        note: 'Устройство появится как /dev/ttyACM0 (Linux) или COM порт (Windows)',
      },
      {
        step: 2,
        description: 'Установить Meshtastic Python CLI (если не установлен):',
        command: 'pip install meshtastic',
      },
      {
        step: 3,
        description: 'Сохранить сгенерированный YAML-файл на диск (кнопка «Скачать .yaml»)',
      },
      {
        step: 4,
        description: 'Применить конфигурацию командой:',
        command: 'python -m meshtastic --configure config.yaml',
        note: 'Устройство автоматически перезагрузится с новыми настройками',
      },
      {
        step: 5,
        description: 'Проверить применение настроек:',
        command: 'python -m meshtastic --info',
        note: 'Убедитесь что role, region и GPS настройки применились корректно',
      },
    ],
    yamlExtras: [
      {
        section: 'config',
        subsection: 'position',
        key: 'gps_attempt_time',
        value: 90,
        description: 'T-Echo: таймаут GPS-фикса (L76K в лесу — 90 сек, дефолт 30)',
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
    ],
    importInstructions: [
      {
        step: 1,
        description: 'Подключить Heltec Tracker к компьютеру через USB-C',
        note: 'Устройство появится как /dev/ttyACM0 (Linux) или COM порт (Windows)',
      },
      {
        step: 2,
        description: 'Установить Meshtastic Python CLI (если не установлен):',
        command: 'pip install meshtastic',
      },
      {
        step: 3,
        description: 'Сохранить сгенерированный YAML-файл на диск (кнопка «Скачать .yaml»)',
        note: 'YAML-файл содержит все настройки TRACKER + энергосбережение по рекомендациям Heltec',
      },
      {
        step: 4,
        description: 'Применить конфигурацию командой:',
        command: 'python -m meshtastic --configure config.yaml',
        note: 'Устройство автоматически перезагрузится с новыми настройками. TRACKER роль + power_saving = сон между вещаниями позиции (~13 мкА)',
      },
      {
        step: 5,
        description: 'Проверить применение настроек:',
        command: 'python -m meshtastic --info',
        note: 'Убедитесь что role=TRACKER, region=EU_433 и GPS настройки применились',
      },
      {
        step: 6,
        description: '(Опционально) Экспортировать конфиг для бэкапа:',
        command: 'python -m meshtastic --export-config > backup.yaml',
        note: 'Полезно для сохранения рабочей конфигурации перед экспериментами',
      },
    ],
    yamlExtras: [
      {
        section: 'config',
        subsection: 'position',
        key: 'gps_attempt_time',
        value: 90,
        description: 'Heltec Tracker: таймаут GPS-фикса (UC6580 в лесу — 90 сек, дефолт 30)',
      },
      {
        section: 'config',
        subsection: 'position',
        key: 'rx_gpio',
        value: 33,
        description: 'Heltec Tracker V1.1: UART RX пин для UC6580 GNSS',
        note: 'V1.1: GPIO3 управляет питанием GNSS, GPIO33 = RX, GPIO34 = TX',
      },
      {
        section: 'config',
        subsection: 'position',
        key: 'tx_gpio',
        value: 34,
        description: 'Heltec Tracker V1.1: UART TX пин для UC6580 GNSS',
      },
      {
        section: 'config',
        subsection: 'position',
        key: 'position_broadcast_smart_enabled',
        value: true,
        description: 'Heltec Tracker: умное вещание — отправлять позицию только при перемещении',
      },
      {
        section: 'config',
        subsection: 'position',
        key: 'broadcast_smart_minimum_distance',
        value: 10,
        description: 'Heltec Tracker: минимальное расстояние для вещания (10 м — рекомендация Heltec)',
      },
      {
        section: 'config',
        subsection: 'position',
        key: 'broadcast_smart_minimum_interval_secs',
        value: 900,
        description: 'Heltec Tracker: минимальный интервал умного вещания (900 сек — рекомендация Heltec)',
      },
      {
        section: 'config',
        subsection: 'power',
        key: 'wait_bluetooth_secs',
        value: 0,
        description: 'Heltec Tracker: не ждать Bluetooth при старте (экономия батареи, рекомендация Heltec)',
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
      role: 'TRACKER',
      gpsUpdateInterval: 30,
      gpsAttemptTime: 90,
      screenOnSecs: 30,     // LCD жрёт батарею — уменьшаем таймаут, но НЕ 0! (bug #5088)
      ledDisabled: false,   // LED полезен как индикатор (LCD маленький)
      powerSaving: true,    // TRACKER + power_saving = сон между вещаниями
      lsSecs: 900,          // Light sleep 15 мин — рекомендация Heltec
      minWakeSecs: 30,      // Минимум 30 сек для GPS фикса — рекомендация Heltec
      positionBroadcastSecs: 900,  // 15 мин — рекомендация Heltec
      smartBroadcastMinDist: 10,   // 10 м — рекомендация Heltec
      smartBroadcastMinInterval: 900,  // 15 мин — рекомендация Heltec
      waitBluetoothSecs: 0, // Не ждать BT — рекомендация Heltec
    },
    vendorRecommendedConfig: `# Рекомендуемый конфиг Heltec Wireless Tracker V1.1
# Источник: https://docs.heltec.org/en/node/esp32/wireless_tracker/meshtastic_tracker.html
# Результат: 13 мкА в режиме сна (с внешним Li-Po)
config:
  device:
    role: TRACKER
  position:
    position_broadcast_secs: 900
    broadcast_smart_minimum_distance: 10
    broadcast_smart_minimum_interval_secs: 900
    gps_update_interval: 30
    rx_gpio: 33
    tx_gpio: 34
  power:
    is_power_saving: true
    wait_bluetooth_secs: 0
    ls_secs: 900
    min_wake_secs: 30
  display:
    screen_on_secs: 30`,
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
