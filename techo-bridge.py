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


# ─── Serial Mode ───────────────────────────────────────────────────────────

def serial_mode(port, dashboard_url, interval, debug=False, realtime=True):
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

                # Время приёма
                now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
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
                        heard_time = datetime.fromtimestamp(meshtastic_lh, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
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

                    # Send raw packet too
                    pkt_entry = {
                        "receivedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
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

    args = parser.parse_args()

    print("=" * 60)
    print("  T-Echo Meshtastic Bridge")
    print("  Подключение устройств к дашборду")
    print("=" * 60)

    if args.mode == "serial":
        serial_mode(args.port, args.dashboard, args.interval, 
                   debug=args.debug, realtime=not args.no_realtime)
    elif args.mode == "mqtt":
        mqtt_mode(args.broker, args.topic, args.dashboard, 
                 args.mqtt_user, args.mqtt_pass)


if __name__ == "__main__":
    main()
