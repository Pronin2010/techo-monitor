#!/usr/bin/env python3
"""
T-Echo Meshtastic Bridge Script
Подключает физические T-Echo устройства к веб-дашборду.

Установка:
  pip install meshtastic PyPubSub

Запуск (USB) — реалтайм-мониторинг пакетов:
  python techo-bridge.py --mode serial --port COM5 --dashboard http://localhost:3000

Запуск (USB) — только периодический опрос:
  python techo-bridge.py --mode serial --port COM5 --dashboard http://localhost:3000 --no-realtime

Запуск (MQTT):
  python techo-bridge.py --mode mqtt --broker mqtt://broker.hivemq.com:1883 --dashboard http://localhost:3000

Управление конфигурацией (через HTTP API моста):
  POST /api/apply-config — применить пресет к локальному или удалённому узлу
  GET  /api/status       — статус подключения и список узлов
"""

import argparse
import json
import os
import sys
import time
import signal
import threading
from datetime import datetime, timezone
from collections import OrderedDict
from http.server import HTTPServer, BaseHTTPRequestHandler

# Включить ANSI-цвета в Windows cmd/PowerShell
if sys.platform == 'win32':
    os.system('')

# Serial mode imports (required for --mode serial)
try:
    import meshtastic
    import meshtastic.serial_interface
    HAS_MESHTASTIC = True
except ImportError:
    HAS_MESHTASTIC = False

# MQTT mode imports (optional, only for --mode mqtt)
try:
    from meshtastic import portnums
    from meshtastic.mesh_pb2 import MeshPacket
    HAS_MESHTASTIC_MQTT = True
except ImportError:
    HAS_MESHTASTIC_MQTT = False

try:
    import paho.mqtt.client as mqtt
    HAS_MQTT = True
except ImportError:
    HAS_MQTT = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    import urllib.request
    import urllib.error
    HAS_REQUESTS = False


# ─── Timestamp helpers ────────────────────────────────────────────────────

def format_timestamp(epoch_or_dt=None):
    """Форматировать timestamp с миллисекундами для лучшей гранулярности."""
    if epoch_or_dt is None:
        dt = datetime.now(timezone.utc)
    elif isinstance(epoch_or_dt, (int, float)):
        dt = datetime.fromtimestamp(epoch_or_dt, tz=timezone.utc)
    else:
        dt = epoch_or_dt
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def extract_rx_time(packet):
    """Извлечь rx_time из пакета Meshtastic (protobuf или dict).
    Возвращает epoch seconds (int/float) или None, если rx_time отсутствует/некорректен.
    """
    rx_time = None
    # Пробуем как объект с атрибутом (protobuf)
    try:
        rx_time = getattr(packet, 'rx_time', None)
    except Exception:
        pass
    # Пробуем как dict
    if rx_time is None and isinstance(packet, dict):
        rx_time = packet.get('rx_time')
    # Проверяем корректность
    if rx_time is not None and isinstance(rx_time, (int, float)) and rx_time > 0:
        return rx_time
    return None


# ─── HTTP helper ───────────────────────────────────────────────────────────

def http_post(url, data):
    """Send data to the dashboard API."""
    headers = {'Content-Type': 'application/json'}
    payload = json.dumps(data, default=str).encode('utf-8')
    try:
        if HAS_REQUESTS:
            resp = requests.post(url, json=data, timeout=10)
            return resp.status_code == 200, resp.text
        else:
            req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status == 200, resp.read().decode()
    except Exception as e:
        return False, str(e)


# ─── Packet type names ────────────────────────────────────────────────────

# Маппинг числовых portnum → короткие имена
PORTNUM_NAMES = {
    0: 'UNKNOWN',
    1: 'TEXT_MESSAGE',
    2: 'REMOTE_HARDWARE',
    3: 'POSITION',
    4: 'NODEINFO',
    5: 'ROUTING',
    6: 'ADMIN',
    7: 'TELEMETRY',
    8: 'SPANSION',
    9: 'PRIVATE',
    10: 'ATAK_FORWARDER',
    11: 'SIMULATOR',
    12: 'TRACEROUTE',
    13: 'NEIGHBORINFO',
    14: 'ATAK_PLUGIN',
    15: 'MAP_REPORT',
    16: 'POWERSTRESS',
    32: 'STORE_FORWARD',
    33: 'RANGE_TEST',
    34: 'TELEMETRY_DEVICE',
    35: 'TELEMETRY_ENVIRONMENT',
    36: 'TELEMETRY_AIR_QUALITY',
    64: 'PAXCOUNTER',
    65: 'SERIAL',
    66: 'STORE_FORWARD_APP',
    67: 'MAX',
}

# Маппинг строковых имён Meshtastic (PORT_NODEINFO_APP и т.д.) → короткие имена
PORT_NAME_ALIASES = {
    'PORT_UNKNOWN_APP': 'UNKNOWN',
    'PORT_TEXT_MESSAGE_APP': 'TEXT_MESSAGE',
    'PORT_REMOTE_HARDWARE_APP': 'REMOTE_HARDWARE',
    'PORT_POSITION_APP': 'POSITION',
    'PORT_NODEINFO_APP': 'NODEINFO',
    'PORT_ROUTING_APP': 'ROUTING',
    'PORT_ADMIN_APP': 'ADMIN',
    'PORT_TELEMETRY_APP': 'TELEMETRY',
    'PORT_SPANSION_APP': 'SPANSION',
    'PORT_PRIVATE_APP': 'PRIVATE',
    'PORT_ATAK_FORWARDER_APP': 'ATAK_FORWARDER',
    'PORT_SIMULATOR_APP': 'SIMULATOR',
    'PORT_TRACEROUTE_APP': 'TRACEROUTE',
    'PORT_NEIGHBORINFO_APP': 'NEIGHBORINFO',
    'PORT_ATAK_PLUGIN_APP': 'ATAK_PLUGIN',
    'PORT_MAP_REPORT_APP': 'MAP_REPORT',
    'PORT_POWERSTRESS_APP': 'POWERSTRESS',
    'PORT_STORE_FORWARD_APP': 'STORE_FORWARD',
    'PORT_RANGE_TEST_APP': 'RANGE_TEST',
    'PORT_PAXCOUNTER_APP': 'PAXCOUNTER',
    'PORT_SERIAL_APP': 'SERIAL',
    'PORT_MAX_APP': 'MAX',
}

def portnum_name(portnum):
    """Человекочитаемое имя типа пакета. Поддерживает числовые и строковые portnum."""
    if isinstance(portnum, int):
        return PORTNUM_NAMES.get(portnum, f'PORT_{portnum}')
    if isinstance(portnum, str):
        # Сначала проверяем алиасы (PORT_NODEINFO_APP → NODEINFO)
        if portnum in PORT_NAME_ALIASES:
            return PORT_NAME_ALIASES[portnum]
        # Уже короткое имя?
        if portnum in PORTNUM_NAMES.values():
            return portnum
        # Убираем префикс PORT_ и суффикс _APP
        name = portnum
        if name.startswith('PORT_'):
            name = name[5:]
        if name.endswith('_APP'):
            name = name[:-4]
        return name
    return 'UNKNOWN'


# ─── Node name cache ─────────────────────────────────────────────────────

_node_names = {}   # {from_int: shortName}
_node_lock = threading.Lock()


def _update_node_name(from_int, short_name, long_name=None):
    """Обновить кэш имён узлов."""
    with _node_lock:
        if short_name:
            _node_names[from_int] = short_name
        elif long_name and from_int not in _node_names:
            _node_names[from_int] = long_name[:4].upper()


def _get_node_name(from_int):
    """Получить короткое имя узла."""
    with _node_lock:
        return _node_names.get(from_int, f'!{from_int:08x}')


# ─── Config Apply — маппинг строковых значений в protobuf enum ────────────

# Роли: строка → числовое значение enum Config.DeviceConfig.Role
ROLE_MAP = {
    'CLIENT': 1, 'CLIENT_MUTE': 2, 'CLIENT_HIDDEN': 3,
    'ROUTER': 4, 'ROUTER_CLIENT': 5, 'TRACKER': 6,
    'REPEATER': 7, 'SENSOR': 8, 'LOST_AND_FOUND': 9,
    'TAK_TRACKER': 10, 'ROUTER_LATE': 11, 'CLIENT_BASE': 12,
}

# GPS режимы: строка → числовое значение enum Config.PositionConfig.GpsMode
GPS_MODE_MAP = {
    'DISABLED': 0, 'ENABLED': 1, 'NOT_PRESENT': 2,
}

# Модем-пресеты: строка → числовое значение enum Config.LoRaConfig.ModemPreset
MODEM_PRESET_MAP = {
    'LONG_FAST': 0, 'LONG_MODERATE': 1, 'LONG_TURBO': 9,
    'MEDIUM_FAST': 2, 'MEDIUM_SLOW': 3,
    'SHORT_FAST': 4, 'SHORT_SLOW': 5, 'SHORT_TURBO': 10,
    'LITE_FAST': 11, 'LITE_SLOW': 12,
    'NARROW_FAST': 13, 'NARROW_SLOW': 14,
}

# Регионы: строка → числовое значение enum Config.LoRaConfig.RegionCode
REGION_MAP = {
    'EU_433': 3, 'ANZ_433': 4, 'UA_433': 5,
    'KZ_433': 6, 'PH_433': 7, 'MY_433': 8,
}

# Режимы ретрансляции: строка → числовое значение
REBROADCAST_MODE_MAP = {
    'ALL': 0, 'LOCAL_SKIP': 1, 'SIMPLE': 2,
}


def apply_config_to_node(interface, node_id, config, reboot_secs=5,
                          device_name=None, device_short_name=None,
                          factory_reset=False):
    """Применить конфигурацию пресета к узлу (локальному или удалённому).

    Args:
        interface: meshtastic SerialInterface
        node_id: '!hexid' или None/пустая строка для локального узла
        config: dict с полями пресета (как из API дашборда)
        reboot_secs: секунд до перезагрузки (0 = без перезагрузки)
        device_name: длинное имя устройства (например, 'Tracker 01')
        device_short_name: короткое имя (макс. 5 символов, например, 'TR01')
        factory_reset: если True — сначала сбросить до заводских, затем применить пресет

    Returns:
        dict {success: bool, message: str, sections: [str]}
    """
    if not HAS_MESHTASTIC:
        return {'success': False, 'message': 'meshtastic не установлен', 'sections': []}

    try:
        # Определяем целевой узел
        if node_id and node_id.strip():
            # Удалённый узел — getNode запрашивает конфиг по mesh
            print(f"\033[33m[CFG] Подключение к удалённому узлу {node_id}...\033[0m")
            node = interface.getNode(node_id, timeout=120)
        else:
            # Локальный узел (BASE)
            node = interface.localNode

        sections_written = []

        # ── Factory Reset ──
        if factory_reset:
            print("\033[1;31m[CFG] ⚠ СБРОС ДО ЗАВОДСКИХ НАСТРОЕК...\033[0m")
            node.factoryReset()
            sections_written.append("factory_reset")
            # После factoryReset устройство перезагружается — ждём повторного подключения
            print("\033[33m[CFG] Ожидание перезагрузки (10 сек)...\033[0m")
            time.sleep(10)
            # Переподключаемся к узлу
            try:
                if node_id and node_id.strip():
                    node = interface.getNode(node_id, timeout=120)
                else:
                    node = interface.localNode
                print("\033[32m[CFG] Повторное подключение после сброса — ОК\033[0m")
            except Exception as e:
                print(f"\033[31m[CFG] Не удалось переподключиться после сброса: {e}\033[0m")
                return {'success': False, 'message': f'Сброс выполнен, но не удалось переподключиться: {e}', 'sections': sections_written}

        # ── Имя устройства ──
        if device_name or device_short_name:
            try:
                node.setOwner(long_name=device_name, short_name=device_short_name)
                name_info = f"{device_name or ''}/{device_short_name or ''}"
                sections_written.append(f"owner={name_info}")
                print(f"\033[32m[CFG] owner: {name_info}\033[0m")
            except Exception as e:
                print(f"\033[31m[CFG] Ошибка установки имени: {e}\033[0m")
                # Не прерываем — имя не критично, конфиг важнее

        # ── Транзакция ──
        node.beginSettingsTransaction()
        print("\033[33m[CFG] Транзакция открыта\033[0m")

        try:
            # ── Device ──
            role_str = config.get('role', 'CLIENT')
            if role_str in ROLE_MAP:
                node.localConfig.device.role = ROLE_MAP[role_str]
            node.localConfig.device.node_info_broadcast_secs = config.get('nodeInfoBroadcastSecs', 900)
            # LED (led.disabled = true → led_heartbeat_disabled)
            if config.get('ledDisabled'):
                node.localConfig.device.led_heartbeat_disabled = True
            else:
                node.localConfig.device.led_heartbeat_disabled = False
            node.writeConfig("device")
            sections_written.append("device")
            print(f"\033[32m[CFG] device: role={role_str}, node_info={config.get('nodeInfoBroadcastSecs', 900)}s\033[0m")

            # ── Position ──
            gps_str = config.get('gpsMode', 'ENABLED')
            if gps_str in GPS_MODE_MAP:
                node.localConfig.position.gps_mode = GPS_MODE_MAP[gps_str]
            node.localConfig.position.position_broadcast_secs = config.get('positionBroadcastSecs', 300)
            node.localConfig.position.position_precision = config.get('positionPrecision', 32)
            node.localConfig.position.gps_update_interval = config.get('gpsUpdateInterval', 30)
            node.localConfig.position.gps_attempt_time = config.get('gpsAttemptTime', 90)
            # Smart broadcast
            if config.get('smartBroadcastEnabled', True):
                node.localConfig.position.broadcast_smart_minimum_distance = config.get('smartBroadcastMinDist', 20)
                node.localConfig.position.broadcast_smart_minimum_interval_secs = config.get('smartBroadcastMinInterval', 60)
            node.writeConfig("position")
            sections_written.append("position")
            print(f"\033[32m[CFG] position: gps={gps_str}, precision={config.get('positionPrecision', 32)}\033[0m")

            # ── Power ──
            node.localConfig.power.is_power_saving = config.get('powerSaving', False)
            # ls_secs и min_wake_secs только для спящих ролей
            sleep_roles = {'TRACKER', 'SENSOR', 'TAK_TRACKER'}
            if config.get('powerSaving') and config.get('role', '') in sleep_roles:
                node.localConfig.power.ls_secs = config.get('lsSecs', 300)
                node.localConfig.power.min_wake_secs = config.get('minWakeSecs', 10)
            node.writeConfig("power")
            sections_written.append("power")
            print(f"\033[32m[CFG] power: saving={config.get('powerSaving', False)}\033[0m")

            # ── LoRa ──
            region_str = config.get('region', 'EU_433')
            if region_str in REGION_MAP:
                node.localConfig.lora.region = REGION_MAP[region_str]
            modem_str = config.get('modemPreset', 'LONG_MODERATE')
            if modem_str in MODEM_PRESET_MAP:
                node.localConfig.lora.modem_preset = MODEM_PRESET_MAP[modem_str]
            node.localConfig.lora.hop_limit = config.get('hopLimit', 5)
            node.localConfig.lora.tx_power = config.get('txPower', 0)
            node.localConfig.lora.use_preamble = config.get('usePreamble', False)
            node.writeConfig("lora")
            sections_written.append("lora")
            print(f"\033[32m[CFG] lora: region={region_str}, modem={modem_str}, hop={config.get('hopLimit', 5)}\033[0m")

            # ── Network ──
            rb_str = config.get('rebroadcastMode', 'ALL')
            if rb_str in REBROADCAST_MODE_MAP:
                node.localConfig.network.rebroadcast_mode = REBROADCAST_MODE_MAP[rb_str]
            node.writeConfig("network")
            sections_written.append("network")
            print(f"\033[32m[CFG] network: rebroadcast={rb_str}\033[0m")

            # ── Bluetooth ──
            node.localConfig.bluetooth.enabled = config.get('bluetoothEnabled', True)
            if config.get('bluetoothEnabled') and config.get('bluetoothFixedPin'):
                try:
                    node.localConfig.bluetooth.fixed_pin = int(config['bluetoothFixedPin'])
                except (ValueError, TypeError):
                    pass
            node.writeConfig("bluetooth")
            sections_written.append("bluetooth")
            print(f"\033[32m[CFG] bluetooth: enabled={config.get('bluetoothEnabled', True)}\033[0m")

            # ── Display ──
            node.localConfig.display.screen_on_secs = config.get('screenOnSecs', 60)
            node.writeConfig("display")
            sections_written.append("display")
            print(f"\033[32m[CFG] display: screen_on={config.get('screenOnSecs', 60)}s\033[0m")

            # ── Telemetry (module) ──
            node.moduleConfig.telemetry.device_update_interval = config.get('telemetryInterval', 300)
            node.writeConfig("telemetry")
            sections_written.append("telemetry")
            print(f"\033[32m[CFG] telemetry: interval={config.get('telemetryInterval', 300)}s\033[0m")

        except Exception as e:
            # При ошибке — откатить транзакцию
            print(f"\033[31m[CFG] Ошибка записи секции: {e}\033[0m")
            try:
                node.commitSettingsTransaction()
            except Exception:
                pass
            return {'success': False, 'message': f'Ошибка записи: {e}', 'sections': sections_written}

        # ── Коммит транзакции ──
        node.commitSettingsTransaction()
        print("\033[33m[CFG] Транзакция зафиксирована\033[0m")

        # ── Перезагрузка ──
        if reboot_secs > 0:
            print(f"\033[33m[CFG] Перезагрузка через {reboot_secs} сек...\033[0m")
            node.reboot(secs=reboot_secs)

        return {
            'success': True,
            'message': f'Конфигурация применена ({len(sections_written)} секций). Перезагрузка через {reboot_secs}с.',
            'sections': sections_written,
        }

    except Exception as e:
        return {'success': False, 'message': f'Ошибка: {e}', 'sections': []}


# ─── HTTP API Server (внутри моста) ───────────────────────────────────────

# Глобальная ссылка на interface для HTTP-обработчика
_bridge_interface = [None]   # [interface] — mutable для замыкания
_bridge_running = [False]
_bridge_nodes_info = {}    # Последний snapshot узлов


class BridgeHTTPHandler(BaseHTTPRequestHandler):
    """HTTP-обработчик для API моста — приём команд от дашборда."""

    def log_message(self, format, *args):
        """Тихий лог — не spam'ить в консоль."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"\033[90m[{timestamp}] [HTTP] {args[0]}\033[0m")

    def _send_json(self, data, status=200):
        body = json.dumps(data, default=str, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length > 0:
            return json.loads(self.rfile.read(length).decode('utf-8'))
        return {}

    def do_GET(self):
        """GET /api/status — статус моста и список узлов."""
        if self.path == '/api/status':
            iface = _bridge_interface[0]
            nodes_list = []
            if iface:
                try:
                    for node_num, node in iface.nodes.items():
                        if node is None:
                            continue
                        user = node.get("user", {})
                        dm = node.get("deviceMetrics", {})
                        nodes_list.append({
                            "nodeId": node_num,
                            "name": user.get("longName", ""),
                            "shortName": user.get("shortName", ""),
                            "role": user.get("role", "CLIENT"),
                            "batteryLevel": dm.get("batteryLevel"),
                            "isLocal": str(node_num) == str(iface.getMyNodeInfo().get("num", "")),
                        })
                except Exception:
                    pass

            self._send_json({
                "connected": iface is not None,
                "mode": "serial",
                "nodes": nodes_list,
                "uptime": time.time() - _bridge_nodes_info.get("start_time", time.time()),
            })
        else:
            self._send_json({"error": "Неизвестный маршрут"}, 404)

    def do_POST(self):
        """POST /api/apply-config — применить пресет к устройству."""
        if self.path == '/api/apply-config':
            iface = _bridge_interface[0]
            if not iface:
                self._send_json({"success": False, "message": "Мост не подключён к устройству"}, 503)
                return

            try:
                body = self._read_body()
            except Exception as e:
                self._send_json({"success": False, "message": f"Ошибка JSON: {e}"}, 400)
                return

            config = body.get('config', {})
            node_id = body.get('nodeId', '')  # пустая строка = локальный
            reboot_secs = body.get('rebootSecs', 5)
            preset_name = body.get('presetName', 'неизвестный')
            device_name = body.get('deviceName') or None      # длинное имя
            device_short_name = body.get('deviceShortName') or None  # короткое имя (макс. 5 символов)
            factory_reset = body.get('factoryReset', False)    # сброс до заводских перед конфигурацией

            target_label = node_id or 'BASE (локальный)'
            name_label = f" → {device_name}" if device_name else ""
            reset_label = " [СБРОС]" if factory_reset else ""
            print(f"\033[1;33m═══ КОНФИГУРАЦИЯ{reset_label}: «{preset_name}» → {target_label}{name_label} ═══\033[0m")

            result = apply_config_to_node(
                iface, node_id, config, reboot_secs,
                device_name=device_name, device_short_name=device_short_name,
                factory_reset=factory_reset,
            )
            result['presetName'] = preset_name

            if result['success']:
                print(f"\033[1;32m[CFG] Успешно: {result['message']}\033[0m")
            else:
                print(f"\033[1;31m[CFG] Ошибка: {result['message']}\033[0m")

            self._send_json(result)
        else:
            self._send_json({"error": "Неизвестный маршрут"}, 404)


def start_http_server(port=8420):
    """Запустить HTTP API сервер моста в фоновом потоке."""
    server = HTTPServer(('0.0.0.0', port), BridgeHTTPHandler)
    server.timeout = 1  # Для корректного shutdown
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


# ─── Serial Mode ───────────────────────────────────────────────────────────

def serial_mode(port, dashboard_url, interval, debug=False, realtime=True, api_port=8420):
    """Connect to T-Echo via USB serial and monitor packets in real-time."""
    if not HAS_MESHTASTIC:
        print("ОШИБКА: Установите meshtastic: pip install meshtastic")
        sys.exit(1)

    print(f"Подключение к T-Echo через {port}...")

    try:
        interface = meshtastic.serial_interface.SerialInterface(devPath=port)
    except Exception as e:
        print(f"ОШИБКА: Не удалось подключиться к {port}: {e}")
        print("Проверьте:")
        print("  1. Устройство подключено по USB")
        print("  2. Порт указан правильно (попробуйте: python -m meshtastic --info)")
        print("  3. Устройство не занято другим приложением")
        sys.exit(1)

    print("Подключено! Чтение данных из сети...")

    # Сохраняем interface глобально для HTTP API
    _bridge_interface[0] = interface
    _bridge_running[0] = True
    _bridge_nodes_info['start_time'] = time.time()

    # Запускаем HTTP API сервер для приёма команд от дашборда
    http_server = start_http_server(api_port)
    print(f"  \033[32mHTTP API запущен на порту {api_port}\033[0m")
    print(f"  POST http://localhost:{api_port}/api/apply-config — применить конфиг")
    print(f"  GET  http://localhost:{api_port}/api/status — статус моста")

    running = True

    def signal_handler(sig, frame):
        nonlocal running
        running = False
        print("\nОстановка...")
    
    signal.signal(signal.SIGINT, signal_handler)

    # ── Shared state ──
    node_rssi = {}
    node_position = {}       # {from_int: {lat, lon, alt, receivedAt}}
    node_last_heard = {}     # {from_int: ISO-8601 timestamp}
    my_node_num_ref = [None]
    
    # ── Packet counter & rate tracking ──
    packet_count = [0]
    packet_rate = [0]        # packets per minute
    rate_window = []         # timestamps of recent packets for rate calc

    # ── Recent packets ring buffer for display ──
    MAX_RECENT = 50
    recent_packets = []
    recent_lock = threading.Lock()

    def _add_recent(entry):
        with recent_lock:
            recent_packets.append(entry)
            if len(recent_packets) > MAX_RECENT:
                recent_packets.pop(0)

    # ── PyPubSub — real-time packet handler ──
    try:
        from pubsub import pub

        _callback_count = [0]  # Для диагностики

        def on_receive(packet, interface=None):
            """Вызывается для КАЖДОГО полученного пакета — реалтайм."""
            try:
                _callback_count[0] += 1
                from_num = packet.get("from", 0)
                to_num = packet.get("to", 0)
                rx_rssi = packet.get("rxRssi")
                rx_snr = packet.get("rxSnr")
                hop_limit = packet.get("hopLimit", 0)
                channel = packet.get("channel", 0)
                my_num = my_node_num_ref[0]

                # Диагностика первых пакетов
                if _callback_count[0] <= 3:
                    print(f"  [DBG] callback #{_callback_count[0]}: from={from_num} my={my_num} rssi={rx_rssi} snr={rx_snr}")

                if not from_num:
                    return

                from_int = int(from_num) if not isinstance(from_num, int) else from_num

                # Пропускаем собственные пакеты
                if my_num and int(from_num) == int(my_num):
                    if _callback_count[0] <= 3:
                        print(f"  [DBG] SKIP own packet from={from_int} my={my_num}")
                    return

                # Используем время пакета (rx_time) если есть, иначе текущее время
                rx_time = extract_rx_time(packet)
                if rx_time:
                    now_iso = format_timestamp(rx_time)
                else:
                    now_iso = format_timestamp()
                now_local = datetime.now().strftime("%H:%M:%S")
                node_last_heard[from_int] = now_iso

                # RSSI
                if rx_rssi is not None and int(rx_rssi) != 0:
                    node_rssi[from_int] = int(rx_rssi)

                # ── Decode packet type & payload ──
                decoded = packet.get("decoded", {})
                portnum = 0
                pkt_type = "UNKNOWN"
                pkt_details = {}

                if isinstance(decoded, dict):
                    portnum = decoded.get("portnum", decoded.get("portNum", 0))
                    pkt_type = portnum_name(portnum)

                    # --- POSITION ---
                    pos = decoded.get("position")
                    if isinstance(pos, dict):
                        lat_i = pos.get("latitudeI")
                        lon_i = pos.get("longitudeI")
                        if isinstance(lat_i, int) and lat_i != 0 and isinstance(lon_i, int) and lon_i != 0:
                            lat = lat_i / 1e7
                            lon = lon_i / 1e7
                            alt = pos.get("altitude", 0)
                            node_position[from_int] = {
                                "latitude": lat,
                                "longitude": lon,
                                "altitude": alt,
                                "receivedAt": now_iso,
                            }
                            pkt_details = {"lat": lat, "lon": lon, "alt": alt}

                    # --- NODEINFO (имена узлов) ---
                    user_info = decoded.get("user")
                    if isinstance(user_info, dict):
                        sn = user_info.get("shortName", "")
                        ln = user_info.get("longName", "")
                        _update_node_name(from_int, sn, ln)
                        pkt_details = {"shortName": sn, "longName": ln, "hwModel": user_info.get("hwModel", "")}

                    # --- TELEMETRY ---
                    telem = decoded.get("telemetry")
                    if isinstance(telem, dict):
                        dev_metrics = telem.get("deviceMetrics", {})
                        env_metrics = telem.get("environmentMetrics", {})
                        if dev_metrics:
                            pkt_details = {
                                "battery": dev_metrics.get("batteryLevel"),
                                "voltage": dev_metrics.get("voltage"),
                                "usbPower": dev_metrics.get("usbPower"),
                                "channelUtilization": dev_metrics.get("channelUtilization"),
                                "airUtilTx": dev_metrics.get("airUtilTx"),
                            }
                        if env_metrics:
                            pkt_details.update({
                                "temperature": env_metrics.get("temperature"),
                                "humidity": env_metrics.get("humidity"),
                                "pressure": env_metrics.get("barometricPressure"),
                            })

                    # --- TEXT_MESSAGE ---
                    text = decoded.get("text")
                    if isinstance(text, str) and text:
                        pkt_details = {"text": text[:100]}

                # ── Update packet counter & rate ──
                packet_count[0] += 1
                now_ts = time.time()
                rate_window.append(now_ts)
                # Keep only last 60 seconds
                while rate_window and rate_window[0] < now_ts - 60:
                    rate_window.pop(0)
                packet_rate[0] = len(rate_window)

                # ── Short name for display ──
                sn = _get_node_name(from_int)

                # ── Real-time console output ──
                if realtime:
                    rssi_str = f"rssi={int(rx_rssi):4d}" if rx_rssi is not None else "rssi=   -"
                    snr_str = f"snr={float(rx_snr):5.1f}" if rx_snr is not None else "snr=    -"
                    
                    # Compact detail line
                    detail_parts = []
                    if "lat" in pkt_details:
                        detail_parts.append(f"GPS={pkt_details['lat']:.5f},{pkt_details['lon']:.5f}")
                    if "battery" in pkt_details and pkt_details["battery"] is not None:
                        detail_parts.append(f"bat={pkt_details['battery']}%")
                        if pkt_details.get("voltage"):
                            detail_parts.append(f"{pkt_details['voltage']:.2f}V")
                    if "temperature" in pkt_details and pkt_details["temperature"] is not None:
                        detail_parts.append(f"T={pkt_details['temperature']:.1f}C")
                    if "text" in pkt_details:
                        detail_parts.append(f'"{pkt_details["text"]}"')
                    if "shortName" in pkt_details:
                        detail_parts.append(f"-> {pkt_details['shortName']}")

                    detail_str = " ".join(detail_parts) if detail_parts else ""
                    ch_str = f"ch={channel}" if channel else ""
                    
                    print(f"  \033[90m[{now_local}]\033[0m "
                          f"\033[1m{sn:4s}\033[0m "
                          f"\033[36m{pkt_type:20s}\033[0m "
                          f"{rssi_str} {snr_str} {ch_str} {detail_str}")

                # ── Build packet entry for dashboard ──
                pkt_entry = {
                    "receivedAt": now_iso,
                    "fromId": from_int,
                    "fromName": sn,
                    "toId": int(to_num) if to_num else None,
                    "portnum": portnum,
                    "packetType": pkt_type,
                    "channel": channel,
                    "rssi": int(rx_rssi) if rx_rssi is not None else None,
                    "snr": float(rx_snr) if rx_snr is not None else None,
                    "hopLimit": hop_limit,
                    "details": pkt_details if pkt_details else None,
                }
                _add_recent(pkt_entry)

                # ── Immediately send to dashboard (real-time) ──
                if realtime:
                    try:
                        pkt_url = f"{dashboard_url}/api/packets"
                        http_post(pkt_url, {"packet": pkt_entry})
                    except Exception:
                        pass  # Non-blocking — don't block packet processing

            except Exception as e:
                print(f"\033[31m[ERR] pubsub handler: {e}\033[0m")

        pub.subscribe(on_receive, 'meshtastic.receive')
        if realtime:
            print("  \033[32mРежим реалтайм-мониторинга пакетов включён\033[0m")
    except ImportError:
        print("[WARN] pubsub не установлен! Реалтайм-мониторинг недоступен.")
        print("[WARN] Установите: pip install PyPubSub")
        realtime = False

    # Получаем my_node_num
    try:
        early_myInfo = interface.getMyNodeInfo()
        my_node_num_ref[0] = early_myInfo.get("num") or early_myInfo.get("myNodeNum")
        if debug and my_node_num_ref[0]:
            print(f"[DEBUG] my_node_num (early): {my_node_num_ref[0]}")
    except Exception as e:
        print(f"[WARN] Не удалось получить my_node_num заранее: {e}")

    # Ждём 15 сек чтобы успели прийти пакеты от трекеров
    print("Ожидание 15 сек для приёма пакетов...")
    time.sleep(15)

    # ── Main loop: periodic sync + rate display ──
    last_rate_print = time.time()
    
    while running:
        try:
            nodes_data = []
            myInfo = interface.getMyNodeInfo()
            my_node_num = myInfo.get("num") or myInfo.get("myNodeNum")
            my_node_num_ref[0] = my_node_num

            if debug:
                print("[DEBUG] my_node_num:", my_node_num, "nodes:", list(interface.nodes.keys()))

            # Process all known nodes
            for node_num, node in interface.nodes.items():
                if node is None:
                    continue
                
                node_id_int = node_num
                if isinstance(node_num, str):
                    node_id_int = int(node_num.lstrip("!"), 16) if node_num.startswith("!") else int(node_num)
                else:
                    node_id_int = int(node_num)

                # Battery, Voltage, USB
                dm = node.get("deviceMetrics", {})
                usb_power = dm.get("usbPower")
                if dm and dm.get("batteryLevel") is not None:
                    batteryLevel = min(dm.get("batteryLevel"), 100)
                    voltage = dm.get("voltage")
                else:
                    if node_num == my_node_num:
                        bl = myInfo.get("batteryLevel")
                        vl = myInfo.get("voltage")
                        if bl is not None:
                            batteryLevel = min(bl, 100)
                            voltage = vl if vl else None
                        else:
                            batteryLevel = None
                            voltage = None
                    else:
                        batteryLevel = None
                        voltage = None

                if usb_power is None:
                    usb_power = (node_num == my_node_num)

                if debug:
                    user_tmp = node.get("user", {})
                    sn_debug = user_tmp.get('shortName', '?')
                    print(f"[DEBUG] {sn_debug} deviceMetrics: {dm}")

                # SNR
                snr = node.get("snr", 0.0)

                # RSSI
                node_num_int = int(node_num.lstrip("!"), 16) if isinstance(node_num, str) and node_num.startswith("!") else int(node_num) if isinstance(node_num, str) else node_num
                rssi = node_rssi.get(node_num_int, 0)

                # Role
                user = node.get("user", {})
                is_router = user.get("isRouter", False)
                role_str = user.get("role", "")
                if role_str:
                    role = role_str
                elif is_router:
                    role = "ROUTER"
                else:
                    role = "CLIENT"

                # Update name cache
                sn = user.get("shortName", "")
                ln = user.get("longName", "")
                _update_node_name(node_id_int, sn, ln)

                node_entry = {
                    "nodeId": node_id_int,
                    "name": user.get("longName", f"Node {node_num}"),
                    "shortName": user.get("shortName", f"N{node_num}")[:4],
                    "hardwareModel": user.get("hwModel", "T-Echo"),
                    "role": role,
                    "batteryLevel": batteryLevel,
                    "voltage": round(voltage, 2) if voltage else None,
                    "usbPower": usb_power,
                    "snr": round(snr, 1) if snr else 0.0,
                    "rssi": rssi,
                }

                # Position
                pubsub_pos = node_position.get(node_id_int)
                if pubsub_pos:
                    node_entry["latitude"] = pubsub_pos["latitude"]
                    node_entry["longitude"] = pubsub_pos["longitude"]
                    node_entry["altitude"] = pubsub_pos.get("altitude", 0)
                    if pubsub_pos.get("receivedAt"):
                        node_entry.setdefault("lastHeard", pubsub_pos["receivedAt"])
                else:
                    pos = node.get("position", {})
                    if pos:
                        lat_i = pos.get("latitudeI", pos.get("latitude", 0))
                        lon_i = pos.get("longitudeI", pos.get("longitude", 0))
                        if isinstance(lat_i, int) and lat_i != 0:
                            node_entry["latitude"] = lat_i / 1e7
                        elif isinstance(lat_i, float) and lat_i != 0:
                            node_entry["latitude"] = lat_i
                        if isinstance(lon_i, int) and lon_i != 0:
                            node_entry["longitude"] = lon_i / 1e7
                        elif isinstance(lon_i, float) and lon_i != 0:
                            node_entry["longitude"] = lon_i
                        if node_entry.get("latitude"):
                            node_entry["altitude"] = pos.get("altitude", 0)
                
                # Environment metrics
                env = node.get("environmentMetrics", {})
                if env:
                    node_entry["temperature"] = env.get("temperature")
                    node_entry["humidity"] = env.get("humidity")

                # lastHeard
                heard_time = None
                if node_id_int in node_last_heard:
                    heard_time = node_last_heard[node_id_int]
                if not heard_time and pubsub_pos and pubsub_pos.get("receivedAt"):
                    heard_time = pubsub_pos["receivedAt"]
                if not heard_time:
                    meshtastic_lh = node.get("lastHeard")
                    if meshtastic_lh and isinstance(meshtastic_lh, (int, float)) and meshtastic_lh > 0:
                        heard_time = format_timestamp(meshtastic_lh)
                if heard_time:
                    node_entry["lastHeard"] = heard_time

                nodes_data.append(node_entry)

            # Periodic summary
            if not realtime:
                # Old-style: print each node on each cycle
                timestamp_debug = datetime.now().strftime("%H:%M:%S")
                for ne in nodes_data:
                    gps = f"gps={ne['latitude']:.4f},{ne['longitude']:.4f}" if ne.get("latitude") else "gps=no"
                    bat_str = f"bat={ne['batteryLevel']:3d}%" if ne['batteryLevel'] is not None else "bat=  ?%"
                    volt_str = f"({ne['voltage']:.2f}V)" if ne.get('voltage') else "(  ?V)"
                    usb_str = " [USB]" if ne.get('usbPower') else ""
                    heard = f"heard={ne.get('lastHeard', '?')}"
                    print(f"  [{timestamp_debug}] {ne['shortName']:4s} {bat_str} {volt_str}{usb_str} snr={ne.get('snr',0):.1f} rssi={ne.get('rssi',0)} {gps} {heard}")

            # Send periodic sync to dashboard
            if nodes_data:
                sync_url = f"{dashboard_url}/api/meshtastic/sync"
                success, response = http_post(sync_url, {
                    "source": "serial",
                    "nodes": nodes_data,
                })
                
                timestamp = datetime.now().strftime("%H:%M:%S")
                if success:
                    if not realtime:
                        print(f"[{timestamp}] Отправлено {len(nodes_data)} узлов -> дашборд")
                else:
                    print(f"[{timestamp}] Ошибка отправки: {response}")

            # Print rate info (every ~interval)
            if realtime:
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"\033[90m[{timestamp}] Пакетов: {packet_count[0]} | "
                      f"Скорость: {packet_rate[0]}/мин | "
                      f"Узлов: {len(nodes_data)}\033[0m")

            if debug:
                print(f"[DEBUG] node_rssi: {node_rssi}")
                pos_dbg = {str(k): v.get('receivedAt', '?') for k, v in node_position.items()}
                print(f"[DEBUG] node_position timestamps: {pos_dbg}")
                print(f"[DEBUG] node_last_heard: {node_last_heard}")

        except Exception as e:
            print(f"Ошибка чтения: {e}")

        # Wait for next poll
        for _ in range(interval):
            if not running:
                break
            time.sleep(1)

    _bridge_interface[0] = None
    _bridge_running[0] = False
    http_server.shutdown()
    interface.close()
    print("Отключено от устройства")


# ─── MQTT Mode ─────────────────────────────────────────────────────────────

def mqtt_mode(broker, topic, dashboard_url, username=None, password=None):
    """Connect to MQTT broker and listen for Meshtastic messages."""
    if not HAS_MQTT:
        print("ОШИБКА: Установите paho-mqtt: pip install paho-mqtt")
        sys.exit(1)

    if not HAS_MESHTASTIC_MQTT:
        print("Протокол Meshtastic MQTT недоступен (portnums/mesh_pb2).")
        print("  MQTT-режим будет работать в упрощённом режиме (только логирование).")

    print(f"Подключение к MQTT брокеру: {broker}")
    print(f"Топик: {topic}")

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

    if username:
        client.username_pw_set(username, password)

    def on_connect(client, userdata, flags, rc, properties=None):
        if rc == 0:
            print("Подключено к MQTT брокеру")
            client.subscribe(topic)
            print(f"Подписка на: {topic}")
        else:
            print(f"Ошибка подключения MQTT: код {rc}")

    def on_message(client, userdata, msg):
        try:
            payload = msg.payload

            if HAS_MESHTASTIC_MQTT:
                try:
                    packet = MeshPacket()
                    packet.ParseFromString(payload)

                    from_id = getattr(packet, 'from', 0)
                    now_local = datetime.now().strftime("%H:%M:%S")
                    pkt_type = portnum_name(getattr(packet, 'portnum', 0))
                    sn = _get_node_name(int(from_id))
                    
                    print(f"  \033[90m[{now_local}]\033[0m "
                          f"\033[1m{sn:4s}\033[0m "
                          f"\033[36m{pkt_type:20s}\033[0m "
                          f"rssi={packet.rxRssi} snr={packet.rxSnr:.1f}")

                    node_data = {
                        "nodeId": from_id,
                        "snr": packet.rxSnr,
                        "rssi": packet.rxRssi,
                    }

                    sync_url = f"{dashboard_url}/api/meshtastic/sync"
                    http_post(sync_url, {
                        "source": "mqtt",
                        "nodes": [node_data],
                    })

                    # Используем время пакета (rx_time) если есть, иначе текущее время
                    rx_time = extract_rx_time(packet)
                    if rx_time:
                        pkt_received_at = format_timestamp(rx_time)
                    else:
                        pkt_received_at = format_timestamp()

                    # Send raw packet too
                    pkt_entry = {
                        "receivedAt": pkt_received_at,
                        "fromId": int(from_id),
                        "fromName": sn,
                        "packetType": pkt_type,
                        "rssi": packet.rxRssi,
                        "snr": packet.rxSnr,
                    }
                    http_post(f"{dashboard_url}/api/packets", {"packet": pkt_entry})

                except Exception:
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    print(f"[{timestamp}] Сообщение на {msg.topic} ({len(payload)} байт)")
            else:
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"[{timestamp}] Сообщение на {msg.topic} ({len(payload)} байт)")

        except Exception as e:
            print(f"Ошибка обработки MQTT: {e}")

    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(broker.replace("mqtt://", "").split(":")[0], 
                      int(broker.split(":")[-1]) if ":" in broker else 1883)
    except Exception as e:
        print(f"Не удалось подключиться к MQTT: {e}")
        sys.exit(1)

    print("Слушаю сообщения... (Ctrl+C для остановки)")
    
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        client.disconnect()
        print("\nОтключено от MQTT")


# ─── Main ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="T-Echo Meshtastic Bridge — подключение устройств к дашборду"
    )
    parser.add_argument("--mode", choices=["serial", "mqtt"], required=True,
                       help="Режим подключения: serial (USB) или mqtt")
    parser.add_argument("--port", default="/dev/ttyUSB0",
                       help="Serial порт (только для serial режима, по умолчанию: /dev/ttyUSB0)")
    parser.add_argument("--broker", default="mqtt.meshtastic.org:1883",
                       help="MQTT брокер (только для mqtt режима)")
    parser.add_argument("--topic", default="msh/EU_433/#",
                       help="MQTT топик (по умолчанию: msh/EU_433/#)")
    parser.add_argument("--mqtt-user", default=None,
                       help="MQTT имя пользователя")
    parser.add_argument("--mqtt-pass", default=None,
                       help="MQTT пароль")
    parser.add_argument("--dashboard", default="http://localhost:3000",
                       help="URL дашборда (по умолчанию: http://localhost:3000)")
    parser.add_argument("--interval", type=int, default=30,
                       help="Интервал синхронизации в секундах (по умолчанию: 30)")
    parser.add_argument("--no-realtime", action="store_true",
                       help="Отключить реалтайм-мониторинг (только периодический опрос)")
    parser.add_argument("--debug", action="store_true",
                       help="Включить debug-вывод (pubsub, RSSI, структура пакетов)")
    parser.add_argument("--api-port", type=int, default=8420,
                       help="Порт HTTP API моста для приёма команд (по умолчанию: 8420)")

    args = parser.parse_args()

    print("=" * 60)
    print("  T-Echo Meshtastic Bridge")
    print("  Подключение устройств к дашборду")
    print("=" * 60)

    if args.mode == "serial":
        serial_mode(args.port, args.dashboard, args.interval, 
                   debug=args.debug, realtime=not args.no_realtime, api_port=args.api_port)
    elif args.mode == "mqtt":
        mqtt_mode(args.broker, args.topic, args.dashboard, 
                 args.mqtt_user, args.mqtt_pass)


if __name__ == "__main__":
    main()
