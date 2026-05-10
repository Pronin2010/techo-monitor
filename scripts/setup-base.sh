#!/bin/bash
# ============================================================
#  Настройка T-Echo BASE станции для леса
#  Прошивка: 2.7.15 | Диапазон: 433 МГц | Роль: ROUTER
# ============================================================
#
#  BASE: подключена к ПК по USB, передаёт данные в дашборд
#  через Python-мост (techo-bridge.py). GPS не нужен (в помещении).
#  Всегда бодрствует, ретранслирует все пакеты.
#
#  Использование:
#    bash setup-base.sh
#
#  Или укажи порт:
#    bash setup-base.sh --port /dev/ttyUSB0
# ============================================================

PORT=""
if [ "$1" = "--port" ] && [ -n "$2" ]; then
  PORT="--port $2"
fi

echo "============================================================"
echo "  Настройка T-Echo BASE (ROUTER + ПК + дашборд)"
echo "============================================================"
echo ""

echo "[1/10] Роль устройства: ROUTER"
meshtastic $PORT --set device.role ROUTER

echo "[2/10] GPS: NOT_PRESENT (в помещении, не нужен)"
meshtastic $PORT --set position.gps_mode NOT_PRESENT

echo "[3/10] Точность позиции: 0 (не отправлять координаты) — настройка КАНАЛА"
meshtastic $PORT --ch-index 0 --ch-set module_settings.position_precision 0
meshtastic $PORT --set position.position_broadcast_secs 900

echo "[4/10] Модем-пресет: LONG_MODERATE (должен совпадать с трекерами!)"
meshtastic $PORT --set lora.modem_preset LONG_MODERATE
meshtastic $PORT --set lora.region EU_433
meshtastic $PORT --set lora.hop_limit 5
meshtastic $PORT --set lora.tx_power 0
meshtastic $PORT --set lora.sx126x_rx_boosted_gain true

echo "[5/10] Ретрансляция: ALL (все пакеты)"
meshtastic $PORT --set network.rebroadcast_mode ALL

echo "[6/10] Телеметрия: каждые 5 мин (для дашборда)"
meshtastic $PORT --set telemetry.device_update_interval 300

echo "[7/10] Node info: каждые 15 мин"
meshtastic $PORT --set device.node_info_broadcast_secs 900

echo "[8/10] Дисплей: 5 мин (экран всегда доступен)"
meshtastic $PORT --set display.screen_on_secs 300

echo "[9/10] Bluetooth: вкл (для настройки в поле), LED: вкл (статус)"
meshtastic $PORT --set bluetooth.enabled true
meshtastic $PORT --set device.led_heartbeat_disabled false

echo "[10/10] Перезагрузка устройства..."
meshtastic $PORT --reboot

echo ""
echo "============================================================"
echo "  BASE настроен!"
echo ""
echo "  Роль:         ROUTER (всегда бодрствует, ретранслирует)"
echo "  GPS:          NOT_PRESENT (в помещении)"
echo "  Модем:        LONG_MODERATE"
echo "  hop_limit:    5"
echo "  Телеметрия:   каждые 5 мин"
echo ""
echo "  Подключи к ПК по USB и запусти:"
echo "    python techo-bridge.py --port /dev/ttyUSB0"
echo ""
echo "  Все узлы должны использовать одинаковый modem_preset!"
echo "============================================================"
