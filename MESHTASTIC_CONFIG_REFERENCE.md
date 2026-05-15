# Справочник конфигурации Meshtastic v2.7.15

> Полный референс всех настроек прошивки Meshtastic 2.7.15, которые можно передать на устройство через YAML-файл.

---

## Файл конфигурации

**Путь:** `meshtastic-config-reference.yaml` (в корне проекта)

**Применение:**
```bash
meshtastic --configure meshtastic-config-reference.yaml
```

**Альтернатива — CLI по одной настройке:**
```bash
meshtastic --set config.section.field value
```

---

## Источник данных

Все поля и значения взяты из **protobuf-определений** прошивки 2.7.15:
- Репозиторий: https://github.com/meshtastic/protobufs/tree/v2.7.15
- `meshtastic/config.proto` — основная конфигурация (Device, Position, Power, Network, Display, LoRa, Bluetooth, Security, DeviceUI)
- `meshtastic/module_config.proto` — модули (MQTT, Serial, ExternalNotification, StoreForward, RangeTest, Telemetry, CannedMessage, Audio, RemoteHardware, NeighborInfo, AmbientLighting, DetectionSensor, Paxcounter)
- `meshtastic/channel.proto` — каналы (ChannelSettings, ModuleSettings)
- `meshtastic/device_ui.proto` — настройки TFT/BaseUI

---

## Правила YAML-ключей

Meshtastic Python-библиотека конвертирует protobuf snake_case в YAML camelCase:
```python
def snake_to_camel(a_string):
    temp = a_string.split("_")
    return temp[0] + "".join(ele.title() for ele in temp[1:])
```

| Protobuf (snake_case) | YAML (camelCase) |
|----------------------|------------------|
| `gps_update_interval` | `gpsUpdateInterval` |
| `position_broadcast_secs` | `positionBroadcastSecs` |
| `tx_enabled` | `txEnabled` |
| `hop_limit` | `hopLimit` |
| `modem_preset` | `modemPreset` |
| `is_power_saving` | `isPowerSaving` |
| `sx126x_rx_boosted_gain` | `sx126xRxBoostedGain` |

---

## Структура YAML-файла

```
meshtastic-config-reference.yaml
├── owner / owner_short / channel_url / canned_messages / ringtone / location
├── config:
│   ├── bluetooth:        3 поля
│   ├── device:          11 полей
│   ├── display:         11 полей
│   ├── lora:            16 полей
│   ├── network:         11 полей + вложенные
│   ├── position:        13 полей
│   ├── power:            9 полей
│   ├── security:         7 полей
│   └── device_ui:       18+ полей + вложенные
└── module_config:
    ├── mqtt:                   11 полей + вложенные
    ├── serial:                  8 полей
    ├── external_notification:  16 полей
    ├── store_forward:           6 полей
    ├── range_test:              4 поля
    ├── telemetry:              14 полей
    ├── canned_message:          9 полей
    ├── audio:                   7 полей
    ├── remote_hardware:         2+ поля
    ├── neighbor_info:           3 поля
    ├── ambient_lighting:        5 полей
    ├── detection_sensor:        8 полей
    └── paxcounter:              4 поля
```

**Итого: ~190+ настраиваемых полей**

---

## Приоритеты настроек для T-Echo

### Критичные для работы сети
| Поле | Рекомендация | Причина |
|------|-------------|---------|
| `config.lora.modemPreset` | `LONG_MODERATE` | Лучший баланс для леса |
| `config.lora.hopLimit` | 5-7 | Дефолт 3 — мало для пересечённой местности |
| `config.device.role` | `TRACKER` / `CLIENT_BASE` | Определяет всё поведение |
| `config.lora.region` | `EU_433` | 433 МГц для России/СНГ |

### Критичные для позиционирования
| Поле | Рекомендация | Причина |
|------|-------------|---------|
| `config.position.gpsUpdateInterval` | ≥30 (сек) | L76K не успевает <30 сек |
| `config.position.positionFlags` | 299 (пеший) | Без SPEED (ненадёжно пешком) |
| `config.position.positionBroadcastSmartEnabled` | true | Экономит эфир |
| `config.position.broadcastSmartMinimumDistance` | 100 (м) | Меньше = GPS-шум |

### Критичные для батареи
| Поле | Рекомендация | Причина |
|------|-------------|---------|
| `config.power.isPowerSaving` | true (для TRACKER) | Спит между вещаниями |
| `config.display.screenOnSecs` | 30-60 | Меньше = дольше батарея |
| `config.bluetooth.enabled` | false (для автонома) | BT расходует ~5 мА |

### Для стационарного трекера
| Поле | Рекомендация | Причина |
|------|-------------|---------|
| `config.position.fixedPosition` | true | Не обновлять GPS |
| `config.position.gpsMode` | DISABLED | Баг #8403: иначе перезапишет |
| `config.position.positionBroadcastSmartEnabled` | false | Не нужен для статики |

---

## Deprecated-поля (НЕ ИСПОЛЬЗОВАТЬ в 2.7.15)

| Поле | Причина deprecated | Альтернатива |
|------|-------------------|-------------|
| `config.device.serialEnabled` | Перенесено в SecurityConfig | `config.security.serialEnabled` |
| `config.device.isManaged` | Перенесено в SecurityConfig | `config.security.isManaged` |
| `config.position.gpsEnabled` | Заменено на gpsMode | `config.position.gpsMode` |
| `config.position.gpsAttemptTime` | Убрано | smart/regular broadcast interval |
| `config.display.gpsFormat` | Перенесено в DeviceUI | `config.device_ui.gpsFormat` |
| `config.display.compassNorthTop` | Убрано | `config.display.compassOrientation` |
| `config.device.role=ROUTER_CLIENT` | Deprecated v2.3.15 | `ROUTER` или `CLIENT` |
| `config.device.role=REPEATER` | Deprecated v2.7.11 | Создаёт «дыры» в mesh |
| `config.lora.modemPreset=VERY_LONG_SLOW` | Deprecated v2.5 | Неработоспособно |
| `module_config.canned_message.enabled` | Убрано | `allow_input_source` (тоже deprecated) |
| `module_config.canned_message.allowInputSource` | Убрано | — |

---

## Связь с проектом

YAML-файл используется:
1. **Вручную** — для быстрой настройки устройства через CLI
2. **Из дашборда** — вкладка «Пресеты» → генерация YAML → отправка через Python-мост
3. **Как справочник** — при разработке нового функционала, работающего с конфигурацией устройства

---

## Ссылки

- Официальная документация: https://meshtastic.org/docs/configuration
- Protobuf v2.7.15: https://buf.build/meshtastic/protobufs/docs/v2.7.4:meshtastic
- Исходники прошивки: https://github.com/meshtastic/firmware/tree/v2.7.15
- Пример YAML: https://github.com/meshtastic/python/blob/master/example_config.yaml

---

_Последнее обновление: 2026-05-12_
