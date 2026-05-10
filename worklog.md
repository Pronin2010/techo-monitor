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
