# AI Prompt — T-Echo Monitor

_Этот файл загружается в контекст AI-ассистента при начале работы над проектом.
Содержит всё необходимое для погружения в проект без чтения остальных файлов._

---

## 1. О проекте

**T-Echo Monitor** — веб-дашборд для мониторинга, настройки и управления Mesh-сетью 433 МГц
на T-Echo устройствах с прошивкой Meshtastic 2.7.15.

- GitHub: `https://github.com/Pronin2010/techo-monitor.git`
- Логин: `Pronin2010`, ветка: `main`
- Лицензия: MIT
- **Платформа: только десктоп** — проект используется исключительно на компьютере, мобильная адаптация не требуется
- **MQTT не используется** — подключение только через USB (serial), удалённый мониторинг через интернет не нужен

---

## 2. Технологический стек

- **Next.js 16** (App Router) + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** (New York style) + **Lucide** иконки
- **Prisma ORM** + **SQLite** (файл `db/custom.db`)
- **Leaflet** + **OpenStreetMap** — интерактивные карты
- **@tmcw/togeojson** + **fflate** — парсинг KMZ/KML overlay на карте
- **Python-мост** (`techo-bridge.py`) — связь с Meshtastic-устройствами

---

## 3. Структура проекта

```
src/
├── app/
│   ├── page.tsx                  # Главная — dynamic import дашборда (ssr: false)
│   ├── layout.tsx                # Root layout (lang="ru", Toaster)
│   ├── globals.css               # CSS-переменные, тёмная тема
│   └── api/
│       ├── nodes/                # REST API узлов (GET/POST, [id]/GET/PUT/DELETE)
│       ├── channels/             # REST API каналов (GET/POST/PUT/DELETE)
│       ├── presets/              # REST API пресетов (GET с upsert builtin/POST/PUT/DELETE)
│       ├── packets/              # REST API пакетов (in-memory ring buffer 200 шт)
│       ├── telemetry/            # REST API телеметрии
│       ├── sync-log/             # REST API логов синхронизации
│       └── meshtastic/           # sync, bridge, script, config, set-owner
├── components/
│   ├── dashboard/                # 11 компонентов дашборда (~8474 строк)
│   │   ├── dashboard-client.tsx  # Главный клиентский контейнер (7 вкладок, 451 строка)
│   │   ├── dashboard-page.tsx    # Обёртка (передаёт initialNodes=[])
│   │   ├── node-status-card.tsx  # Строка узла с аккордеоном (663 строки)
│   │   ├── node-form-dialog.tsx  # Диалог редактирования узла (268 строк)
│   │   ├── map-view.tsx          # Вкладка карты (dynamic import)
│   │   ├── map-leaflet.tsx       # Leaflet-карта + KMZ/KML overlay (718 строк)
│   │   ├── channel-settings.tsx  # Настройки каналов + QR (799 строк)
│   │   ├── connection-tab.tsx    # Подключение (Serial/MQTT, лог синхронизаций, 611 строк)
│   │   ├── device-setup-tab.tsx  # Генератор CLI-команд и YAML (1841 строка)
│   │   ├── settings-presets-tab.tsx # Пресеты + push-to-device (2653 строки ⚠️)
│   │   └── packet-stream-tab.tsx # Поток пакетов (444 строки)
│   └── ui/                       # shadcn/ui примитивы
├── hooks/                        # use-toast, use-mobile
├── lib/
│   ├── db.ts                     # Prisma Client (singleton, dev query logging)
│   ├── types.ts                  # TypeScript типы + константы Meshtastic (202 строки)
│   ├── utils.ts                  # cn() + serializeBigInt()
│   ├── kmz-parser.ts             # KMZ/KML → GeoJSON парсер (@tmcw/togeojson + fflate), GroundOverlay (ImageOverlay)
│   ├── device-profiles.ts        # 2 профиля устройств (T-Echo, Heltec Wireless Tracker V1.1)
│   └── builtin-presets.ts        # 4 встроенных пресета
prisma/
└── schema.prisma                 # 6 моделей: Node, Channel, Telemetry, ConnectionConfig, Preset, SyncLog
techo-bridge.py                   # Python-мост (Serial/MQTT → HTTP API :8420, 1866 строк)
techo-dump-config.py              # Скрипт чтения конфигурации устройства (standalone)
```

---

## 4. 7 вкладок дашборда

| Вкладка | Иконка | Описание |
|---------|--------|----------|
| **Статус** | Activity | Карточки узлов: батарея, SNR, RSSI, поиск, аккордеон-детали |
| **Карта** | Map | Leaflet + OSM, маркеры по ролям, линии связи, KMZ/KML overlay |
| **Каналы** | Settings | PSK 256 бит, модем-пресет, регион 433 МГц, QR-коды |
| **Подключение** | SVG (кабель) | Serial/MQTT выбор, команда запуска, лог синхронизаций |
| **Настройка** | Cpu | Генератор CLI-команд и YAML для meshtastic 2.7.15 |
| **Пресеты** | Cpu | Системные/пользовательские + профили устройств + push-to-device через мост |
| **Пакеты** | Zap | Потоковый мониторинг пакетов (in-memory buffer) |

---

## 5. Правила проекта

### Язык
- Общение на **русском**
- Комментарии в коде — на **русском**
- UI-текст — на **русском**
- Имена переменных, функций, файлов — на **английском**

### Git
- **ВСЕГДА спрашивать перед `git push`**
- После коммита: «Изменения закакоммичены. Запушить в GitHub?»
- Откат: `git reset --soft HEAD~1` / `git reset --hard HEAD~1` / `git revert <hash>`

### Код
- Не удалять существующую функциональность без подтверждения
- Использовать `serializeBigInt` из `@/lib/utils` для JSON (Prisma BigInt → String)
- DATABASE_URL = `"file:../db/custom.db"` (относительно prisma/)
- Whitelist-подход в PUT-роутах (только разрешённые поля)
- API-роуты — не server actions
- **Только десктоп** — мобильная адаптация не нужна, оптимизировать под большие экраны

### Файлы
- Генерируемые файлы → `/home/z/my-project/download/`
- Рабочий лог → `/home/z/my-project/worklog.md`
- Не сохранять файлы за пределами `/home/z/my-project/`

### Документация
- **ВСЕГДА актуализировать всю документацию** при любых изменениях
- Обновлять README.md, STARTUP.md, PROJECT_RULES.md, AI_PROMPT.md
- Документация должна отражать текущее состояние, а не историю

### Отладка
- При ошибках — сначала читать файлы, потом исправлять
- Проверять импорты перед добавлением новых функций
- Читать dev.log при ошибках рендера

---

## 6. Meshtastic: предметная область

### ⚠️ КРИТИЧЕСКОЕ ПРАВИЛО
**ВСЕГДА ИСКАТЬ ИНФОРМАЦИЮ В ДОКУМЕНТАЦИИ ПО ПРОШИВКЕ 2.7.15 ПЕРЕД НАПИСАНИЕМ ФУНКЦИЙ ОТНОСЯЩИХСЯ К УСТРОЙСТВАМ!!!**
- Перед написанием ЛЮБОГО кода для устройств → сначала проверить документацию прошивки
- Официальная документация: https://meshtastic.org/docs/
- Исходный код прошивки: https://github.com/meshtastic/firmware/tree/v2.7.15
- Нарушение = баг, который не будет работать на реальном устройстве

### Предметная область
- **Диапазон:** 433 МГц (LPD433, Россия/СНГ)
- **Прошивка:** 2.7.15
- **BASE** — приёмник, всегда бодрствует (ROUTER/CLIENT_BASE)
- **TR01, TR02** — трекеры: 10 сек бодрствование → 60 сек сон
- Пакеты от трекеров каждые ~70 секунд
- **Модем-пресет для леса:** LONG_MODERATE (рекомендуемый)
- **hop_limit:** 5–7 для леса (дефолт 3 — мало)
- PSK: 256 бит (32 байта)
- Регион: EU_433

### Роли устройств (12 штук)
| Роль | Спит | Ретранслирует | Примечание |
|------|------|---------------|------------|
| CLIENT | Нет | Да | Обычный узел |
| CLIENT_MUTE | Нет | Да | Не отвечает на пинги |
| CLIENT_HIDDEN | Нет | Да | Не виден в списке |
| ROUTER | Нет | Да | Ядро сети, приоритет |
| ROUTER_CLIENT | Нет | Да | ⚠️ Deprecated |
| TRACKER | Да | Нет | GPS-трекинг |
| REPEATER | Нет | Да | ⚠️ Deprecated |
| SENSOR | Да | Нет | Датчик |
| LOST_AND_FOUND | Нет | Да | Вещает GPS для поиска |
| TAK_TRACKER | Да | Нет | ATAK PLI |
| ROUTER_LATE | Нет | Да | Ретранслирует последним |
| CLIENT_BASE | Нет | Да | Мощный базовый узел |

### GPS Mode (замена gps_enabled)
- `ENABLED` / `DISABLED` / `NOT_PRESENT`

### Position Precision (точность координат)
- Настройка **КАНАЛА**, а не позиции! `ChannelSettings.ModuleSettings.position_precision`
- 0 = не передавать позицию на канале
- 1-31 = кол-во старших бит 32-битного lat/lon (остальные обнуляются + центрируются)
- **13 = дефолт прошивки (~2.9км радиус)** — проверено по Channels.cpp v2.7.15
- **32 = максимальная точность (~1-3м GPS)** — полная точность без обфускации
- CLI: `meshtastic --ch-index 0 --ch-set module_settings.position_precision 32`
- ⚠️ НЕ `--set position.position_precision` (устаревший/неверный путь!)

### Position Flags (состав данных позиции)
- Битовая маска `position.position_flags` (protobuf Config.PositionConfig)
- Определяет какие **дополнительные** поля включаются в позиционный пакет

| Флаг | Значение | Описание |
|------|----------|----------|
| ALTITUDE | 1 | Включить высоту |
| ALTITUDE_MSL | 2 | Высота MSL (иначе HAE — Height Above Ellipsoid) |
| GEOIDAL_SEPARATION | 4 | Геоидальное отделение |
| DOP | 8 | DOP (PDOP по умолчанию) |
| HVDOP | 16 | Раздельные HDOP/VDOP вместо PDOP (только с DOP) |
| SATINVIEW | 32 | Количество видимых спутников |
| SEQ_NO | 64 | Порядковый номер пакета |
| TIMESTAMP | 128 | Метка времени GPS-решения |
| HEADING | 256 | Направление движения (для транспорта!) |
| SPEED | 512 | Скорость движения (для транспорта!) |

- **Дефолт прошивки** (NodeDB.cpp): **811** = ALT+MSL+DOP+SAT+HEADING+SPEED (транспорт)
- **Пеший режим** (наш дефолт): **299** = ALT+MSL+DOP+SAT+HEADING (без SPEED — пеший)
- **Все флаги**: **1023**
- ⚠️ HEADING/SPEED — для транспорта, пешком данные ненадёжны

### Fixed Position (фиксированная позиция)
- `position.fixed_position` (protobuf Config.PositionConfig, поле 3)
- **true** = устройство использует последнюю известную позицию без обновления GPS
- Для стационарных устройств: базовая станция, трекер в лагере
- ⚠️ **Баг #8403**: GPS коллбек перезаписывает fixed_position → при fixedPosition=true мост ставит gps_mode=DISABLED
- CLI: `meshtastic --set position.fixed_position true`
- Задание координат: `--setlat XX.XXXX --setlon YY.YYYY --setalt ZZ`
- Python: `node.setFixedPosition(lat, lon, alt)` / `node.removeFixedPosition()`
- ⚠️ При position_precision < 32 координаты округляются и повреждяются (баг #7478)

### ⚠️ Дрейф GPS координат у стационарного трекера
**Причины (по вероятности)**:
1. **Аппаратный дефект T-Echo (LilyGO #32)** — проводящая сетка внутри замыкает GPS-антенну → GPS теряет спутники через 2-5 мин
2. **Баг #836** — T-Echo L76K GNSS периодически теряет фикс после нескольких минут
3. **Слишком частый GPS-опрос** (`gpsUpdateInterval` < 30 сек) — GPS не успевает дать качественный фикс
4. **Естественный шум GPS** ±3-10м, нет фильтрации в Meshtastic
5. **Smart broadcast** с малым мин. расстоянием (20м < дефолт 100м)
6. **position_precision < 32** обфусцирует координаты

**Решения**: Проверить аппаратный дефект (LilyGO #32), увеличить gpsUpdateInterval (≥30 сек), увеличить smartBroadcastMinDist (100м = дефолт прошивки), включить fixedPosition для стационарных, positionPrecision=32

**Сравнение с дефолтами прошивки**: gpsUpdateInterval дефолт=120сек (наш пресет 12ч имел 1сек ❌), smartBroadcastMinDist дефолт=100м (наш пресет 12ч имел 20м ❌)

**Известные баги**: #836 (T-Echo GPS теряет фикс), #8403 (GPS→fixed_position), #7478 (precision→округление), #8029 (GPS lock hold 20сек), #992 (знак координат инвертируется), #6785 (Smart Broadcast спорадическое вещание)

### Ключевые изменения 2.7.15
- Телеметрия отключена по умолчанию
- Прямые сообщения только через PKI
- Traffic Management включён по умолчанию
- `gps_enabled` → `position.gps_mode`
- `REPEATER`, `ROUTER_CLIENT` — устарели
- Новые пресеты: LITE_FAST/SLOW, NARROW_FAST/SLOW
- **session_passkey обязателен** для admin-команд (ensureSessionKey() перед транзакцией)
- **BT PairingMode enum**: RANDOM_PIN=0 (ДЕФОЛТ), FIXED_PIN=1, NO_PIN=2 (проверено по protobuf config.proto)

### Bluetooth PairingMode (protobuf config.proto)
| Значение | Константа | Описание |
|----------|-----------|----------|
| 0 | RANDOM_PIN | Случайный PIN (ДЕФОЛТ protobuf3) |
| 1 | FIXED_PIN | Фиксированный PIN (113566) |
| 2 | NO_PIN | Без PIN (открытый) |

### ⚠️ Известные проблемы nRF52840 (T-Echo) в 2.7.x
- **GitHub #9812**: FIXED_PIN может не работать на nRF52 (IO capability NoInputNoOutput → конфликт с MITM)
- **GitHub #7103**: Перезагрузка при BT-сопряжении на nRF52840
- T-Echo имеет экран, поэтому #9812 может не проявляться

---

## 7. Схема базы данных (6 моделей)

```
Node ──< Telemetry
  nodeId: BigInt @unique
  name, shortName, hardwareModel, role, status
  batteryLevel?, voltage?, usbPower, snr, rssi
  latitude?, longitude?, altitude?
  speed?, heading?, satsInView?, hdop?        # GPS-данные позиции
  pressure?, channelUtilization?, airUtilTx?   # Давление, сеть
  lsSecs?, minWakeSecs?, lastSeen
  lastInfoPacket?, lastTelemetryPacket?, lastPositionPacket?  # Время последних пакетов по типам
  usbPower                                    # Внешнее питание (usbPower || bat>=101 || V>=4.4)

Channel ──< ConnectionConfig
        ──< Preset
  index, name, psk, uplink, downlink
  modemPreset, region, frequency?, isDefault

Telemetry
  nodeId → Node, batteryLevel?, voltage?, snr, rssi
  temperature?, humidity?, pressure?           # Окружающая среда
  latitude?, longitude?, altitude?
  speed?, heading?, satsInView?, hdop?          # GPS-данные позиции
  channelUtilization?, airUtilTx?               # Сетевая статистика

ConnectionConfig
  type (serial/mqtt/disabled), serialPort, mqttBroker
  mqttTopic, mqttUsername, mqttPassword, channelId? → Channel
  isEnabled, lastSync?, status

Preset
  name, description?, icon, role, powerSaving, lsSecs, minWakeSecs
  gpsMode, gpsUpdateInterval, agpsEnabled, gpsAttemptTime
  positionPrecision(32), positionFlags(299), positionBroadcastSecs, smartBroadcast*
  fixedPosition(false), telemetryInterval, region, modemPreset, txPower, hopLimit
  ⚠️ usePreamble — зомби-поле: есть в БД, НЕ применяется мостом (не существует в LoRaConfig 2.7.15)
  bluetoothEnabled, bluetoothFixedPin?, screenOnSecs, ledDisabled
  rebroadcastMode, channelId? → Channel
  isBuiltIn, builtinId? @unique

SyncLog
  source, nodeId?, nodeName?, action, eventType?, details?
```

---

## 8. Python-мост (techo-bridge.py)

- Режим: `--mode serial` (MQTT не используется)
- HTTP API на порту **8420** (`--api-port`)
- **POST /api/apply-config** — применение конфигурации на устройство
  - Параметры: role, region, modemPreset, lsSecs, minWakeSecs, gpsMode, agpsEnabled, и т.д.
  - deviceName, deviceShortName — установка имени через setOwner()
    ⚠️ short_name ограничен 4 символами (nChars=4 в Python-библиотеке), НЕ 5!
    ⚠️ Пустая строка в setOwner() вызывает sys.exit() — мост падает! Пустые → None (пропуск).
    ⚠️ При factory reset имя сбрасывается на «Meshtastic XXXX» — если не указать новое, останется дефолтное
  - factoryReset — сброс до заводских перед применением (ensureSessionKey + factory_reset_config=1, баг библиотеки: True→TypeError)
  - Порядок (при factory_reset=True):
    1. **ШАГ 1**: Factory reset → 20 сек ожидание → _reconnect_interface()
    2. **ШАГ 2**: setOwner (новое имя) → reboot(secs=2) → 20 сек ожидание → _reconnect_interface()
    3. **ШАГ 3**: ensureSessionKey → beginTransaction → writeConfig × N → commit → reboot
  - Порядок (без factory_reset):
    1. setOwner (если указано имя, без перезагрузки)
    2. ensureSessionKey → beginTransaction → writeConfig × N → commit → reboot
  - При ошибке записи — перезагрузка для отката (вместо commit частичных данных)
  - При factory reset — автоматическое пересоздание SerialInterface с повторными попытками
  - После перезагрузки устройства (reboot) — мост автоматически переподключается для продолжения мониторинга
- **POST /api/set-owner** — установка имени устройства без применения пресета
  - Параметры: nodeId (hex `!a1b2c3d4` или пустая строка для BASE), deviceName, deviceShortName
  - Вызывает `setOwner()` на целевом узле (локальном или удалённом через mesh)
  - `ensureSessionKey()` вызывается перед `setOwner()` — обязательно для 2.7.x
  - Не требует перезагрузки устройства — имя обновляется сразу
  - Дашборд обновляет БД при успехе (через POST /api/meshtastic/set-owner)
  - Используется из диалога редактирования узла (опция «Установить на устройстве»)
- **GET /api/status** — статус моста и список узлов (nodeId в hex-формате `!a1b2c3d4`)
- **GET /api/device-config** — полная конфигурация устройства (все секции + каналы + владелец) для диагностики и сопоставления с пресетами
- Транзакционное применение: все настройки в одной транзакции
- Fallback: writeModuleConfig() для старых версий meshtastic-библиотеки

---

## 9. Текущее состояние (из worklog)

### Выполнено (40 задач):
1. Рефакторинг вкладки Статус — аккордеон-строки, поиск, упрощённый диалог
2. Визард подключения — 3 шага вместо 1162 строк
3. Фикс CLI-команд для meshtastic 2.7.8 (проверено по исходникам)
4. Журнал событий (удалён позже)
5. Фикс дублирования пресетов (upsert + unique constraint)
6. Удаление Журнала и демо-данных
7. Правило обновления документации
8. Код-ревью — 15 исправлений (mass assignment, dead code, -27 пакетов)
9. Push-to-device — отправка конфигурации через мост
10. Установка имени устройства при отправке
11. Опция factory reset в диалоге отправки
12. Полный код-ревью + создание AI_PROMPT.md + правило AI-контекста
13. Правило «только десктоп» в документации
14. Фикс 7 багов в push-to-device (критические: откат транзакции, positionPrecision, nodeId-формат)
15. Фикс factory reset: пересоздание SerialInterface при потере соединения
16. Фикс перезагрузки: мост автоматически переподключается после ЛЮБОЙ перезагрузки
17. Фикс 3 багов: stale closure (factoryReset не отправлялся), время ожидания перезагрузки 20с, сообщение об успехе
18. Фикс factory reset: ensureSessionKey() + factory_reset_config=1 (node.factoryReset() багует с True→TypeError)
19. Фикс применения конфига: задержки между writeConfig() + задержка перед reboot + диагностика после перезагрузки
20. Фикс ВСЕХ protobuf enum маппингов: ROLE_MAP (ROUTER=2 не 4), MODEM_PRESET_MAP (LONG_MODERATE=7 не 1), REGION_MAP (EU_433=2 не 3)
21. Скрипт techo-dump-config.py + GET /api/device-config — чтение и выгрузка конфигурации устройства
22. Фикс protobuf «does not have presence» — HasField() на скалярных полях (wifi_ssid), обёртка секций в try/except, добавлены MQTT/Serial модули
23. Правило: MQTT не используется — подключение только через USB (serial)
24. BT: фиксированный PIN 113566 во всех пресетах + режим FIXED_PIN (mode=1, НЕ 0!) в мосте
25. Критическое правило: ВСЕГДА ИСКАТЬ В ДОКУМЕНТАЦИИ ПРОШИВКИ 2.7.15 ПЕРЕД написанием кода для устройств
26. Фикс BT PIN: protobuf-константы (config_pb2) вместо magic numbers + ensureSessionKey() перед транзакцией + диагностика BT после записи/перезагрузки
27. Фикс positionPrecision: убран try/catch вокруг записи канала (ошибка → откат транзакции), добавлена немедленная диагностика position_precision после writeChannel(0), исправлен дефолт прошивки с 14 на 13 (проверено по Channels.cpp v2.7.15), исправлены скрипты (--set position.position_precision → --ch-index 0 --ch-set module_settings.position_precision), исправлен баг в techo-dump-config.py (positionFlags сравнивался с positionPrecision)
28. Автосинхронизация БД: prisma db push в dev-скрипте + postinstall prisma generate
29. Фикс positionFlags: 943→299 (пеший режим, дефолт 811 без SPEED). Проверено по protobuf config.proto v2.7.15. Все пресеты, UI-опции, скрипты обновлены.
30. Полная телеметрия: добавлены 7 полей (speed, heading, satsInView, HDOP, pressure, channelUtilization, airUtilTx) в БД, мост, API, UI. Мост извлекает groundSpeed(мм/с→м/с), groundTrack(1/10000°→°), satsInView, HDOP(÷100) из Position; channelUtilization, airUtilTx из DeviceMetrics; barometricPressure из EnvironmentMetrics. Кэши node_dev_metrics/node_env_metrics для periodic sync. Карточка узла: скорость(км/ч), курс(°), спутники(цвет), HDOP(цвет), давление(гПа), загрузка канала(%), эфир TX(%). Карта: скорость, курс, спутники в попапе.
31. Фикс setOwner и factory reset: (а) При factory reset поля имени очищаются — устройство получает дефолтное «Meshtastic XXXX», иначе setOwner() перезаписывал старое имя; (б) short_name макс. 4 символа (nChars=4 в Python-библиотеке, НЕ 5); (в) Защита от sys.exit() при пустом имени в setOwner(); (г) Задержка 5 сек после factory reset перед setOwner(); (д) Проверено по исходникам AdminModule.cpp + NodeDB.cpp v2.7.15: factory_reset_config→factoryReset()→installDefaultDeviceState()→сброс owner.
32. Установка имени устройства через setOwner без пресета: (а) POST /api/set-owner в мосте — вызывает setOwner() на локальном или удалённом узле, ensureSessionKey() перед вызовом, не требует перезагрузки; (б) POST /api/meshtastic/set-owner в API дашборда — пересылает запрос на мост + обновляет БД при успехе; (в) Диалог редактирования узла — новая опция «Установить на устройстве» с индикатором статуса моста; (г) Без опции имя меняется только в БД и перезаписывается при следующей синхронизации.
33. GPS дрейф и fixedPosition: (а) Исследована проблема дрейфа координат у стационарного трекера — 4 причины (GPS шум ±3-10м без фильтрации, smart broadcast с малым порогом, gpsUpdateInterval=1 сек слишком частый, position_precision<32 обфусцирует); (б) Добавлено поле fixedPosition (Boolean, default false) в Preset модель, мост, UI пресетов, API; (в) При fixedPosition=true мост принудительно ставит gps_mode=DISABLED (баг #8403: onGPSChanged перезаписывает fixed_position); (г) UI: чекбокс «Фиксированная позиция» с предупреждением + отображение в карточке пресета; (д) Генерация команд/YAML включает fixed_position; (е) Документация обновлена: PROJECT_RULES.md (раздел 4.2 — fixedPosition + дрейф GPS), AI_PROMPT.md
34. Углублённое исследование GPS дрейфа: (а) Найден аппаратный дефект T-Echo — LilyGO issue #32: проводящая сетка внутри замыкает пассивные компоненты GPS-антенны → GPS теряет спутники через 2-5 мин; (б) Подтверждён баг #836 — T-Echo L76K GNSS периодически теряет фикс; (в) Найдены баги #8029 (GPS lock hold 20 сек), #992 (инверсия знака координат), #6785 (Smart Broadcast спорадическое вещание); (г) Пресет «Трекер лес 12ч» исправлен: gpsUpdateInterval 1→30 сек (L76K не успевает за 1 сек), smartBroadcastMinDist 20→100 м (дефолт прошивки, GPS шум ±10м), smartBroadcastMinInterval 60→120 сек; (д) Пресет «Трекер лес 5 дней»: smartBroadcastMinDist 50→100 м; (е) Все дефолты обновлены в 6 файлах: builtin-presets.ts, prisma/schema.prisma, presets/route.ts, settings-presets-tab.tsx, techo-bridge.py; (ж) Документация обновлена: PROJECT_RULES.md (расширенный раздел 4.2 — 6 причин по вероятности, таблица сравнения с дефолтами прошивки, 6 багов), AI_PROMPT.md
35. Новый порядок прошивки пресетом: factory reset → 20 сек → reconnect → setOwner (имя) → reboot → 20 сек → reconnect → транзакция (конфиг) → reboot. (а) apply_config_to_node() перестроен в 3 явных шага с отдельной перезагрузкой после имени; (б) Таймаут API 120→180 сек; (в) UI диалог обновлён с описанием нового порядка; (г) Документация обновлена
36. Ревью проекта: (а) MODEM_PRESET_MAP — добавлены LITE_FAST/SLOW, NARROW_FAST/SLOW (молча пропускались при push); (б) REBROADCAST_MODE_MAP — добавлены алиасы LOCAL_SKIP→1, SIMPLE→5; (в) usePreamble — зомби-поле, убрано из UI/CLI/YAML; (г) ROLE_MAP — комментарий TAK≠TAK_TRACKER; (д) Bridge docstring обновлён
37. KMZ/KML overlay на карте: (а) Создан kmz-parser.ts — парсинг .kmz (unzip через fflate + KML→GeoJSON через @tmcw/togeojson) и .kml; (б) Карта (map-leaflet.tsx) — кнопка загрузки KMZ/KML, drag & drop, GeoJSON-слой с цветовым кодированием (точки=розовый, линии=оранжевый, полигоны=фиолетовый), popup с name/description, управление видимостью, подгонка bounds; (в) Панель «Слой» в статистике карты; (г) GroundOverlay — растровые изображения из KMZ (base64 data URL) через L.ImageOverlay с bounds, opacity из <color> KML, подгонка карты по combined bounds (вектор+растр); (д) Фильтрация синего полигона-дубликата GroundOverlay — удаление <GroundOverlay> из XML до togeojson
38. Профили устройств: (а) device-profiles.ts — 2 профиля: T-Echo (LilyGO, nRF52840 + L76K GPS, e-ink, 850 мАч), Heltec Wireless Tracker V1.1 (ESP32-S3FN8 + UC6580 GNSS, LCD 0.96", USB-C); (б) Каждый профиль: аппаратные характеристики (CPU, GPS, дисплей, батарея, LoRa, BT), специфичные команды прошивки (pre/post), инструкции по прошивке (flashInstructions), предупреждения, defaultsOverride; (в) UI: кнопки выбора устройства над карточками пресетов; (г) UI: выбор типа устройства в диалоге пуша; (д) UI: панель характеристик + warnings + инструкция по прошивке (аккордеон) в генераторе команд; (е) Генерация команд: заголовок с устройством, pre/post команды, warnings; (ж) Heltec Tracker: UC6580 GNSS баги — модуль сбрасывается при выключенном экране (#5088), дефолтная конфигурация Meshtastic ухудшает GNSS (#10202); LCD жрёт батарею → screenOnSecs=30 (НЕ 0!), LED включён; (з) FlashInstruction — новый тип: пошаговая инструкция по прошивке (step, description, command?, note?); (и) Heltec Tracker прошивка: Web Flasher или CLI (device-install.sh / esptool.py), boot mode через USER+RESET, V1.1 требует прошивку ≥ 2.2.17 (GPIO3 для GNSS питания); TRACKER роль + power_saving — сон между вещаниями, LoRa не принимает во время сна
39. Фикс генерации YAML/CLI (9 критических багов): (а) Убрана секция module_config.channel.module_settings.position_precision из YAML — meshtastic --configure игнорирует эту секцию! position_precision настраивается только через CLI: --ch-index 0 --ch-set module_settings.position_precision N; (б) channel_url ВСЕГДА закомментирован в YAML — баг --seturl с base64 PSK (символ '+' ломает парсер); (в) Команды канала ВСЕГДА добавляются после --configure + --reboot (раньше только при отсутствии channelUrl); (г) Устранено дублирование smart broadcast настроек из yamlExtras Heltec Tracker — PRESET_POSITION_KEYS/DEVICE_SETUP_POSITION_KEYS фильтры; (д) device-setup-tab: добавлены недостающие поля в YAML — position_broadcast_secs, smart broadcast (distance, interval), agps_enabled; (е) device-setup-tab: добавлены недостающие поля в INITIAL_STATE — agpsEnabled, positionBroadcastSecs, smartBroadcastMinDist, smartBroadcastMinInterval; (ж) device-setup-tab: добавлен gps_attempt_time, position_broadcast_secs, smart broadcast, position_flags в CLI команды; (з) Fallback: position_precision + --reboot даже без привязанного канала
40. Фикс оставшихся багов YAML/CLI генерации в device-setup-tab.tsx (4 бага): (а) smartBroadcastEnabled — добавлен в INITIAL_STATE, убран хардкод true → условная генерация в YAML и CLI; (б) gpsAttemptTime — добавлен в INITIAL_STATE, убран хардкод 90 → state.gpsAttemptTime в YAML и CLI; (в) fixedPosition — добавлен в INITIAL_STATE + YAML (fixed_position: true) + CLI (--set position.fixed_position true) + UI toggle с предупреждением о баге #8403; (г) ledHeartbeatDisabled — добавлен в INITIAL_STATE + YAML (led_heartbeat_disabled: true в config.device) + CLI (--set device.led_heartbeat_disabled true) + UI toggle в секции Дисплей; (д) Добавлены UI-контролы: AGPS toggle, GPS Attempt Time, Smart Broadcast toggle + поля, Fixed Position toggle, LED индикатор toggle
41. Компактное отображение времён пакетов по типам в свёрнутой строке карточки узла: (а) Поля lastInfoPacket/lastTelemetryPacket/lastPositionPacket уже существовали в Prisma-схеме, типах, API и мосте; (б) Prisma Client не включал поля в SQL-запросы — выполнен prisma db push + regenerate; (в) Добавлена функция getShortRelativeTime() — компактный формат (now, 5м, 2ч, 3д); (г) В свёрнутую строку рядом с «Last seen» добавлены 3 компактных индикатора: 👤 NODEINFO (порт 4, синий), 🌡 TELEMETRY (порт 7, оранжевый), 📍 POSITION (порт 3, зелёный); (д) Каждый индикатор с tooltip (точное время приёма) и цветовой индикацией (>1ч = amber); (е) Расширенная секция «Последние пакеты» сохранена для детального просмотра
42. Новая логика определения USB/внешнего питания: (а) Было: usbPower = voltage > 3.9V — ненадёжно, LiPo может быть 4.1V при полной зарядке; (б) Стало: usbPower = (прямое поле usbPower из deviceMetrics) ИЛИ (batteryLevel >= 101 — Meshtastic шлёт 101% при USB) ИЛИ (voltage >= 4.4V — гарантированно внешнее питание); (в) Мост (techo-bridge.py): убран min(batteryLevel, 100) — 101% сохраняется как маркер USB; (г) API: batteryLevel обрезается до 100 через Math.min() при сохранении в БД (101→100), usbPower определяется по трём критериям; (д) UI: tooltip «Внешнее питание (USB / зарядка)» вместо «Устройство подключено по USB»

### Известные проблемы (из ревью #43):

#### 🔴 Критические
- **Нет аутентификации** на API-роутах — любой может читать/писать/удалять узлы
- **Python-мост слушает 0.0.0.0** вместо 127.0.0.1 — доступен из сети

#### 🟡 Средние
- **settings-presets-tab.tsx — 2653 строки** — монстр-компонент, сложно поддерживать. Рекомендация: разделить на PresetCard, PresetEditor, PushToDeviceDialog
- **device-setup-tab.tsx — 1841 строка** — тоже крупный, рекомендуется разделение
- **POST /api/nodes** — не включает новые поля (speed, heading, satsInView, hdop, pressure, channelUtilization, airUtilTx, usbPower, lastInfoPacket, lastTelemetryPacket, lastPositionPacket) — создание узла вручную будет неполным
- **Нет валидации входных данных** на большинстве API-роутов — только try/catch с Prisma
- **Нет автоопределения offline** — узлы остаются «online» бесконечно, нет TTL-проверки

#### 🟢 Низкие
- **Дублирование констант** — ROLE_MAP, MODEM_PRESET_MAP и т.д. в techo-bridge.py, но нет TypeScript-эквивалентов для числовых маппингов (только строковые типы в types.ts)
- **Нет AlertDialog при удалении канала** — только при удалении узла
- **Нет Error Boundaries** — падение одного компонента может уронить весь дашборд
- **Нет механизма очистки Telemetry** — таблица растёт бесконечно
- **Packets buffer in-memory** — теряется при перезагрузке сервера
- **usePreamble — зомби-поле** — всё ещё в Prisma-схеме, не используется мостом, нет в UI

---

## 10. Константы Meshtastic (кратко)

### Модем-пресеты (12)
LONG_FAST, LONG_MODERATE, LONG_TURBO, MEDIUM_FAST, MEDIUM_SLOW,
SHORT_FAST, SHORT_SLOW, SHORT_TURBO, LITE_FAST, LITE_SLOW, NARROW_FAST, NARROW_SLOW

### Регионы 433 МГц (6)
EU_433 (основной, Россия/СНГ), ANZ_433, UA_433, KZ_433, PH_433, MY_433

### GPS Mode (3)
ENABLED, DISABLED, NOT_PRESENT

### Position Flags (10)
ALTITUDE=1, ALT_MSL=2, GEO=4, DOP=8, HVDOP=16, SAT=32, SEQ=64, TS=128, HEADING=256, SPEED=512
Пеший: 299 | Дефолт прошивки: 811 | Все: 1023

### Rebroadcast Mode (6 + 2 алиаса)
ALL(0), ALL_SKIP_DECODING(1), LOCAL_ONLY(2), KNOWN_ONLY(3), NONE(4), CORE_PORTNUMS_ONLY(5)
Алиасы для совместимости: LOCAL_SKIP→1, SIMPLE→5

---

_Последнее обновление: 2026-05-11 (Задача 43: Полный ревью проекта + обновление документации)_
