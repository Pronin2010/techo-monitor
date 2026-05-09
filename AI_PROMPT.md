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

---

## 2. Технологический стек

- **Next.js 16** (App Router) + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** (New York style) + **Lucide** иконки
- **Prisma ORM** + **SQLite** (файл `db/custom.db`)
- **Leaflet** + **OpenStreetMap** — интерактивные карты
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
│       └── meshtastic/           # sync, bridge, script, config
├── components/
│   ├── dashboard/                # 11 компонентов дашборда
│   │   ├── dashboard-client.tsx  # Главный клиентский контейнер (7 вкладок)
│   │   ├── dashboard-page.tsx    # Обёртка (передаёт initialNodes=[])
│   │   ├── node-status-card.tsx  # Строка узла с аккордеоном
│   │   ├── node-form-dialog.tsx  # Диалог редактирования узла
│   │   ├── map-view.tsx          # Вкладка карты (dynamic import)
│   │   ├── map-leaflet.tsx       # Leaflet-карта
│   │   ├── channel-settings.tsx  # Настройки каналов + QR
│   │   ├── connection-tab.tsx    # Подключение (Serial/MQTT, лог синхронизаций)
│   │   ├── device-setup-tab.tsx  # Генератор CLI-команд и YAML
│   │   ├── settings-presets-tab.tsx # Пресеты + push-to-device (~1000 строк)
│   │   └── packet-stream-tab.tsx # Поток пакетов
│   └── ui/                       # shadcn/ui примитивы
├── hooks/                        # use-toast, use-mobile
├── lib/
│   ├── db.ts                     # Prisma Client (singleton, dev query logging)
│   ├── types.ts                  # TypeScript типы + константы Meshtastic
│   ├── utils.ts                  # cn() + serializeBigInt()
│   └── builtin-presets.ts        # 4 встроенных пресета
prisma/
└── schema.prisma                 # 6 моделей: Node, Channel, Telemetry, ConnectionConfig, Preset, SyncLog
techo-bridge.py                   # Python-мост (Serial/MQTT → HTTP API :8420)
techo-dump-config.py              # Скрипт чтения конфигурации устройства (standalone)
```

---

## 4. 7 вкладок дашборда

| Вкладка | Иконка | Описание |
|---------|--------|----------|
| **Статус** | Activity | Карточки узлов: батарея, SNR, RSSI, поиск, аккордеон-детали |
| **Карта** | Map | Leaflet + OSM, маркеры по ролям, линии связи |
| **Каналы** | Settings | PSK 256 бит, модем-пресет, регион 433 МГц, QR-коды |
| **Подключение** | Cable | Serial/MQTT выбор, команда запуска, лог синхронизаций |
| **Настройка** | Cpu | Генератор CLI-команд и YAML для meshtastic 2.7.15 |
| **Пресеты** | Cpu | Системные/пользовательские + push-to-device через мост |
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

### Ключевые изменения 2.7.15
- Телеметрия отключена по умолчанию
- Прямые сообщения только через PKI
- Traffic Management включён по умолчанию
- `gps_enabled` → `position.gps_mode`
- `REPEATER`, `ROUTER_CLIENT` — устарели
- Новые пресеты: LITE_FAST/SLOW, NARROW_FAST/SLOW

---

## 7. Схема базы данных (6 моделей)

```
Node ──< Telemetry
  nodeId: BigInt @unique
  name, shortName, hardwareModel, role, status
  batteryLevel?, voltage?, usbPower, snr, rssi
  latitude?, longitude?, altitude?
  lsSecs?, minWakeSecs?, lastSeen

Channel ──< ConnectionConfig
        ──< Preset
  index, name, psk, uplink, downlink
  modemPreset, region, frequency?, isDefault

Telemetry
  nodeId → Node, batteryLevel?, voltage?, snr, rssi
  temperature?, humidity?, latitude?, longitude?, altitude?

ConnectionConfig
  type (serial/mqtt/disabled), serialPort, mqttBroker
  mqttTopic, mqttUsername, mqttPassword, channelId? → Channel
  isEnabled, lastSync?, status

Preset
  name, description?, icon, role, powerSaving, lsSecs, minWakeSecs
  gpsMode, gpsUpdateInterval, agpsEnabled, gpsAttemptTime
  positionPrecision, positionBroadcastSecs, smartBroadcast*
  telemetryInterval, region, modemPreset, txPower, hopLimit, usePreamble
  bluetoothEnabled, bluetoothFixedPin?, screenOnSecs, ledDisabled
  rebroadcastMode, channelId? → Channel
  isBuiltIn, builtinId? @unique

SyncLog
  source, nodeId?, nodeName?, action, eventType?, details?
```

---

## 8. Python-мост (techo-bridge.py)

- Режимы: `--mode serial` / `--mode mqtt`
- HTTP API на порту **8420** (`--api-port`)
- **POST /api/apply-config** — применение конфигурации на устройство
  - Параметры: role, region, modemPreset, lsSecs, minWakeSecs, gpsMode, agpsEnabled, и т.д.
  - deviceName, deviceShortName — установка имени через setOwner()
  - factoryReset — сброс до заводских перед применением (ensureSessionKey + factory_reset_config=1, баг библиотеки: True→TypeError)
  - Порядок: factoryReset → device reboot → _reconnect_interface() → setOwner → beginTransaction → writeConfig × N → commit → reboot
  - При ошибке записи — перезагрузка для отката (вместо commit частичных данных)
  - При factory reset — автоматическое пересоздание SerialInterface с повторными попытками
  - После перезагрузки устройства (reboot) — мост автоматически переподключается для продолжения мониторинга
- **GET /api/status** — статус моста и список узлов (nodeId в hex-формате `!a1b2c3d4`)
- **GET /api/device-config** — полная конфигурация устройства (все секции + каналы + владелец) для диагностики и сопоставления с пресетами
- Транзакционное применение: все настройки в одной транзакции
- Fallback: writeModuleConfig() для старых версий meshtastic-библиотеки

---

## 9. Текущее состояние (из worklog)

### Выполнено (17 задач):
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

### Известные проблемы (из ревью):
- Нет аутентификации на API-роутах
- Python-мост слушает 0.0.0.0 вместо 127.0.0.1
- Дублирование констант в 3 местах
- settings-presets-tab.tsx ~1000 строк (монстр)
- Нет AlertDialog при удалении канала

---

## 10. Константы Meshtastic (кратко)

### Модем-пресеты (12)
LONG_FAST, LONG_MODERATE, LONG_TURBO, MEDIUM_FAST, MEDIUM_SLOW,
SHORT_FAST, SHORT_SLOW, SHORT_TURBO, LITE_FAST, LITE_SLOW, NARROW_FAST, NARROW_SLOW

### Регионы 433 МГц (6)
EU_433 (основной, Россия/СНГ), ANZ_433, UA_433, KZ_433, PH_433, MY_433

### GPS Mode (3)
ENABLED, DISABLED, NOT_PRESENT

### Rebroadcast Mode (3)
ALL, LOCAL_SKIP, SIMPLE

---

_Последнее обновление: 2026-05-09 (techo-dump-config.py + GET /api/device-config)_
