# Worklog

---
Task ID: 1
Agent: main
Task: Refactor Status tab — remove add button, simplify edit dialog, add search, horizontal accordion rows, remove stats

Work Log:
- Removed "Add Node" button from empty state and list header in dashboard-client.tsx
- Simplified node-form-dialog.tsx — kept only name, shortName, role, sleep settings. Removed status, battery, voltage, SNR, RSSI, position fields
- Added search/filter by name and shortName in dashboard-client.tsx
- Rewrote node-status-card.tsx from vertical cards to horizontal accordion rows with expand/collapse
- Removed NetworkStats component (4 stat cards: online, offline, avg battery, avg SNR)
- Removed unused imports and state variables (addNodeOpen, handleCreateNode, nextNodeId)
- Verified compilation and lint — no errors

Stage Summary:
- All 5 tasks completed
- Status tab now has: search bar → device count → horizontal rows with accordion expand
- Edit dialog only has user-configurable fields (name, role, sleep)
- Server running on port 3000, page renders with 200

---
Task ID: 2
Agent: main
Task: Simplify Connection tab — replace 1162-line monolith with wizard UI

Work Log:
- Read full current connection-tab.tsx (1162 lines) — identified 5 major sections to restructure
- Designed 3-step wizard: Подготовка → Подключение → Проверка
- Rewrote connection-tab.tsx completely (~450 lines vs 1162 before)
- Step 1 (Подготовка): 4 compact collapsible sub-steps — flash firmware, set region EU_433, create channel, configure roles
- Step 2 (Подключение): Serial/MQTT selector (two clickable cards), pre-filled form fields, download script card, auto-generated run command with copy button
- Step 3 (Проверка): Test sync button, success confirmation with "Всё настроено" action
- Added localStorage persistence for wizard progress (steps completed + current step)
- Moved forest tips to collapsible "Справочник" at the bottom with: 433 MHz info, quick single-command config block, tips grid (modem, antenna, battery, GPS), mesh/sleep explanation, all-commands reference
- Compact connection status banner at top (shows connected/disconnected with last sync time)
- ESLint clean, server running successfully

Stage Summary:
- File reduced from 1162 to ~450 lines (60% reduction)
- Clean wizard UX with 3 steps and progress indicator
- All reference material preserved but moved out of the main flow
- Wizard progress saved to localStorage across page reloads

---
Task ID: 3
Agent: Main Agent
Task: Fix meshtastic CLI command generation in device-setup-tab.tsx — outdated/incorrect parameters

Work Log:
- Installed meshtastic 2.7.8, analyzed CLI help output and __main__.py source
- Verified protobuf enums: DeviceRole, RegionCode, ModemPreset, PositionConfig fields
- Analyzed setPref(), traverseConfig(), --ch-set, --ch-del, --configure handlers
- Compared current code field names/values against actual protobuf definitions

Bugs found and fixed:
1. GPS fields: gps.enabled/gps.update_interval -> position.gps_enabled/position.gps_update_interval
2. Modem presets: CamelCase (LongModerate) -> UPPER_SNAKE_CASE (LONG_MODERATE)
3. PSK size: 16 bytes -> 32 bytes (genPSK256 generates 32 bytes)
4. Channel 0 cannot be deleted (primary) -> replaced with setting private PSK on channel 0
5. Channel fields: uplink/downlink -> uplink_enabled/downlink_enabled
6. --ch-add without argument removed, replaced with --ch-set on channel 0
7. PSK format: added base64: prefix for proper decoding

New features:
- All 9 device roles with Russian descriptions
- All 10 modem presets and 20 regions from protobuf
- Owner name / short name fields
- Output mode toggle: Commands (PowerShell .ps1) / YAML config (--configure)
- YAML config is most reliable (uses transactions)

Stage Summary:
- Completely rewritten device-setup-tab.tsx with correct meshtastic 2.7.8 parameters
- Added YAML config as alternative output format
- Lint passes successfully

---
Task ID: 4
Agent: Main Agent
Task: Add Event Log tab — track what data comes from trackers and when

Work Log:
- Enhanced Prisma schema: added latitude/longitude/altitude to Telemetry model
- Redesigned SyncLog: removed nodeCount, added eventType field (battery, position, environment, signal, heartbeat, device_info)
- Updated sync route POST handler to create per-node SyncLog entries with detected event types
- Added detectEventTypes() function that analyzes incoming data and determines what events occurred
- Position tracking: Telemetry now stores GPS coordinates, so position history is preserved
- Battery diff tracking: logs show battery change since last sync (+/- percentage)
- Position movement detection: shows if node moved between syncs
- Created EventLogTab component with:
  - Summary badges (total entries, counts by event type)
  - 4 filter dropdowns: node, event type, source (serial/mqtt), action (created/updated)
  - Date-grouped timeline with expandable rows
  - Quick preview: battery %, SNR, GPS status visible without expanding
  - Expanded view: full JSON details with formatted values
- Updated sync-log API: filtering by nodeId, eventType, source, action + DELETE for cleanup
- Added "Журнал" tab to dashboard with FileText icon
- Lint passes, server running

Stage Summary:
- New "Журнал" tab shows real-time event log from all trackers
- Per-node, per-event-type logging with timestamps
- Filters for node, event type, source, and action
- Position history now stored in Telemetry table (was lost before)
- SyncLog entries are granular (one per node per sync) instead of one per batch

---
Task ID: 5
Agent: main
Task: Fix preset duplication and redesign system presets UI

Work Log:
- Added @unique constraint on builtinId in Prisma schema
- Rewrote GET /api/presets to use upsert (atomic, prevents race condition)
- Fixed .env DATABASE_URL to point to actual DB (file:../db/custom.db)
- Cleaned up duplicate presets in the database
- Redesigned system presets as compact device-like cards in responsive grid
- Updated seed route to use upsert

Stage Summary:
- Preset duplication fixed (upsert + unique constraint)
- System presets now display as cards instead of rows
- DB connection fixed

---
Task ID: 6
Agent: main
Task: Remove Журнал tab and demo data functionality

Work Log:
- Removed EventLogTab component (event-log-tab.tsx)
- Removed seed API route (api/seed/route.ts)
- Removed demo data buttons from header and empty status
- Removed seedDatabase/handleSeed functions
- Kept sync-log API (still used by ConnectionTab)
- Dashboard: 8 tabs → 7 tabs

Stage Summary:
- Журнал tab completely removed
- Demo data functionality removed
- sync-log API preserved for Connection tab

---
Task ID: 7
Agent: main
Task: Add documentation update rule to PROJECT_RULES.md

Work Log:
- Added section 9 "Документация проекта" with 6 bullet points
- Updated footer date in PROJECT_RULES.md

Stage Summary:
- New rule: always update all project documentation on changes

---
Task ID: 8
Agent: main
Task: Code review — fix all critical, important, and minor issues

Work Log:
- Fixed mass assignment vulnerability in PUT /api/nodes/[id] and PUT /api/channels (whitelisted fields)
- Deleted dead code: src/lib/store.ts (unused Zustand store)
- Removed 27 unused npm packages and 8 unused UI components
- Created README.md at project root (Russian, with features/stack/quick start)
- Fixed connection-tab.tsx: removed log.nodeCount reference to non-existent field
- Changed layout.tsx: html lang="en" → "ru"
- Fixed db.ts: Prisma query logging only in development
- Fixed schema.prisma: Channel.modemPreset default "LongFast" → "LONG_FAST"
- Fixed STARTUP.md: client preset info SHORT_TURBO → LONG_FAST
- Updated .env.example: DATABASE_URL path to ../db/custom.db
- Fixed builtin-presets.ts: removed stale /api/seed comment
- Deleted src/app/api/route.ts (Hello, world! scaffold)
- Changed Пресеты tab icon from Settings to Cpu
- Fixed tsconfig.json: removed noImplicitAny:false, jsx → preserve
- Changed package.json name to techo-monitor

Stage Summary:
- All 15 review issues fixed (4 critical, 7 important, 4 minor)
- Build passes cleanly
- Project significantly cleaned up: -27 unused packages, -8 dead UI components
- Security: mass assignment vulnerability patched
---
Task ID: 1
Agent: main
Task: Добавить удалённую отправку конфигурации на устройства через мост

Work Log:
- Исследовал meshtastic Python library (v2.7.8): Node.writeConfig(), beginSettingsTransaction(), commitSettingsTransaction(), reboot()
- Расширил techo-bridge.py: добавлен HTTP API сервер (порт 8420) с endpoints POST /api/apply-config и GET /api/status
- Добавлена функция apply_config_to_node() — атомарное применение конфигурации через транзакции: device, position, power, lora, network, bluetooth, display, telemetry
- Маппинги строковых значений → protobuf enum: ROLE_MAP, GPS_MODE_MAP, MODEM_PRESET_MAP, REGION_MAP, REBROADCAST_MODE_MAP
- Создан API маршрут POST /api/meshtastic/config — проксирует запросы от дашборда к HTTP API моста
- Создан API маршрут GET /api/meshtastic/bridge — статус моста и список узлов
- Добавлена кнопка "Отправить на устройство" (зелёная иконка Upload) на карточках системных пресетов
- Добавлен диалог Push-to-Device: выбор устройства (BASE локальный или удалённый через mesh), предупреждения, превью пресета
- Обновлена документация: README.md, STARTUP.md, PROJECT_RULES.md

Stage Summary:
- Реализован полный цикл отправки конфигурации: UI → API → мост → устройство
- Поддержка локального (USB) и удалённого (mesh) применения конфигурации
- HTTP API моста работает на порту 8420 (--api-port для изменения)
- Транзакционное применение: begin → writeConfig × 8 секций → commit → reboot
- Новые файлы: src/app/api/meshtastic/config/route.ts, src/app/api/meshtastic/bridge/route.ts

---
Task ID: 2
Agent: main
Task: Добавить установку имени устройства (deviceName/deviceShortName) при отправке конфигурации

Work Log:
- Расширен apply_config_to_node() в techo-bridge.py: добавлены параметры device_name, device_short_name
- Перед транзакцией вызывается node.setOwner(long_name, short_name) если имя задано
- Обновлён POST /api/apply-config handler моста: читает deviceName/deviceShortName из тела запроса
- Обновлён POST /api/meshtastic/config route: передаёт deviceName/deviceShortName в payload моста и SyncLog
- Добавлены state-переменные pushDeviceName/pushDeviceShortName в settings-presets-tab.tsx
- Добавлен обработчик handlePushTargetChange — при смене устройства автозаполняет имя из текущего
- В диалог добавлены поля: «Имя устройства» (Input) + «Короткое» (Input, maxLength=5)
- Подсказка: «Оставьте пустым, чтобы не менять текущее имя»
- Обновлена документация: README.md, STARTUP.md, PROJECT_RULES.md

Stage Summary:
- При отправке пресета на устройство можно задать имя (long name) и короткое имя (short name, макс. 5 символов)
- Имя автозаполняется из текущего устройства при открытии диалога и смене устройства
- setOwner() вызывается до beginSettingsTransaction(), чтобы отделить имя от конфигурации
- Если имя не заполнено — не отправляется, текущее имя устройства не меняется

---
Task ID: 3
Agent: main
Task: Добавить опцию «Сбросить до заводских» в диалог отправки конфигурации

Work Log:
- Расширен apply_config_to_node() в techo-bridge.py: параметр factory_reset
- Если factory_reset=True: node.factoryReset() → sleep(10) → переподключение → применение пресета
- Обновлён POST /api/apply-config handler моста: читает factoryReset из тела запроса
- Обновлён POST /api/meshtastic/config route: передаёт factoryReset в payload моста и SyncLog
- Таймаут увеличен с 30 до 60 сек (factory reset + apply)
- Добавлен state pushFactoryReset в settings-presets-tab.tsx
- В диалог добавлен чекбокс «Сбросить до заводских настроек» с описанием и красной рамкой
- Чекбокс сбрасывается при открытии диалога
- Обновлена документация: STARTUP.md, PROJECT_RULES.md

Stage Summary:
- Опция factory reset в диалоге отправки конфигурации (по умолчанию выключена)
- Порядок: factoryReset → перезагрузка → переподключение → setOwner → beginTransaction → writeConfig → commit → reboot
- UI: чекбокс с предупреждающей рамкой (border-destructive/30)

---
Task ID: 4
Agent: main
Task: Полный код-ревью проекта + создание AI_PROMPT.md

Work Log:
- Склонирован репозиторий в sandbox, проект развёрнут и работает
- Прочитаны все файлы проекта: 11 API роутов, 11 компонентов дашборда, lib, hooks, конфиги, документация
- Проведён полный код-ревью — найдены: 6 багов, 4 проблемы безопасности, 7 архитектурных проблем, 7 UI/UX проблем, 5 проблем документации
- Создан AI_PROMPT.md — файл-промт (261 строка) с полным контекстом проекта для AI-ассистента
- Обновлён README.md: добавлена таблица документации, techo-bridge.py в структуре проекта
- Обновлён PROJECT_RULES.md: правило 9 расширено (добавлен AI_PROMPT.md), добавлено правило 10 (AI-контекст)

Stage Summary:
- AI_PROMPT.md содержит: описание, стек, структуру, 7 вкладок, правила, Meshtastic-домен, схему БД, Python-мост, текущее состояние, константы
- Правило 10 обязывает обновлять AI_PROMPT.md при каждом изменении
- Ревью выявило приоритетные проблемы: P0 (4 критических), P1 (7 важных), P2 (7 улучшений), P3 (5 долгосрочных)

---
Task ID: 13
Agent: main
Task: Добавить в документацию правило «только десктоп»

Work Log:
- Добавлено в AI_PROMPT.md: секция 1 (О проекте) — «Платформа: только десктоп», секция 5 (Правила) — «Только десктоп — мобильная адаптация не нужна»
- Убрана проблема «7 вкладок не влезают на мобильных» из известных проблем AI_PROMPT.md (более не актуальна)
- Добавлено в README.md: цитата «Платформа: только десктоп»
- Добавлено в STARTUP.md: строка «Платформа: только десктоп» в технической информации
- Добавлено в PROJECT_RULES.md: правило в секции 3 «Только десктоп — мобильная адаптация не нужна»
- Обновлена дата в PROJECT_RULES.md

Stage Summary:
- Все 4 файла документации обновлены: AI_PROMPT.md, README.md, STARTUP.md, PROJECT_RULES.md
- Правило «только десктоп» зафиксировано — мобильная адаптация больше не требуется

---
Task ID: 14
Agent: main
Task: Фикс 7 багов в push-to-device (настройки не применялись на устройстве)

Work Log:
- Проведён аудит полного потока отправки: фронтенд → API route → HTTP мост → meshtastic Python
- Bug #1 (КРИТИЧЕСКИЙ): при ошибке writeConfig() вызывался commitSettingsTransaction() → частичные настройки коммитились на устройство. Исправлено: теперь при ошибке вызывается node.reboot() для сброса незакоммиченной транзакции
- Bug #2 (КРИТИЧЕСКИЙ): agpsEnabled отправлялся но никогда не применялся — добавлена секция AGPS с логированием
- Bug #3: positionPrecision=0 (не передавать позицию) → position_flags=3 (передаёт!) — исправлено: precision=0 → flags=0
- Bug #4: writeConfig("telemetry") может не работать на старых версиях библиотеки — добавлен fallback на writeModuleConfig()
- Bug #5: мост /api/status возвращал nodeId как int, а getNode() ожидает hex "!a1b2c3d4" — конвертация в hex-формат
- Bug #6: usePreamble отправлялся но не применялся — убран из payload в route.ts
- Bug #7: factory reset ожидание увеличено с 10 до 20 сек (надёжнее для T-Echo)
- Обновлена документация: AI_PROMPT.md, README.md, STARTUP.md, PROJECT_RULES.md, worklog.md

Stage Summary:
- 7 багов исправлено (2 критических, 2 средних, 3 низких)
- Ключевой фикс: откат транзакции через reboot вместо commit при ошибке
- nodeId теперь в hex-формате для корректной удалённой отправки
- positionPrecision:0 теперь правильно означает «не отправлять позицию»

---
Task ID: 15
Agent: main
Task: Фикс factory reset — мост теряет подключение при перезагрузке устройства

Work Log:
- Проблема: при factory reset устройство перезагружается, SerialInterface теряет серийное соединение, старый interface становится мёртвым
- Добавлена функция _reconnect_interface(): закрывает старый интерфейс, создаёт новый SerialInterface с повторными попытками (5 попыток по 5 сек)
- Сохраняется _bridge_port[0] для переподключения (порт из serial_mode)
- В apply_config_to_node() после factory reset: sleep(10) → _reconnect_interface() → свежий node
- pub.subscribe не нужно переподписывать — глобальная подписка работает с новым интерфейсом автоматически
- Обновлена документация: AI_PROMPT.md, STARTUP.md

Stage Summary:
- При factory reset мост автоматически пересоздаёт SerialInterface
- 5 попыток переподключения с задержкой 5 сек между попытками
- Обновляется глобальная ссылка _bridge_interface[0] — HTTP API продолжает работать

---
Task ID: 16
Agent: main
Task: Фикс перезагрузки после применения конфигурации — мост теряет подключение

Work Log:
- Проблема: после обычной перезагрузки (reboot) устройство отключает serial, мост умирает — «ClearCommError failed»
- Добавлено: после node.reboot() → ожидание (reboot_secs + 5) → _reconnect_interface()
- API route таймаут увеличен: 60 сек → 120 сек (reboot + reconnect)
- reboot() обёрнут в try/except (может вызвать исключение при разрыве serial)

Stage Summary:
- После ЛЮБОЙ перезагрузки устройства мост автоматически переподключается
- Мониторинг пакетов продолжается без перезапуска моста вручную
- Таймаут API увеличен до 120 сек для учёта времени на переподключение
