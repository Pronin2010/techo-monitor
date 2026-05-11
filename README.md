# T-Echo Meshtastic Monitor

> Дашборд мониторинга Mesh-сети 433 МГц на T-Echo устройствах

Веб-приложение для мониторинга, настройки и управления Mesh-сетью на базе T-Echo устройств с прошивкой Meshtastic. Обеспечивает визуализацию топологии сети, управление каналами и пресетами, потоковый просмотр пакетов в реальном времени, а также **удалённую отправку конфигурации на устройства** через Python-мост.

> **Платформа: только десктоп** — проект используется исключительно на компьютере, мобильная адаптация не требуется.
> **MQTT не используется** — подключение только через USB (serial), удалённый мониторинг через интернет не нужен.

## Возможности

Проект включает **7 вкладок** дашборда:

| Вкладка | Описание |
|---------|----------|
| **Статус** | Сводная информация об узлах сети: заряд батареи, SNR, RSSI, время последнего отклика |
| **Карта** | Интерактивная карта Leaflet + OpenStreetMap с позициями узлов |
| **Каналы** | Управление каналами Mesh-сети: настройки частоты, модуляции, региона |
| **Подключение** | Подключение к T-Echo устройствам через последовательный порт / BLE |
| **Настройка** | Конфигурация параметров устройства: имя, роль, тайминги |
| **Пресеты** | Готовые и пользовательские пресеты + отправка конфигурации на устройство через мост (с установкой имени, транзакционное применение с откатом при ошибке) |
| **Пакеты** | Потоковый мониторинг пакетов Mesh-сети в реальном времени |

## Технологический стек

- **Next.js 16** — фреймворк с App Router и серверными API-маршрутами
- **TypeScript 5** — статическая типизация
- **Tailwind CSS 4** + **shadcn/ui** — компонентная библиотека и стилизация
- **Prisma ORM** + **SQLite** — база данных и ORM
- **Leaflet** + **OpenStreetMap** — интерактивные карты

## Быстрый старт

Подробные инструкции по установке и запуску см. в [STARTUP.md](./STARTUP.md).

```bash
# Клонирование репозитория
git clone <repo-url>
cd t-echo-meshtastic-monitor

# Установка зависимостей
npm install

# Инициализация базы данных
npx prisma db push

# Запуск в режиме разработки
npm run dev
```

## Скриншоты

<!-- TODO: Добавить скриншоты дашборда
![Дашборд T-Echo Meshtastic Monitor](./docs/screenshots/dashboard.png)
![Карта узлов](./docs/screenshots/map.png)
![Поток пакетов](./docs/screenshots/packets.png)
-->

## Структура проекта

```
src/
├── app/
│   ├── page.tsx                  # Главная страница (дашборд)
│   ├── layout.tsx                # Корневой layout
│   ├── globals.css               # Глобальные стили
│   └── api/
│       ├── nodes/                # REST API узлов сети
│       ├── channels/             # REST API каналов
│       ├── presets/              # REST API пресетов
│       ├── packets/              # REST API пакетов (in-memory buffer)
│       ├── telemetry/            # REST API телеметрии
│       ├── sync-log/             # REST API логов синхронизации
│       └── meshtastic/           # API синхронизации, скриптов, отправки конфигурации, set-owner
├── components/
│   ├── dashboard/                # Компоненты дашборда
│   │   ├── dashboard-client.tsx  # Клиентский контейнер
│   │   ├── dashboard-page.tsx    # Страница дашборда
│   │   ├── node-status-card.tsx  # Карточка узла (аккордеон + телеметрия)
│   │   ├── map-view.tsx          # Вкладка карты (dynamic import)
│   │   ├── map-leaflet.tsx       # Leaflet-карта + KMZ/KML overlay
│   │   ├── channel-settings.tsx  # Настройки каналов + QR
│   │   ├── connection-tab.tsx    # Подключение к устройству (Serial/MQTT)
│   │   ├── device-setup-tab.tsx  # Настройка устройства (CLI/YAML генератор)
│   │   ├── settings-presets-tab.tsx # Пресеты + push-to-device
│   │   ├── packet-stream-tab.tsx # Поток пакетов
│   │   └── node-form-dialog.tsx  # Диалог редактирования узла
│   └── ui/                       # shadcn/ui компоненты
├── hooks/                        # React-хуки
├── lib/
│   ├── db.ts                     # Prisma Client (singleton)
│   ├── types.ts                  # TypeScript типы + константы Meshtastic
│   ├── utils.ts                  # cn() + serializeBigInt()
│   ├── kmz-parser.ts             # KMZ/KML → GeoJSON парсер (fflate + @tmcw/togeojson)
│   ├── device-profiles.ts        # Профили устройств (T-Echo, Heltec Tracker V1.1)
│   └── builtin-presets.ts        # Встроенные пресеты
└── prisma/
    └── schema.prisma             # Схема базы данных
techo-bridge.py                   # Python-мост (Serial → HTTP API :8420)
techo-dump-config.py              # Скрипт чтения конфигурации устройства
AI_PROMPT.md                      # Контекст проекта для AI-ассистента
PROJECT_RULES.md                  # Правила проекта
STARTUP.md                        # Инструкция по установке
worklog.md                        # История разработки

## Документация

| Файл | Описание |
|------|----------|
| [AI_PROMPT.md](./AI_PROMPT.md) | Полный контекст проекта для AI-ассистента |
| [STARTUP.md](./STARTUP.md) | Инструкция по установке, настройке и эксплуатации |
| [PROJECT_RULES.md](./PROJECT_RULES.md) | Правила проекта (Git, язык, архитектура, код) |
| [worklog.md](./worklog.md) | История разработки (выполненные задачи) |

## Лицензия

MIT
