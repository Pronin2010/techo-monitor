#!/usr/bin/env python3
"""
T-Echo Meshtastic Bridge Script
Подключает физические T-Echo устройства к веб-дашборду.

Установка:
  pip install meshtastic

Запуск (USB):
  python techo-bridge.py --mode serial --port /dev/ttyUSB0 --dashboard http://YOUR_SERVER:3000

Запуск (MQTT):
  python techo-bridge.py --mode mqtt --broker mqtt://broker.hivemq.com:1883 --dashboard http://YOUR_SERVER:3000
"""

import argparse
import json
import sys
import time
import signal
import threading
from datetime import datetime, timezone

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
    payload = json.dumps(data).encode('utf-8')
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


# ─── Serial Mode ───────────────────────────────────────────────────────────

def serial_mode(port, dashboard_url, interval, debug=False):
    """Connect to T-Echo via USB serial and poll node info."""
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

    # ── RSSI + Position: PyPubSub — стандартный способ в meshtastic ──
    # interface.nodes обновляет позицию только из NodeInfo (~15 мин).
    # Position-пакеты от трекеров приходят чаще (~30с-5мин), но НЕ попадают
    # в interface.nodes[node].position — ловим их отдельно.
    node_rssi = {}
    node_position = {}  # {from_int: {lat, lon, alt}}
    node_last_heard = {}  # {from_int: ISO-8601 timestamp} — реальное время последнего пакета
    my_node_num_ref = [None]
    _first_position_logged = [False]

    try:
        from pubsub import pub

        def on_receive(packet, interface):
            """Вызывается через pubsub для ВСЕХ полученных пакетов."""
            try:
                from_num = packet.get("from", 0)
                rx_rssi = packet.get("rxRssi")
                rx_snr = packet.get("rxSnr")
                my_num = my_node_num_ref[0]
                if debug:
                    print(f"[DEBUG] pubsub: from={from_num} my_num={my_num} rxRssi={rx_rssi} rxSnr={rx_snr}")
                if not from_num:
                    return
                from_int = int(from_num) if not isinstance(from_num, int) else from_num
                # Пропускаем собственные пакеты (если знаем свой номер)
                if my_num and int(from_num) == int(my_num):
                    if debug:
                        print(f"[DEBUG] pubsub: SKIP own packet from={from_int}")
                    return
                # Запоминаем реальное время приёма пакета
                now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                node_last_heard[from_int] = now_iso
                if debug:
                    print(f"[DEBUG] pubsub: from={from_int} heard_at={now_iso}")
                # RSSI
                if rx_rssi is not None and int(rx_rssi) != 0:
                    node_rssi[from_int] = int(rx_rssi)
                    if debug:
                        print(f"[DEBUG] pubsub: SAVED from={from_int} rssi={rx_rssi}")
                # Position — проверяем decoded.position (camelCase)
                decoded = packet.get("decoded")
                if isinstance(decoded, dict):
                    pos = decoded.get("position")
                    if isinstance(pos, dict):
                        lat_i = pos.get("latitudeI")
                        lon_i = pos.get("longitudeI")
                        if isinstance(lat_i, int) and lat_i != 0 and isinstance(lon_i, int) and lon_i != 0:
                            node_position[from_int] = {
                                "latitude": lat_i / 1e7,
                                "longitude": lon_i / 1e7,
                                "altitude": pos.get("altitude", 0),
                                "receivedAt": now_iso,
                            }
                            if debug and not _first_position_logged[0]:
                                print(f"[DEBUG] pubsub: POSITION from={from_int} lat={lat_i/1e7:.6f} lon={lon_i/1e7:.6f} alt={pos.get('altitude',0)}")
                                _first_position_logged[0] = True
                    # Логируем структуру decoded при первом пакете (для отладки)
                    elif debug and not _first_position_logged[0]:
                        print(f"[DEBUG] pubsub: decoded keys={list(decoded.keys())} (no position key)")
                        _first_position_logged[0] = True
            except Exception as e:
                if debug:
                    print(f"[DEBUG] pubsub handler ERROR: {e}")

        pub.subscribe(on_receive, 'meshtastic.receive')
        if debug:
            print("[DEBUG] pubsub subscribed to 'meshtastic.receive'")
    except ImportError:
        print("[WARN] pubsub не установлен! RSSI не будет отслеживаться.")
        print("[WARN] Установите: pip install PyPubSub")

    # Получаем my_node_num ДО сна — чтобы pubsub callback мог фильтровать self-пакеты
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
                
                # Meshtastic nodeId может быть hex-строкой ("!d4b597d0") или int
                node_id_int = node_num
                if isinstance(node_num, str):
                    node_id_int = int(node_num.lstrip("!"), 16) if node_num.startswith("!") else int(node_num)
                else:
                    node_id_int = int(node_num)

                # ── Battery, Voltage, USB ──
                dm = node.get("deviceMetrics", {})
                usb_power = dm.get("usbPower")  # Прямое поле из Meshtastic
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

                # USB: только для локального узла (my_node), подключённого к COM-порту.
                # Удалённые ноды питаются неизвестно — нет надёжного способа определить.
                if usb_power is None:
                    usb_power = (node_num == my_node_num)

                if debug:
                    user_tmp = node.get("user", {})
                    sn_debug = user_tmp.get('shortName', '?')
                    print(f"[DEBUG] {sn_debug} deviceMetrics: {dm}")

                # ── SNR ──
                snr = node.get("snr", 0.0)

                # ── RSSI ──
                node_num_int = int(node_num.lstrip("!"), 16) if isinstance(node_num, str) and node_num.startswith("!") else int(node_num) if isinstance(node_num, str) else node_num
                rssi = node_rssi.get(node_num_int, 0)

                # ── Role ──
                user = node.get("user", {})
                is_router = user.get("isRouter", False)
                role_str = user.get("role", "")
                if role_str:
                    role = role_str
                elif is_router:
                    role = "ROUTER"
                else:
                    role = "CLIENT"

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

                # lastHeard — приоритет:
                # 1. pubsub callback (реальное время приёма любого пакета)
                # 2. position.receivedAt (время приёма position-пакета)
                # 3. lastHeard из Meshtastic NodeInfo (когда нода последний раз себя видела)
                # 4. fallback: текущее время (уже нет данных)
                heard_time = None
                if node_id_int in node_last_heard:
                    heard_time = node_last_heard[node_id_int]
                # Position — приоритет: pubsub (Position-пакеты, свежие)
                # затем fallback: interface.nodes (NodeInfo, до 15 мин)
                pubsub_pos = node_position.get(node_id_int)
                if pubsub_pos:
                    node_entry["latitude"] = pubsub_pos["latitude"]
                    node_entry["longitude"] = pubsub_pos["longitude"]
                    node_entry["altitude"] = pubsub_pos.get("altitude", 0)
                    # Если позиция имеет receivedAt — используем его как lastHeard для позиции
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

                # lastHeard: используем лучший доступный timestamp
                if not heard_time and pubsub_pos and pubsub_pos.get("receivedAt"):
                    heard_time = pubsub_pos["receivedAt"]
                if not heard_time:
                    # Meshtastic NodeInfo иногда имеет lastHeard (UNIX timestamp в секундах)
                    meshtastic_lh = node.get("lastHeard")
                    if meshtastic_lh and isinstance(meshtastic_lh, (int, float)) and meshtastic_lh > 0:
                        heard_time = datetime.fromtimestamp(meshtastic_lh, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                if heard_time:
                    node_entry["lastHeard"] = heard_time

                nodes_data.append(node_entry)
                timestamp_debug = datetime.now().strftime("%H:%M:%S")
                gps = f"gps={node_entry['latitude']:.4f},{node_entry['longitude']:.4f}" if node_entry.get("latitude") else "gps=no"
                bat_str = f"bat={batteryLevel:3d}%" if batteryLevel is not None else "bat=  ?%"
                volt_str = f"({round(voltage, 2):.2f}V)" if voltage else "(  ?V)"
                usb_str = " [USB]" if usb_power else ""
                heard = f"heard={node_entry.get('lastHeard', '?')}"
                print(f"  [{timestamp_debug}] {node_entry['shortName']:4s} {bat_str} {volt_str}{usb_str} snr={snr:.1f} rssi={rssi} {gps} {heard}")

            if debug:
                print(f"[DEBUG] node_rssi: {node_rssi}")
                pos_dbg = {str(k): v.get('receivedAt', '?') for k, v in node_position.items()}
                print(f"[DEBUG] node_position timestamps: {pos_dbg}")
                print(f"[DEBUG] node_last_heard: {node_last_heard}")

            if nodes_data:
                sync_url = f"{dashboard_url}/api/meshtastic/sync"
                success, response = http_post(sync_url, {
                    "source": "serial",
                    "nodes": nodes_data,
                })
                
                timestamp = datetime.now().strftime("%H:%M:%S")
                if success:
                    print(f"[{timestamp}] Отправлено {len(nodes_data)} узлов -> дашборд")
                else:
                    print(f"[{timestamp}] Ошибка отправки: {response}")
            else:
                print("Узлы не найдены. Устройства включены и в одной сети?")

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
                       help="Интервал опроса в секундах (только serial, по умолчанию: 30)")
    parser.add_argument("--debug", action="store_true",
                       help="Включить debug-вывод (pubsub, RSSI, структура пакетов)")

    args = parser.parse_args()

    print("=" * 60)
    print("  T-Echo Meshtastic Bridge")
    print("  Подключение устройств к дашборду")
    print("=" * 60)

    if args.mode == "serial":
        serial_mode(args.port, args.dashboard, args.interval, debug=args.debug)
    elif args.mode == "mqtt":
        mqtt_mode(args.broker, args.topic, args.dashboard, 
                 args.mqtt_user, args.mqtt_pass)


if __name__ == "__main__":
    main()
