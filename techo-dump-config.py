#!/usr/bin/env python3
"""
T-Echo Config Dump — Чтение всех настроек из устройства Meshtastic

Подключается к T-Echo через USB и выгружает ВСЮ конфигурацию в JSON.
Используется для диагностики и сопоставления с пресетами дашборда.

Установка:
  pip install meshtastic PyPubSub

Запуск:
  python techo-dump-config.py --port COM5
  python techo-dump-config.py --port COM5 --output device-config.json
  python techo-dump-config.py --port COM5 --compare preset-base.json
"""

import argparse
import json
import sys
import os
from datetime import datetime, timezone

# Включить ANSI-цвета в Windows cmd/PowerShell
if sys.platform == 'win32':
    os.system('')

try:
    import meshtastic
    import meshtastic.serial_interface
except ImportError:
    print("ОШИБКА: Установите meshtastic: pip install meshtastic")
    sys.exit(1)


# ─── Обратные маппинги: int → строка (protobuf → человекочитаемый) ──────

ROLE_REVERSE = {
    0: 'CLIENT', 1: 'CLIENT_MUTE', 2: 'ROUTER',
    3: 'ROUTER_CLIENT', 4: 'REPEATER', 5: 'TRACKER',
    6: 'SENSOR', 7: 'TAK', 8: 'CLIENT_HIDDEN',
    9: 'LOST_AND_FOUND', 10: 'TAK_TRACKER',
    11: 'ROUTER_LATE', 12: 'CLIENT_BASE',
}

GPS_MODE_REVERSE = {
    0: 'DISABLED', 1: 'ENABLED', 2: 'NOT_PRESENT',
}

MODEM_PRESET_REVERSE = {
    0: 'LONG_FAST', 1: 'LONG_SLOW', 2: 'VERY_LONG_SLOW',
    3: 'MEDIUM_SLOW', 4: 'MEDIUM_FAST',
    5: 'SHORT_SLOW', 6: 'SHORT_FAST',
    7: 'LONG_MODERATE', 8: 'SHORT_TURBO', 9: 'LONG_TURBO',
}

REGION_REVERSE = {
    0: 'UNSET', 1: 'US', 2: 'EU_433', 3: 'EU_868',
    4: 'CN', 5: 'JP', 6: 'ANZ', 7: 'KR',
    8: 'TW', 9: 'RU', 10: 'IN', 11: 'NZ_865',
    12: 'TH', 13: 'LORA_24', 14: 'UA_433', 15: 'UA_868',
    16: 'MY_433', 17: 'MY_919', 18: 'SG_923',
    19: 'PH_433', 20: 'PH_868', 21: 'PH_915',
    22: 'ANZ_433', 23: 'KZ_433', 24: 'KZ_863',
    25: 'NP_865', 26: 'BR_902',
}

REBROADCAST_MODE_REVERSE = {
    0: 'ALL', 1: 'ALL_SKIP_DECODING', 2: 'LOCAL_ONLY',
    3: 'KNOWN_ONLY', 4: 'NONE', 5: 'CORE_PORTNUMS_ONLY',
}


# ─── Чтение конфигурации из устройства ──────────────────────────────────

def read_device_config(interface):
    """Прочитать ВСЮ конфигурацию из устройства и вернуть dict.

    Возвращает dict в формате, совместимом с пресетами дашборда.
    """
    node = interface.localNode
    config = {}

    # ── Информация об узле ──
    my_info = interface.getMyNodeInfo()
    user = my_info.get("user", {}) if my_info else {}
    config['owner'] = {
        'longName': user.get("longName", ""),
        'shortName': user.get("shortName", ""),
        'nodeNum': my_info.get("num", 0) if my_info else 0,
        'nodeId': f"!{my_info['num']:08x}" if my_info and 'num' in my_info else "",
        'hwModel': user.get("hwModel", ""),
    }

    # ── Device ──
    d = node.localConfig.device
    config['device'] = {
        'role': ROLE_REVERSE.get(d.role, f'UNKNOWN({d.role})'),
        'roleValue': d.role,
        'nodeInfoBroadcastSecs': d.node_info_broadcast_secs,
        'rebroadcastMode': REBROADCAST_MODE_REVERSE.get(d.rebroadcast_mode, f'UNKNOWN({d.rebroadcast_mode})'),
        'rebroadcastModeValue': d.rebroadcast_mode,
        'ledHeartbeatDisabled': d.led_heartbeat_disabled,
    }

    # ── Position ──
    p = node.localConfig.position
    config['position'] = {
        'gpsMode': GPS_MODE_REVERSE.get(p.gps_mode, f'UNKNOWN({p.gps_mode})'),
        'gpsModeValue': p.gps_mode,
        'positionBroadcastSecs': p.position_broadcast_secs,
        'positionFlags': p.position_flags,
        'gpsUpdateInterval': p.gps_update_interval,
        'gpsAttemptTime': p.gps_attempt_time,
        'smartBroadcastEnabled': p.position_broadcast_smart_enabled,
        'smartBroadcastMinDist': p.broadcast_smart_minimum_distance if p.position_broadcast_smart_enabled else None,
        'smartBroadcastMinInterval': p.broadcast_smart_minimum_interval_secs if p.position_broadcast_smart_enabled else None,
    }

    # ── Power ──
    pw = node.localConfig.power
    config['power'] = {
        'powerSaving': pw.is_power_saving,
        'lsSecs': pw.ls_secs,
        'minWakeSecs': pw.min_wake_secs,
    }

    # ── LoRa ──
    l = node.localConfig.lora
    config['lora'] = {
        'region': REGION_REVERSE.get(l.region, f'UNKNOWN({l.region})'),
        'regionValue': l.region,
        'modemPreset': MODEM_PRESET_REVERSE.get(l.modem_preset, f'UNKNOWN({l.modem_preset})'),
        'modemPresetValue': l.modem_preset,
        'hopLimit': l.hop_limit,
        'txPower': l.tx_power,
        'channelNum': l.channel_num,
    }

    # ── Bluetooth ──
    bt = node.localConfig.bluetooth
    config['bluetooth'] = {
        'enabled': bt.enabled,
        'fixedPin': bt.fixed_pin if bt.fixed_pin else None,
        'mode': bt.mode,
    }

    # ── Display ──
    disp = node.localConfig.display
    config['display'] = {
        'screenOnSecs': disp.screen_on_secs,
        'autoScreenCarouselSecs': disp.auto_screen_carousel_secs,
    }

    # ── Network (WiFi) ──
    n = node.localConfig.network
    config['network'] = {
        'wifiSsid': n.wifi_ssid if n.HasField('wifi_ssid') else "",
        'wifiPsk': '***' if n.wifi_psk else "",  # Не показываем пароль
        'wifiEnabled': n.wifi_enabled,
    }

    # ── Security ──
    s = node.localConfig.security
    config['security'] = {
        'adminKeySet': len(s.admin_key) > 0 if hasattr(s, 'admin_key') else False,
        'publicKeySet': len(s.public_key) > 0 if hasattr(s, 'public_key') else False,
    }

    # ── Telemetry (module) ──
    try:
        t = node.moduleConfig.telemetry
        config['telemetry'] = {
            'deviceUpdateInterval': t.device_update_interval,
            'environmentMeasurementEnabled': t.environment_measurement_enabled,
            'environmentScreenEnabled': t.environment_screen_enabled if hasattr(t, 'environment_screen_enabled') else None,
        }
    except Exception:
        config['telemetry'] = {'error': 'Не удалось прочитать moduleConfig.telemetry'}

    # ── Каналы ──
    channels = []
    for i, ch in enumerate(node.channels):
        if ch is None:
            continue
        ch_settings = ch.settings if hasattr(ch, 'settings') else None
        if ch_settings is None:
            continue
        ch_info = {
            'index': i,
            'name': ch_settings.name if ch_settings.name else "",
            'uplinkEnabled': ch_settings.uplink_enabled,
            'downlinkEnabled': ch_settings.downlink_enabled,
        }
        # PSK — показываем только наличие/длину
        psk_bytes = ch_settings.psk if ch_settings.psk else b''
        ch_info['pskLength'] = len(psk_bytes)
        ch_info['pskSet'] = len(psk_bytes) > 0
        channels.append(ch_info)
    config['channels'] = channels

    # ── Список узлов в сети ──
    nodes = []
    if interface.nodes:
        for node_num, node_info in interface.nodes.items():
            if node_info is None:
                continue
            u = node_info.get("user", {})
            dm = node_info.get("deviceMetrics", {})
            nodes.append({
                'nodeId': f"!{node_num:08x}" if isinstance(node_num, int) else str(node_num),
                'longName': u.get("longName", ""),
                'shortName': u.get("shortName", ""),
                'role': u.get("role", ""),
                'hwModel': u.get("hwModel", ""),
                'batteryLevel': dm.get("batteryLevel"),
                'voltage': dm.get("voltage"),
                'lastHeard': node_info.get("lastHeard"),
            })
    config['nodes'] = nodes

    # ── Метаданные ──
    config['_meta'] = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'firmwareVersion': my_info.get("firmwareVersion", "") if my_info else "",
        'devicePort': args.port if 'args' in dir() else "",
    }

    return config


def print_config(config, compact=False):
    """Вывести конфигурацию в консоль с цветами."""
    # Информация об узле
    o = config['owner']
    print(f"\033[1;36m═══ {o['longName']}/{o['shortName']} ({o['nodeId']}) ═══\033[0m")
    if config.get('_meta', {}).get('firmwareVersion'):
        print(f"  Прошивка: {config['_meta']['firmwareVersion']}")

    # Device
    d = config['device']
    print(f"\033[33m[DEVICE]\033[0m role=\033[1m{d['role']}\033[0m ({d['roleValue']}), "
          f"node_info={d['nodeInfoBroadcastSecs']}s, "
          f"rebroadcast={d['rebroadcastMode']}, "
          f"led={'OFF' if d['ledHeartbeatDisabled'] else 'ON'}")

    # Position
    p = config['position']
    smart = f", smart={p['smartBroadcastEnabled']}" if p['smartBroadcastEnabled'] else ""
    print(f"\033[33m[POSITION]\033[0m gps={p['gpsMode']}, flags={p['positionFlags']}, "
          f"broadcast={p['positionBroadcastSecs']}s, "
          f"gps_interval={p['gpsUpdateInterval']}s, "
          f"gps_attempt={p['gpsAttemptTime']}s{smart}")

    # Power
    pw = config['power']
    print(f"\033[33m[POWER]\033[0m saving={pw['powerSaving']}, "
          f"ls={pw['lsSecs']}s, min_wake={pw['minWakeSecs']}s")

    # LoRa
    l = config['lora']
    print(f"\033[33m[LORA]\033[0m region=\033[1m{l['region']}\033[0m ({l['regionValue']}), "
          f"modem=\033[1m{l['modemPreset']}\033[0m ({l['modemPresetValue']}), "
          f"hop={l['hopLimit']}, tx={l['txPower']}dBm, ch={l['channelNum']}")

    # Bluetooth
    bt = config['bluetooth']
    print(f"\033[33m[BT]\033[0m enabled={bt['enabled']}, pin={'*' + str(bt['fixedPin']) if bt['fixedPin'] else 'none'}")

    # Display
    disp = config['display']
    print(f"\033[33m[DISPLAY]\033[0m screen_on={disp['screenOnSecs']}s")

    # Telemetry
    t = config.get('telemetry', {})
    if 'error' not in t:
        print(f"\033[33m[TELEMETRY]\033[0m interval={t['deviceUpdateInterval']}s, "
              f"env_sensor={t.get('environmentMeasurementEnabled', '?')}")
    else:
        print(f"\033[33m[TELEMETRY]\033[0m {t['error']}")

    # Channels
    for ch in config.get('channels', []):
        psk_info = f"PSK({ch['pskLength']}b)" if ch['pskSet'] else "no PSK"
        print(f"\033[33m[CH {ch['index']}]\033[0m name=\033[1m{ch['name'] or '(empty)'}\033[0m, "
              f"{psk_info}, up={ch['uplinkEnabled']}, down={ch['downlinkEnabled']}")

    # Узлы в сети
    nodes = config.get('nodes', [])
    print(f"\033[90mУзлов в сети: {len(nodes)}\033[0m")


def compare_configs(device_config, preset_file):
    """Сравнить конфигурацию устройства с пресетом из JSON-файла."""
    try:
        with open(preset_file, 'r', encoding='utf-8') as f:
            preset = json.load(f)
    except Exception as e:
        print(f"\033[31mОшибка чтения пресета: {e}\033[0m")
        return

    print(f"\n\033[1;33m═══ СРАВНЕНИЕ С ПРЕСЕТОМ ═══\033[0m\n")

    d = device_config
    p = preset
    diffs = 0

    def check(label, actual, expected, unit=''):
        nonlocal diffs
        if actual != expected:
            diffs += 1
            print(f"  \033[31m✗ {label}: устройство={actual}{unit}, пресет={expected}{unit}\033[0m")
        else:
            print(f"  \033[32m✓ {label}: {actual}{unit}\033[0m")

    # Device
    check('role', d['device']['role'], p.get('role', ''))
    check('nodeInfoBroadcastSecs', d['device']['nodeInfoBroadcastSecs'], p.get('nodeInfoBroadcastSecs', 900), 's')
    check('rebroadcastMode', d['device']['rebroadcastMode'], p.get('rebroadcastMode', 'ALL'))

    # Position
    check('gpsMode', d['position']['gpsMode'], p.get('gpsMode', 'ENABLED'))
    check('positionFlags', d['position']['positionFlags'], p.get('positionPrecision', 35))
    check('positionBroadcastSecs', d['position']['positionBroadcastSecs'], p.get('positionBroadcastSecs', 300), 's')
    check('gpsUpdateInterval', d['position']['gpsUpdateInterval'], p.get('gpsUpdateInterval', 30), 's')

    # LoRa
    check('region', d['lora']['region'], p.get('region', 'EU_433'))
    check('modemPreset', d['lora']['modemPreset'], p.get('modemPreset', 'LONG_MODERATE'))
    check('hopLimit', d['lora']['hopLimit'], p.get('hopLimit', 5))

    # Power
    check('powerSaving', d['power']['powerSaving'], p.get('powerSaving', False))
    if p.get('powerSaving') and p.get('role', '') in ('TRACKER', 'SENSOR', 'TAK_TRACKER'):
        check('lsSecs', d['power']['lsSecs'], p.get('lsSecs', 300), 's')
        check('minWakeSecs', d['power']['minWakeSecs'], p.get('minWakeSecs', 10), 's')

    # Bluetooth
    check('bluetoothEnabled', d['bluetooth']['enabled'], p.get('bluetoothEnabled', True))

    # Display
    check('screenOnSecs', d['display']['screenOnSecs'], p.get('screenOnSecs', 60), 's')

    # Telemetry
    if 'error' not in d.get('telemetry', {}):
        check('telemetryInterval', d['telemetry']['deviceUpdateInterval'], p.get('telemetryInterval', 300), 's')

    print(f"\n\033[1m{'ЕСТЬ ОТЛИЧИЯ' if diffs else 'СОВПАДАЕТ'} ({diffs} различий)\033[0m")


# ─── Main ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='T-Echo Config Dump — Чтение настроек из устройства')
    parser.add_argument('--port', required=True, help='Serial port (COM5, /dev/ttyUSB0, etc.)')
    parser.add_argument('--output', '-o', help='Сохранить в JSON файл')
    parser.add_argument('--compare', '-c', help='Сравнить с пресетом (JSON файл)')
    parser.add_argument('--quiet', '-q', action='store_true', help='Только JSON, без текстового вывода')
    args = parser.parse_args()

    print(f"Подключение к T-Echo через {args.port}...")

    try:
        interface = meshtastic.serial_interface.SerialInterface(devPath=args.port)
    except Exception as e:
        print(f"ОШИБКА: Не удалось подключиться к {args.port}: {e}")
        sys.exit(1)

    print("Подключено! Чтение конфигурации...")

    try:
        config = read_device_config(interface)
    except Exception as e:
        print(f"ОШИБКА при чтении конфигурации: {e}")
        interface.close()
        sys.exit(1)

    # Вывод в консоль
    if not args.quiet:
        print()
        print_config(config)

    # Сохранение в JSON
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False, default=str)
        print(f"\n\033[32mКонфигурация сохранена в {args.output}\033[0m")

    # Сравнение с пресетом
    if args.compare:
        compare_configs(config, args.compare)

    interface.close()
