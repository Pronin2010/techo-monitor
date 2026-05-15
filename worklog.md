# T-Echo Monitor — Worklog

---
Task ID: 1
Agent: main
Task: Клонирование репозитория techo-monitor и запуск проекта

Work Log:
- Клонирован репозиторий https://github.com/Pronin2010/techo-monitor.git
- Файлы синхронизированы в /home/z/my-project через rsync
- Установлены зависимости: bun install (46 пакетов)
- Pushed Prisma schema → SQLite (6 моделей: Node, Channel, Telemetry, ConnectionConfig, Preset, SyncLog)
- Запущен dev-сервер Next.js 16.1.3 (Turbopack) на порту 3000 через detached child process
- Проверены все API endpoints: /api/nodes (200), /api/channels (200), /api/presets (200), /api/meshtastic/bridge (502 — мост не запущен, ожидаемо)
- Встроенные пресеты автоматически мигрированы в БД (4 пресета: Трекер лес 12ч, Трекер лес 5 дней, Базовая станция, Клиент по умолчанию)
- Lint пройден без ошибок
- Главная страница рендерится (HTTP 200, 32KB)

Stage Summary:
- Проект полностью клонирован и запущен
- Dev-сервер стабильно работает на порту 3000
- Все компоненты дашборда на месте (7 табов)
- Python-мост (techo-bridge.py) не запущен — ожидаемо, т.к. нет физического устройства

---
Task ID: 2
Agent: main
Task: Исправление багов генерации YAML/CLI в settings-presets-tab.tsx и device-setup-tab.tsx

Work Log:
- Найдено 9 критических багов в генераторах YAML и CLI команд
- settings-presets-tab.tsx — исправлено:
  1. Убрана секция module_config.channel.module_settings.position_precision из YAML (--configure её игнорирует)
  2. channel_url ВСЕГДА закомментирован с предупреждением о баге --seturl с base64 PSK
  3. Команды канала ВСЕГДА добавляются после --configure (раньше только при отсутствии channelUrl)
  4. Добавлен --reboot в конец команд канала
  5. Устранено дублирование smart broadcast настроек из yamlExtras Heltec Tracker (PRESET_POSITION_KEYS фильтр)
- device-setup-tab.tsx — исправлено:
  1. Убрана секция module_config.channel.module_settings.position_precision из YAML
  2. channel_url закомментирован с предупреждением о баге --seturl
  3. Команды канала — активные (не закомментированные), после --configure + --reboot
  4. Добавлен position_broadcast_secs в YAML
  5. Добавлены smart broadcast настройки (distance, interval) в YAML вместо хардкода
  6. Добавлен agps_enabled в YAML и CLI
  7. Добавлен gps_attempt_time в CLI команды
  8. Добавлены position_broadcast_secs, smart broadcast, position_flags в CLI
  9. Добавлены positionPrecision и --reboot в команды канала
  10. Устранено дублирование из yamlExtras (DEVICE_SETUP_POSITION_KEYS фильтр)
  11. Добавлены недостающие поля в INITIAL_STATE: agpsEnabled, positionBroadcastSecs, smartBroadcastMinDist, smartBroadcastMinInterval
  12. Fallback: position_precision + --reboot даже без канала
- Lint пройден без ошибок
- Dev-сервер работает (HTTP 200)

Stage Summary:
- Все 9 багов генерации YAML/CLI исправлены
- YAML теперь генерирует корректный конфиг, совместимый с meshtastic --configure
- Команды канала всегда добавляются после --configure с --reboot
- Дублирование smart broadcast из yamlExtras устранено в обоих файлах

---
Task ID: 3
Agent: main
Task: Исправление оставшихся багов YAML/CLI генерации в device-setup-tab.tsx

Work Log:
- Добавлены 4 недостающих поля в INITIAL_STATE:
  1. smartBroadcastEnabled: true — умная трансляция позиции
  2. gpsAttemptTime: 90 — GPS время попытки
  3. fixedPosition: false — фиксированная позиция (для базовых станций)
  4. ledHeartbeatDisabled: false — отключение LED индикатора
- Исправлена генерация YAML:
  1. gps_attempt_time теперь использует state.gpsAttemptTime вместо хардкода 90
  2. position_broadcast_smart_enabled и сопутствующие поля обёрнуты в if (state.smartBroadcastEnabled)
  3. Добавлен вывод fixed_position: true при state.fixedPosition
  4. Добавлен вывод led_heartbeat_disabled: true в секции config.device при state.ledHeartbeatDisabled
- Исправлена генерация CLI:
  1. gps_attempt_time использует state.gpsAttemptTime вместо хардкода 90
  2. Smart broadcast команды обёрнуты в if (state.smartBroadcastEnabled) + добавлена команда position_broadcast_smart_enabled true
  3. Добавлена команда fixed_position true при state.fixedPosition
  4. Добавлена команда device.led_heartbeat_disabled true при state.ledHeartbeatDisabled
- Добавлены UI-контролы:
  1. AGPS toggle + GPS Attempt Time — в секции GPS (после GPS интервала, только при ENABLED)
  2. Умная трансляция (toggle + мин. расстояние + мин. интервал) — в секции GPS/Позиция после position_flags
  3. Фиксированная позиция (toggle + предупреждение о баге #8403) — в секции GPS/Позиция после умной трансляции
  4. LED индикатор (toggle с инвертированной логикой) — в секции Дисплей после таймаута экрана
- Добавлен импорт иконки Repeat из lucide-react
- Lint пройден без ошибок
- Dev-сервер работает стабильно

Stage Summary:
- Все 4 бага генерации YAML/CLI исправлены (smartBroadcastEnabled, gpsAttemptTime, fixedPosition, ledHeartbeatDisabled)
- YAML и CLI генераторы теперь полностью управляются state — нет хардкода
- Добавлены все недостающие UI-контролы с корректными подписями на русском

---
Task ID: 4
Agent: main
Task: Добавить вывод времени последних пакетов (NODEINFO, TELEMETRY, POSITION) в карточку узла

Work Log:
- Добавлены 3 поля в Prisma-схему Node: lastInfoPacket, lastTelemetryPacket, lastPositionPacket (DateTime?, nullable)
- Выполнен prisma db push — схема синхронизирована с SQLite
- Добавлены 3 кэша в techo-bridge.py: node_last_info, node_last_telemetry, node_last_position
- Обновлён on_receive: запись timestamp при получении каждого типа пакета (NODEINFO=порт 4, TELEMETRY=порт 7, POSITION=порт 3)
- Обновлён periodic sync: передача lastInfoPacket/lastTelemetryPacket/lastPositionPacket в node_entry
- Обновлён POST /api/meshtastic/sync: сохранение новых полей в БД (и при update, и при create)
- Обновлён тип MeshNode в types.ts: добавлены lastInfoPacket, lastTelemetryPacket, lastPositionPacket (string | null)
- Обновлён NodeStatusCard: секция «Последние пакеты» с 3 строками (Инфо, Телеметрия, GPS) и цветовой индикацией (>1ч = amber)
- Lint пройден без ошибок, dev-сервер работает

Stage Summary:
- Карточка узла теперь показывает когда последний раз приходили пакеты NODEINFO, TELEMETRY и POSITION
- Мост записывает timestamp'ы при получении каждого типа пакета через pubsub
- Цветовая индикация: если пакет старше 1 часа — текст amber, иначе стандартный

---
Task ID: 5
Agent: main
Task: Добавить компактное отображение времён пакетов по типам в свёрнутой строке карточки узла

Work Log:
- Обнаружено, что Prisma Client не включал поля lastInfoPacket/lastTelemetryPacket/lastPositionPacket в SQL-запросы (кэш устарел)
- Выполнен prisma db push + regenerate — Prisma Client обновлён
- Перезапущен dev-сервер с увеличенным heap (NODE_OPTIONS=--max-old-space-size=2048)
- Добавлена функция getShortRelativeTime() — компактный формат для inline (now, 5м, 2ч, 3д)
- Добавлено компактное inline-отображение пакетов по типам в свёрнутой строке рядом с «Last seen»:
  - 👤 NODEINFO (порт 4) — синяя иконка User + компактное время
  - 🌡 TELEMETRY (порт 7) — оранжевая иконка Thermometer + компактное время
  - 📍 POSITION (порт 3) — зелёная иконка MapPin + компактное время
  - Каждый элемент с tooltip (точное время приёма)
  - Разделитель «│» между Last seen и пакетами
  - Цветовая индикация: >1ч = amber
- Созданы тестовые данные (3 узла с разными состояниями пакетов)
- Lint пройден без ошибок
- Страница загружается корректно (HTTP 200)

Stage Summary:
- В свёрнутой строке карточки узла теперь видны времена последних пакетов по типам
- Формат: «🕐 5 мин. назад │ 👤15м │ 🌡5м │ 📍2м»
- Расширенная секция «Последние пакеты» сохранена для детального просмотра
- Цветовая индикация устаревших данных (>1ч = amber)

---
Task ID: 6
Agent: main
Task: Изменить логику определения USB/внешнего питания: batteryLevel>=101 и voltage>=4.4V вместо voltage>3.9V

Work Log:
- Найдена проблема: старая логика voltage > 3.9V ненадёжна — LiPo при полной зарядке может быть 4.1-4.2V
- Meshtastic прошивка реально шлёт batteryLevel=101% при USB-питании — точный индикатор
- techo-bridge.py: убран min(batteryLevel, 100) — 101% больше не обрезается, используется как маркер USB
- techo-bridge.py: новая логика usbPower: (1) прямое поле usbPower из deviceMetrics, (2) batteryLevel >= 101, (3) voltage >= 4.4V
- API sync route (update и create): usbPower определяется по трём критериям вместо voltage > 3.9
- API sync route: batteryLevel обрезается до 100 через Math.min() при сохранении в БД (101→100)
- API sync route: убрано дублирование batteryLevel/voltage в update-блоке
- UI node-status-card.tsx: tooltip «Внешнее питание (USB / зарядка)» вместо «Устройство подключено по USB»
- Lint пройден без ошибок
- Тестовые данные пересозданы (3 узла, «База» с usbPower=true)

Stage Summary:
- USB питание определяется по 3 критериям: usbPower field || batteryLevel>=101 || voltage>=4.4V
- batteryLevel=101 от прошивки обрезается до 100 при сохранении в БД
- Мост больше не обрезает batteryLevel — сохраняет 101 как маркер для usbPower

---
Task ID: 43
Agent: main
Task: Полный ревью проекта + обновление всей документации

Work Log:
- Прочитаны все ключевые файлы проекта (17 файлов): Prisma-схема, типы, утилиты, все компоненты дашборда, API-роуты, мост, документация
- Проведён полный ревью проекта — код, архитектура, безопасность, документация
- Выявлены критические проблемы: нет аутентификации на API, мост слушает 0.0.0.0
- Выявлены средние проблемы: монстр-компоненты (settings-presets-tab.tsx 2653 строки, device-setup-tab.tsx 1841 строка), неполный POST /api/nodes, нет валидации входных данных, нет автоопределения offline
- Выявлены низкие проблемы: дублирование констант, нет AlertDialog при удалении канала, нет Error Boundaries, нет очистки Telemetry, usePreamble зомби-поле
- Исправлен устаревший комментарий usbPower в Prisma-схеме (было "напряжение > 3.9V", стало "usbPower field || batteryLevel>=101 || voltage>=4.4V")
- Обновлён AI_PROMPT.md: структура проекта с размерами файлов, новый раздел проблем с приоритетами, актуализация API-путей
- Обновлён PROJECT_RULES.md: добавлен раздел "Определение USB/внешнего питания" с описанием 3 критериев, обновлена дата
- Обновлён README.md: добавлены kmz-parser.ts, device-profiles.ts, уточнены описания компонентов и API-роутов
- Обновлён STARTUP.md: добавлено описание KMZ/KML overlay, профилей устройств

Stage Summary:
- Полный ревью проекта завершён — найдено 2 критических, 5 средних, 6 низких проблем
- Вся документация актуализирована и отражает текущее состояние проекта
- Исправлен устаревший комментарий в Prisma-схеме

---
Task ID: 44
Agent: main
Task: Исправление багов из ревью #43 + обновление документации

Work Log:
- POST /api/nodes: добавлены все недостающие поля (speed, heading, satsInView, hdop, pressure, channelUtilization, airUtilTx, usbPower, lastInfoPacket, lastTelemetryPacket, lastPositionPacket)
- POST /api/nodes: batteryLevel обрезается через Math.min(num, 100) при ручном создании (101→100)
- POST /api/nodes: usbPower определяется по 3 критериям (usbPower field || batteryLevel>=101 || voltage>=4.4V)
- PUT /api/nodes/[id]: whitelist полей расширен — добавлены speed, heading, satsInView, hdop, pressure, channelUtilization, airUtilTx, lastInfoPacket, lastTelemetryPacket, lastPositionPacket
- Python-мост (techo-bridge.py): HTTP API слушает 127.0.0.1 вместо 0.0.0.0 (безопасность — мост доступен только локально)
- GET /api/nodes: добавлено автоопределение offline — если lastSeen старше 15 минут (OFFLINE_TTL_MS), узел автоматически переводится в status=offline
- GET /api/nodes: обновление stale-узлов в БД происходит асинхронно (Promise.all без await — не блокирует ответ)
- usePreamble: зомби-поле оставлено (размазано по 8+ файлам, уже помечено комментариями как неиспользуемое)
- Обновлён AI_PROMPT.md: задача 44, 3 проблемы отмечены как FIXED, дата 2026-05-12
- Обновлён PROJECT_RULES.md: раздел 4.3.2 "Автоопределение offline-узлов", мост 127.0.0.1, дата 2026-05-12
- Обновлён README.md: автоопределение offline, мост 127.0.0.1
- Обновлён STARTUP.md: автоопределение offline, мост 127.0.0.1:8420
- Lint пройден без ошибок
- API /api/nodes возвращает корректные данные (3 узла, все offline, usbPower определён корректно)

Stage Summary:
- Исправлено 4 проблемы из ревью: POST /api/nodes неполный, PUT whitelist неполный, мост 0.0.0.0, нет автоoffline
- Все изменения проверены: lint пройден, API работает, данные корректны
- Вся документация актуализирована

---
Task ID: 45
Agent: main
Task: Создать полный YAML-референс ВСЕХ настроек прошивки Meshtastic 2.7.15 + документация + обновление правил

Work Log:
- Исследованы protobuf-определения прошивки 2.7.15 из репозитория meshtastic/protobufs (tag v2.7.15)
- Прочитаны файлы: config.proto, module_config.proto, channel.proto, device_ui.proto
- Изучен формат YAML-ключей: protobuf snake_case → YAML camelCase (функция snake_to_camel из Python-библиотеки)
- Изучены примеры YAML-конфигурации из meshtastic/python и GitHub Gist
- Создан файл meshtastic-config-reference.yaml — ПОЛНЫЙ референс ВСЕХ ~190+ полей:
  - Корневые поля: owner, owner_short, channel_url, canned_messages, ringtone, location
  - config.bluetooth: 3 поля
  - config.device: 11 полей (13 ролей, 6 режимов rebroadcast, 5 режимов buzzer)
  - config.display: 11 полей (5 типов OLED, 4 режима дисплея, 8 ориентаций компаса)
  - config.lora: 16 полей (9 модем-пресетов, 27 регионов, ручные параметры)
  - config.network: 11+ полей (WiFi, Ethernet, статический IP, IPv6)
  - config.position: 13 полей (10 position flags, 3 режима GPS, smart broadcast)
  - config.power: 9 полей (power saving, deep sleep, ADC multiplier)
  - config.security: 7 полей (ключи, managed mode, serial, admin channel)
  - config.device_ui: 18+ полей (TFT/BaseUI, темы, языки, фильтры, карта)
  - module_config.mqtt: 11+ полей
  - module_config.serial: 8 полей (16 скоростей, 9 режимов)
  - module_config.external_notification: 16 полей
  - module_config.store_forward: 6 полей
  - module_config.range_test: 4 поля
  - module_config.telemetry: 14 полей (устройство, среда, IAQ, питание, здоровье)
  - module_config.canned_message: 9 полей
  - module_config.audio: 7 полей (9 битрейтов codec2)
  - module_config.remote_hardware: 2+ полей
  - module_config.neighbor_info: 3 поля
  - module_config.ambient_lighting: 5 полей
  - module_config.detection_sensor: 8 полей (6 типов триггера)
  - module_config.paxcounter: 4 поля
- Каждое поле прокомментировано на русском: описание, дефолт, допустимые значения, предупреждения
- Помечены deprecated-поля с объяснением причин и альтернатив
- Помечены поля, неприменимые для T-Echo (Ethernet, WiFi, TFT, I2S, вентилятор PA)
- Создан файл MESHTASTIC_CONFIG_REFERENCE.md — документация:
  - Источник данных (protobuf)
  - Правила конвертации ключей (snake_to_camel)
  - Структура YAML-файла с количеством полей
  - Приоритеты настроек для T-Echo (сеть, позиционирование, батарея, стационарный трекер)
  - Deprecated-поля с причинами и альтернативами
  - Ссылки на документацию
- Обновлён PROJECT_RULES.md:
  - Добавлен раздел 4.5 "КРИТИЧЕСКОЕ ПРАВИЛО: СПРАВОЧНИК КОНФИГУРАЦИИ YAML"
  - Правило: при работе с конфигурацией СНАЧАЛА смотреть в YAML-референс
  - Обновлена дата
- Обновлён README.md:
  - Добавлены meshtastic-config-reference.yaml и MESHTASTIC_CONFIG_REFERENCE.md в структуру проекта
  - Добавлены в таблицу документации

Stage Summary:
- Создан полный YAML-референс ВСЕХ ~190+ настроек Meshtastic 2.7.15 с комментариями на русском
- Создана документация MESHTASTIC_CONFIG_REFERENCE.md
- Правила проекта обновлены — ссылка на YAML-референс как обязательный источник
- README.md обновлён — новые файлы в структуре и документации
