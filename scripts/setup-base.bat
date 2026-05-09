@echo off
chcp 65001 >nul 2>&1
REM ============================================================
REM  Настройка T-Echo BASE для леса
REM  Прошивка: 2.7.15 | Диапазон: 433 МГц | Роль: ROUTER
REM ============================================================
REM
REM  Использование:
REM    setup-base.bat COM5
REM ============================================================

set PORT=
if not "%~1"=="" set PORT=--port %1

echo ============================================================
echo   Настройка T-Echo BASE для леса
echo ============================================================
echo.

echo [1/5] Роль устройства: ROUTER
meshtastic %PORT% --set device.role ROUTER

echo [2/5] Модем-пресет: LONG_MODERATE (должен совпадать с трекерами!)
meshtastic %PORT% --set lora.modem_preset LONG_MODERATE

echo    hop_limit: 5
meshtastic %PORT% --set lora.hop_limit 5

echo    tx_power: 0 (максимум)
meshtastic %PORT% --set lora.tx_power 0

echo    rx_boosted_gain: true (улучшенный приём)
meshtastic %PORT% --set lora.sx126x_rx_boosted_gain true

echo [3/5] GPS: включён
meshtastic %PORT% --set position.gps_update_interval 30
meshtastic %PORT% --set position.position_broadcast_secs 900

echo [4/5] LED: выключен
meshtastic %PORT% --set device.led_heartbeat_disabled true

echo [5/5] Перезагрузка устройства...
meshtastic %PORT% --reboot

echo.
echo ============================================================
echo   ✅ BASE настроен!
echo.
echo   Роль:         ROUTER (всегда бодрствует, ретранслирует)
echo   Модем:        LONG_MODERATE
echo   hop_limit:    5
echo.
echo   ⚠️  Все узлы должны использовать одинаковый modem_preset!
echo ============================================================
pause
