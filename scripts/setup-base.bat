@echo off
chcp 65001 >nul 2>&1
REM ============================================================
REM  Настройка T-Echo BASE станции для леса
REM  Прошивка: 2.7.15 | Диапазон: 433 МГц | Роль: ROUTER
REM ============================================================
REM
REM  BASE: подключена к ПК по USB, передаёт данные в дашборд
REM  через Python-мост (techo-bridge.py). GPS не нужен (в помещении).
REM  Всегда бодрствует, ретранслирует все пакеты.
REM
REM  Использование:
REM    setup-base.bat
REM
REM  Или укажи порт:
REM    setup-base.bat COM5
REM ============================================================

set PORT=
if not "%~1"=="" set PORT=--port %1

echo ============================================================
echo   Настройка T-Echo BASE (ROUTER + ПК + дашборд)
echo ============================================================
echo.

echo [1/10] Роль устройства: ROUTER
meshtastic %PORT% --set device.role ROUTER

echo [2/10] GPS: NOT_PRESENT (в помещении, не нужен)
meshtastic %PORT% --set position.gps_mode NOT_PRESENT

echo [3/10] Точность позиции: 0 (не отправлять координаты) — настройка КАНАЛА
meshtastic %PORT% --ch-index 0 --ch-set module_settings.position_precision 0
meshtastic %PORT% --set position.position_broadcast_secs 900

echo [4/10] Модем-пресет: LONG_MODERATE (должен совпадать с трекерами!)
meshtastic %PORT% --set lora.modem_preset LONG_MODERATE
meshtastic %PORT% --set lora.region EU_433
meshtastic %PORT% --set lora.hop_limit 5
meshtastic %PORT% --set lora.tx_power 0
meshtastic %PORT% --set lora.sx126x_rx_boosted_gain true

echo [5/10] Ретрансляция: ALL (все пакеты)
meshtastic %PORT% --set network.rebroadcast_mode ALL

echo [6/10] Телеметрия: каждые 5 мин (для дашборда)
meshtastic %PORT% --set telemetry.device_update_interval 300

echo [7/10] Node info: каждые 15 мин
meshtastic %PORT% --set device.node_info_broadcast_secs 900

echo [8/10] Дисплей: 5 мин (экран всегда доступен)
meshtastic %PORT% --set display.screen_on_secs 300

echo [9/10] Bluetooth: вкл (для настройки в поле), LED: вкл (статус)
meshtastic %PORT% --set bluetooth.enabled true
meshtastic %PORT% --set device.led_heartbeat_disabled false

echo [10/10] Перезагрузка устройства...
meshtastic %PORT% --reboot

echo.
echo ============================================================
echo   BASE настроен!
echo.
echo   Роль:         ROUTER (всегда бодрствует, ретранслирует)
echo   GPS:          NOT_PRESENT (в помещении)
echo   Модем:        LONG_MODERATE
echo   hop_limit:    5
echo   Телеметрия:   каждые 5 мин
echo.
echo   Подключи к ПК по USB и запусти:
echo     python techo-bridge.py --port COM5
echo.
echo   Все узлы должны использовать одинаковый modem_preset!
echo ============================================================
pause
