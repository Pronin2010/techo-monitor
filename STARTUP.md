# T-Echo Monitor — Инструкция по установке

## Монтаж и управление Meshtastic сетью 433 МГц

---

## Быстрый старт (5 минут)

### 1. Установите Bun

**Windows (PowerShell):**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

**macOS / Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

> Альтернатива: можно использовать **Node.js 20+** вместо Bun.
> Скачайте с https://nodejs.org → кнопка «LTS»

### 2. Распакуйте архив

Распакуйте `techo-monitor.zip` в любую папку.

### 3. Откройте терминал в папке проекта

**Windows:** Откройте папку → нажмите `Ctrl+L` → введите `cmd` → Enter

**macOS:** Откройте Terminal → перетащите папку в окно терминала

**Linux:** Правый клик в папке → «Открыть терминал»

### 4. Запустите команды

```bash
# Установите зависимости (1-2 минуты)
bun install

# Создайте базу данных
bun run db:push

# Запустите сервер
bun run dev
```

### 5. Откройте в браузере

```
http://localhost:3000
```

Вы увидите дашборд с 3 демо-узлами (Base Station, Tracker Alpha, Tracker Bravo).

---

## Если используете Node.js вместо Bun

```bash
# Установите зависимости
npm install

# Создайте базу данных
npx prisma db push

# Запустите сервер
npm run dev
```

---

## Структура дашборда

### Вкладка «Статус»
- Карточки всех устройств: батарея, сигнал (SNR/RSSI), роль, режим сна
- Роли: ROUTER (ядро сети), REPEATER (ретранслятор), TRACKER (GPS-трекер), CLIENT
- Индикаторы: бодрствует/спит, ретранслирует/только свои

### Вкладка «Карта»
- Позиции устройств на карте (Leaflet/OpenStreetMap)
- Маркеры с цветами по ролям
- Линии связи между узлами

### Вкладка «Каналы»
- Настройки каналов: PSK-ключи, модем-пресет, регион
- QR-коды для быстрого подключения трекеров
- Uplink/Downlink настройки

### Вкладка «Подключение»
- Пошаговая инструкция настройки T-Echo на 433 МГц
- Команды для прошивки и конфигурации
- Скрипт-мост techo-bridge.py для связи с устройствами по USB

---

## Подключение реальных T-Echo

### Способ 1: Через USB (рекомендуется)

1. Подключите Base Station (ROUTER) к компьютеру по USB
2. Установите Python-зависимости:
   ```bash
   pip install meshtastic requests
   ```
3. Запустите скрипт-мост:
   ```bash
   python techo-bridge.py --mode serial --port /dev/ttyUSB0 --dashboard http://localhost:3000
   ```
   - Linux: `/dev/ttyUSB0`
   - macOS: `/dev/cu.usbmodem*`
   - Windows: `COM3` (проверьте в Диспетчере устройств)

4. Скрипт автоматически обнаружит все устройства в mesh-сети

### Способ 2: Через MQTT

```bash
python techo-bridge.py --mode mqtt --broker localhost --topic msh/EU_433/# --dashboard http://localhost:3000
```

---

## Настройка нового T-Echo

### Быстрая настройка (через компьютер):

```bash
# Установите регион 433 МГц
python -m meshtastic --set lora.region EU_433

# Установите роль
python -m meshtastic --set device.role ROUTER    # для Base Station
python -m meshtastic --set device.role TRACKER    # для трекера

# Настройте интервал сна (для трекеров)
python -m meshtastic --set power.ls_secs 300      # 5 минут
python -m meshtastic --set power.ls_secs 2700     # 45 минут

# Включите GPS
python -m meshtastic --set gps.enabled true --set gps.update_interval 30

# Создайте приватный канал
python -m meshtastic --ch-add forest-track --ch-set psk --ch-set modem_preset LongModerate
```

### Быстрая настройка (через телефон):
1. Скачайте приложение **Meshtastic** (Android/iOS)
2. Подключитесь к T-Echo по Bluetooth
3. Device Settings → LoRa → Region → **EU_433**
4. Device Settings → Device Role → **ROUTER** / **TRACKER**
5. Channel Settings → «+ New channel» → Private → название: `forest-track`

---

## Рекомендуемая конфигурация для леса

| Устройство | Роль | Интервал сна | Модем | Примечание |
|------------|------|-------------|-------|------------|
| Base Station | ROUTER | Не спит | LongModerate | Подключён к ПК по USB |
| Repeater | REPEATER | Не спит | LongModerate | На холме/дереве |
| Tracker Alpha | TRACKER | 5 мин (300 сек) | LongModerate | В лесу |
| Tracker Bravo | TRACKER | 45 мин (2700 сек) | LongModerate | В лесу |

**Разные интервалы сна** на трекерах = выше шанс, что хотя бы один бодрствует.

---

## Частые проблемы

### «Не удалось загрузить данные»
- Проверьте, что сервер запущен: `bun run dev`
- Проверьте, что база данных создана: `bun run db:push`

### «Устройство не видно по USB»
- Linux: `ls /dev/ttyUSB*` — если пусто, проверьте кабель и драйверы
- macOS: `ls /dev/cu.usbmodem*`
- Windows: Диспетчер устройств → Порты COM
- Попробуйте другой USB-кабель (нужен кабель с передачей данных!)

### «Не вижу другие узлы»
- Убедитесь, что **регион одинаковый** на всех устройствах (EU_433)
- Убедитесь, что **канал и PSK одинаковые**
- Проверьте, что антенна подключена

---

## Техническая информация

- **Фреймворк:** Next.js 16 + TypeScript 5
- **База данных:** SQLite (Prisma ORM)
- **UI:** Tailwind CSS + shadcn/ui
- **Карта:** Leaflet + OpenStreetMap
- **Порт:** 3000 (можно изменить в package.json)
