---
Task ID: 1
Agent: main
Task: Investigate and fix position precision not being set to maximum when pushing preset to device

Work Log:
- Read all relevant source files: types.ts, builtin-presets.ts, settings-presets-tab.tsx, device-setup-tab.tsx, techo-bridge.py, API routes
- Searched official Meshtastic documentation (meshtastic.org, buf.build/protobufs, deepwiki)
- Discovered the root cause: Meshtastic 2.7.x has TWO separate position precision fields:
  1. `Config.PositionConfig.position_flags` (bitmask) - controls WHICH data fields are included
  2. `ChannelSettings.ModuleSettings.position_precision` (0-32 bits) - controls coordinate OBFUSCATION
- The bridge was only setting position_flags, NEVER setting module_settings.position_precision
- Default firmware value for position_precision is 14 (~1.5km radius) - this is why user saw "2km radius"
- Fixed by separating the two concepts across all layers

Stage Summary:
- **Root cause**: `ChannelSettings.ModuleSettings.position_precision` was never set, defaulting to 14 (~1.5km)
- **Fix applied across 7 files**:
  1. `prisma/schema.prisma` - Added `positionFlags Int @default(943)`, changed `positionPrecision` default to 32
  2. `src/lib/builtin-presets.ts` - Added `positionFlags` to interface and all presets, changed `positionPrecision` to 32
  3. `techo-bridge.py` - Maps `positionFlags` → `position_flags`, maps `positionPrecision` → `ch.settings.module_settings.position_precision` on channel 0, always writes channel 0
  4. `src/app/api/presets/route.ts` - Added `positionFlags` to create/update
  5. `src/app/api/meshtastic/config/route.ts` - Added `positionFlags` to config payload
  6. `src/components/dashboard/settings-presets-tab.tsx` - Separated UI for coordinate precision and data flags
  7. `src/components/dashboard/device-setup-tab.tsx` - Same separation of UI controls
- Key value mappings:
  - `positionPrecision=32` → channel position_precision=32 → full precision (~1m)
  - `positionPrecision=14` → channel position_precision=14 → ~1.5km (firmware default)
  - `positionFlags=943` → position_flags=943 → all data (ALT+MSL+GEO+DOP+HVDOP+SAT+SEQ+TS+HEADING+SPEED)
---
Task ID: 27
Agent: main
Task: Фикс positionPrecision — почему при заливке пресета не выставляется максимальная точность местоположения

Work Log:
- Исследована документация Meshtastic 2.7.15: positionPrecision — это настройка КАНАЛА (ChannelSettings.ModuleSettings.position_precision), НЕ позиционного конфига!
- Дефолт прошивки = 13 (~2.9км), а НЕ 14 (~1.5км) как считалось ранее. Проверено по Channels.cpp v2.7.15
- positionPrecision = 32 = максимальная точность (~1-3м GPS точность)
- Найдены и исправлены баги:
  1. techo-bridge.py: убран try/except вокруг записи канала — при ошибке вся транзакция откатывается (раньше тихо игнорировалось, и коммитился конфиг БЕЗ position_precision!)
  2. techo-bridge.py: добавлена немедленная диагностика position_precision после writeChannel(0) для отладки
  3. Скрипты setup-tracker.sh/bat и setup-base.sh/bat: `--set position.position_precision` → `--ch-index 0 --ch-set module_settings.position_precision` (старый путь НЕ работает!)
  4. techo-dump-config.py: кросс-поле баг — positionFlags сравнивался с positionPrecision (разные поля!)
  5. techo-dump-config.py: добавлено чтение и вывод position_precision из channel.settings.module_settings
  6. Все комментарии обновлены: дефолт прошивки = 13 (~2.9км), не 14 (~1.5км)
  7. UI: обновлены метки в settings-presets-tab.tsx и device-setup-tab.tsx

Stage Summary:
- Корневая причина: try/except вокруг записи канала в мосте глотал ошибки, и position_precision молча не записывался → устройство использовало дефолт 13 (~2.9км)
- Дополнительная причина: скрипты использовали неверный путь `--set position.position_precision` вместо `--ch-set module_settings.position_precision`
- Все файлы исправлены, документация обновлена

---
Task ID: 31
Agent: main
Task: Фикс: после factory reset длинное и короткое имя не менялись

Work Log:
- Прочитал PROJECT_RULES.md (правило 4.1: проверять документацию прошивки!)
- Исследовал исходники AdminModule.cpp + NodeDB.cpp прошивки 2.7.15:
  - factory_reset_config (поле 99) → factoryReset() → installDefaultDeviceState() → имя сбрасывается на «Meshtastic XXXX»
  - factory_reset_device (поле 94) → то же + очистка BLE bonds
- Проверил Python-библиотеку meshtastic 2.7.8: setOwner() обрезает short_name до 4 символов (nChars=4), пустая строка вызывает sys.exit()!
- Нашёл корневую причину: после factory reset мост вызывал setOwner() со старым автозаполненным именем → перезаписывал дефолтное
- Исправления:
  1. techo-bridge.py: защита от SystemExit в setOwner(), задержка 5 сек после factory reset, комментарий про nChars=4
  2. settings-presets-tab.tsx: при factory reset поля имени автоматически очищаются, подсказка обновлена
  3. settings-presets-tab.tsx: short_name макс. 4 символа (было 5), обработчик handleFactoryResetChange
  4. config/route.ts: комментарий 5→4 символа
  5. Документация: AI_PROMPT.md, PROJECT_RULES.md, STARTUP.md обновлены

Stage Summary:
- Корневая причина: автозаполнение имени в диалоге → setOwner() перезаписывал дефолтное имя после factory reset
- Вторичная проблема: short_name макс. 4 символа в Python-библиотеке, а UI разрешал 5
- Третичная проблема: setOwner("") вызывает sys.exit() — мост падал бы
- Все три проблемы исправлены, запушено в GitHub

---
Task ID: 32
Agent: main
Task: Установка имени устройства через setOwner без пресета (fix: имя не менялось через диалог редактирования)

Work Log:
- Диагностировал проблему: диалог редактирования узла (карандаш) менял имя только в БД дашборда, не на устройстве. При следующей синхронизации мост перезаписывал имя в БД на реальное с устройства.
- Добавил POST /api/set-owner в techo-bridge.py — вызывает setOwner() на целевом узле без применения пресета, ensureSessionKey() перед вызовом, поддержка локальных и удалённых узлов
- Добавил POST /api/meshtastic/set-owner в API дашборда — пересылает запрос на мост, при успехе обновляет БД
- Обновил node-form-dialog.tsx — добавлена опция «Установить на устройстве» с Checkbox, индикатором статуса моста (Wifi/WifiOff), предупреждением о перезаписи
- Обновил документацию: PROJECT_RULES.md (раздел 4.3.1 — как правильно менять имя), AI_PROMPT.md (задача 32)

Stage Summary:
- Пользователь может теперь менять имя устройства прямо из диалога редактирования, включив чекбокс «Установить на устройстве»
- Без чекбокса имя сохраняется только в БД (как раньше) — будет перезаписано при синхронизации
- Мост получил новый endpoint POST /api/set-owner для установки имени без полного пресета
- CLI-альтернатива: `meshtastic --set-owner "Имя" --set-owner-short "IMYA"`

---
Task ID: 33
Agent: main
Task: Исследовать проблему дрейфа GPS координат у стационарного трекера, добавить fixedPosition, обновить рекомендации

Work Log:
- Исследована документация Meshtastic 2.7.15 и GitHub issues по проблеме GPS дрейфа
- Найдены 4 причины: (1) GPS шум ±3-10м без фильтрации; (2) smart broadcast с малым порогом; (3) gpsUpdateInterval=1 слишком частый; (4) position_precision<32 обфусцирует
- Найдены баги прошивки: #8403 (onGPSChanged перезаписывает fixed_position), #7478 (precision<32 округляет координаты), #836 (T-Echo GPS теряет фикс)
- Добавлено поле fixedPosition (Boolean, default false) в: prisma/schema.prisma, src/lib/builtin-presets.ts, techo-bridge.py, settings-presets-tab.tsx, API роуты (presets/route.ts, config/route.ts)
- В мосте: при fixedPosition=true принудительно gps_mode=DISABLED (баг #8403), диагностика fixed_position после перезагрузки
- В UI: чекбокс «Фиксированная позиция» с Tooltip и Alert-предупреждением, отображение «Фикс. позиция» в карточке пресета, генерация команд/YAML с fixed_position
- Обновлена документация: PROJECT_RULES.md (раздел 4.2: fixedPosition + дрейф GPS + таблица решений + баги), AI_PROMPT.md

Stage Summary:
- Корневая причина дрейфа: Meshtastic не фильтрует GPS + баг #8403 при fixed_position
- Добавлена настройка fixedPosition для стационарных устройств
- Мост автоматически отключает GPS при fixedPosition=true
- Рекомендации: увеличить smartBroadcastMinDist (50-100м), gpsUpdateInterval (30 сек), использовать fixedPosition для стационарных

---
Task ID: 34
Agent: main
Task: Углублённое исследование GPS дрейфа, обновление рекомендаций и пресетов

Work Log:
- Исследована документация Meshtastic 2.7.15 и GitHub issues по проблеме GPS дрейфа
- Найден аппаратный дефект T-Echo (LilyGO issue #32): проводящая сетка внутри замыкает пассивные компоненты GPS-антенны → GPS теряет спутники через 2-5 мин
- Подтверждён баг #836: T-Echo L76K GNSS периодически теряет фикс после нескольких минут работы
- Найдены новые баги: #8029 (GPS lock hold 20 сек), #992 (инверсия знака координат), #6785 (Smart Broadcast спорадическое вещание)
- Прочитана официальная документация position config: дефолты прошивки gpsUpdateInterval=0 (=120 сек), smartBroadcastMinDist=0 (=100 м), smartBroadcastMinInterval=0 (=900 сек)
- Пресет «Трекер лес 12ч» исправлен: gpsUpdateInterval 1→30, smartBroadcastMinDist 20→100, smartBroadcastMinInterval 60→120
- Пресет «Трекер лес 5 дней»: smartBroadcastMinDist 50→100
- Дефолты обновлены в 6 файлах: builtin-presets.ts, prisma/schema.prisma, presets/route.ts, settings-presets-tab.tsx, techo-bridge.py
- Документация обновлена: PROJECT_RULES.md (6 причин по вероятности, таблица сравнения с дефолтами прошивки, 6 багов), AI_PROMPT.md (задача 34)

Stage Summary:
- Главный вывод: симптом «после перезагрузки работает, потом дрейфует» = баг #836 + возможно аппаратный дефект LilyGO #32
- Пресет «Трекер лес 12ч» имел критически неверные настройки: gpsUpdateInterval=1 (GPS не успевает), smartBroadcastMinDist=20 (GPS шум превышает порог)
- Все дефолты приведены к рекомендациям дефолтов прошивки Meshtastic
- Для стационарных устройств рекомендуется fixedPosition=true + gps_mode=DISABLED

---
Task ID: 35
Agent: main
Task: Изменить порядок прошивки пресетом: полная очистка → 20с → reconnect → имя → 20с → остальные данные → reboot

Work Log:
- Прочитал текущую реализацию apply_config_to_node() в techo-bridge.py (~450 строк)
- Проанализировал текущий порядок: factory reset → 20с → reconnect → setOwner (5с задержка) → ensureSessionKey → транзакция → commit → reboot
- Перестроил порядок в apply_config_to_node():
  - ШАГ 1: Factory reset → 20 сек ожидание → _reconnect_interface() (без изменений)
  - ШАГ 2: setOwner (новое имя) → ensureSessionKey → reboot(secs=2) → 20 сек ожидание → _reconnect_interface() (НОВОЕ!)
  - ШАГ 3: ensureSessionKey → beginTransaction → writeConfig × N → commit → reboot (как раньше)
- При factory_reset=False: setOwner без перезагрузки (как раньше) → транзакция → reboot
- Увеличен таймаут API: 120 сек → 180 сек (добавился этап перезагрузки после имени)
- Обновлён UI диалога пуша: описание нового порядка в DialogDescription и в подсказке factory reset
- Обновлена документация: AI_PROMPT.md (порядок прошивки)

Stage Summary:
- Новый порядок при factory reset: очистка → 20с → имя → 20с → конфиг → reboot
- Ключевое изменение: setOwner теперь выполняется как отдельный шаг с перезагрузкой при factory reset
- Это гарантирует, что устройство корректно инициализируется с новым именем перед записью конфигурации
- Файлы: techo-bridge.py, src/app/api/meshtastic/config/route.ts, src/components/dashboard/settings-presets-tab.tsx, AI_PROMPT.md
