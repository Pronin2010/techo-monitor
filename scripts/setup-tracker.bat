@echo off
chcp 65001 >nul 2>&1
REM ============================================================
REM  Настройка T-Echo трекера для леса (12 часов, без сна)
REM  Прошивка: 2.7.15 | Диапазон: 433 МГц | Роль: TRACKER
REM ============================================================
REM
REM  Автономный режим: без телефона, без интернета, без внешних антенн
REM  GPS Quectel L76K: EASY™ прогноз орбит (3 дня), горячий старт 2 сек
REM  Автономность: ~20 часов на 850 мАч (GPS всегда включён)
REM
REM  Использование:
REM    Подключи T-Echo по USB и запусти:
REM    setup-tracker.bat
REM
REM  Или укажи порт:
REM    setup-tracker.bat COM5
REM ============================================================

set PORT=
if not "%~1"=="" set PORT=--port %1

echo ============================================================
echo   Настройка T-Echo TRACKER для леса (12ч, без сна)
echo   Автономный режим: GPS всегда включён, EASY прогноз орбит
echo ============================================================
echo.

echo [1/12] Роль устройства: TRACKER
meshtastic %PORT% --set device.role TRACKER

echo [2/12] Интервал позиции: 60 сек
meshtastic %PORT% --set position.position_broadcast_secs 60

echo [3/12] Smart broadcast: вкл (20м / 60сек)
meshtastic %PORT% --set position.smart_broadcast_enabled true
meshtastic %PORT% --set position.broadcast_smart_minimum_distance 20
meshtastic %PORT% --set position.broadcast_smart_minimum_interval_secs 60

echo [4/12] GPS: включён, обновление каждые 15 сек
meshtastic %PORT% --set position.gps_mode ENABLED
meshtastic %PORT% --set position.gps_update_interval 15

echo [5/12] GPS attempt time: 90 сек (больше времени для леса)
meshtastic %PORT% --set position.gps_attempt_time 90

echo [6/12] Position flags: 939 (с меткой времени)
meshtastic %PORT% --set position.position_flags 939

echo [7/12] Точность позиции: 32 (полная точность)
meshtastic %PORT% --set position.position_precision 32

echo [8/12] Питание: без экономии (всегда бодрствует)
meshtastic %PORT% --set power.is_power_saving false

echo [9/12] Модем-пресет: LONG_MODERATE (+40%% дальности в лесу)
meshtastic %PORT% --set lora.modem_preset LONG_MODERATE
meshtastic %PORT% --set lora.region EU_433
meshtastic %PORT% --set lora.hop_limit 5
meshtastic %PORT% --set lora.tx_power 0
meshtastic %PORT% --set lora.sx126x_rx_boosted_gain true

echo [10/12] Телеметрия: каждые 5 мин, node_info: каждые 15 мин
meshtastic %PORT% --set telemetry.device_update_interval 300
meshtastic %PORT% --set device.node_info_broadcast_secs 900

echo [11/12] Дисплей: 60 сек, LED: выключен, Bluetooth: вкл
meshtastic %PORT% --set display.screen_on_secs 60
meshtastic %PORT% --set device.led_heartbeat_disabled true
meshtastic %PORT% --set bluetooth.enabled true

echo [12/12] Перезагрузка устройства...
meshtastic %PORT% --reboot

echo.
echo ============================================================
echo   Трекер настроен!
echo.
echo   Роль:         TRACKER (без сна)
echo   GPS:          включён, 15 сек обновление
echo   Позиция:      smart broadcast (20м / 60сек)
echo   Модем:        LONG_MODERATE
echo   hop_limit:    5
echo   Точность:     32 (полная)
echo   Автономность: ~20 часов (850 мАч)
echo.
echo   Внимание: GPS всегда включён для горячего старта (2 сек).
echo   Холодный старт в лесу = 2-5 минут!
echo.
echo   BASE тоже переключи на LONG_MODERATE:
echo      setup-base.bat
echo ============================================================
pause
