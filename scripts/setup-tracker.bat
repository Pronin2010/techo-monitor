@echo off
chcp 65001 >nul 2>&1
REM ============================================================
REM  Настройка T-Echo трекера для леса (12 часов, без сна)
REM  Прошивка: 2.7.15 | Диапазон: 433 МГц | Роль: TRACKER
REM ============================================================
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
echo ============================================================
echo.

echo [1/9] Роль устройства: TRACKER
meshtastic %PORT% --set device.role TRACKER

echo [2/9] Интервал позиции: 60 сек
meshtastic %PORT% --set position.position_broadcast_secs 60

echo [3/9] Smart broadcast: вкл (20м / 60сек)
meshtastic %PORT% --set position.smart_broadcast_enabled true
meshtastic %PORT% --set position.smart_broadcast_min_distance 20
meshtastic %PORT% --set position.smart_broadcast_min_interval 60

echo [4/9] GPS обновление: каждые 15 сек
meshtastic %PORT% --set position.gps_update_interval 15

echo [5/9] Position flags: 939 (с меткой времени)
meshtastic %PORT% --set position.position_flags 939

echo [6/9] Питание: без экономии (всегда бодрствует)
meshtastic %PORT% --set power.is_power_saving false

echo [7/9] Модем-пресет: LONG_MODERATE (+40%% дальности в лесу)
meshtastic %PORT% --set lora.modem_preset LONG_MODERATE

echo    hop_limit: 5 (больше хопов для леса)
meshtastic %PORT% --set lora.hop_limit 5

echo    tx_power: 0 (максимум)
meshtastic %PORT% --set lora.tx_power 0

echo    rx_boosted_gain: true (улучшенный приём)
meshtastic %PORT% --set lora.sx126x_rx_boosted_gain true

echo [8/9] LED: выключен (экономия)
meshtastic %PORT% --set device.led_heartbeat_disabled true

echo [9/9] Перезагрузка устройства...
meshtastic %PORT% --reboot

echo.
echo ============================================================
echo   ✅ Трекер настроен!
echo.
echo   Роль:         TRACKER (без сна)
echo   Позиция:      каждые 60 сек
echo   Модем:        LONG_MODERATE
echo   hop_limit:    5
echo   Автономность: ~12-15 часов (1000 мАч)
echo.
echo   ⚠️  BASE тоже переключи на LONG_MODERATE:
echo      meshtastic --set lora.modem_preset LONG_MODERATE
echo      meshtastic --set lora.hop_limit 5
echo ============================================================
pause
