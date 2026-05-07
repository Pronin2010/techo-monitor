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
from datetime import datetime

try:
    import meshtastic
    import meshtastic.serial_interface
    import meshtastic.tcp_interface
    from meshtastic import portnums
    from meshtastic.mesh_pb2 import MeshPacket
    HAS_MESHTASTIC = True
except ImportError:
    HAS_MESHTASTIC = False

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

def serial_mode(port, dashboard_url, interval):
    """Connect to T-Echo via USB serial and poll node info."""
    if not HAS_MESHTASTIC:
        print("ОШИБКА: Установите meshtastic: pip install meshtastic")
        sys.exit(1)

    print(f"🔌 Подключение к T-Echo через {port}...")
    
    try:
        interface = meshtastic.serial_interface.SerialInterface(devPath=port)
    except Exception as e:
        print(f"ОШИБКА: Не удалось подключиться к {port}: {e}")
        print("Проверьте:")
        print("  1. Устройство подключено по USB")
        print("  2. Порт указан правильно (попробуйте: python -m meshtastic --info)")
        print("  3. Устройство не занято другим приложением")
        sys.exit(1)

    print("✅ Подключено! Чтение данных из сети...")

    running = True

    def signal_handler(sig, frame):
        nonlocal running
        running = False
        print("\n⏹ Остановка...")
    
    signal.signal(signal.SIGINT, signal_handler)

    while running:
        try:
            nodes_data = []
            myInfo = interface.getMyNodeInfo()
            
            # Process all known nodes
            for node_num, node in interface.nodes.items():
                if node is None:
                    continue
                
                node_entry = {
                    "nodeId": node_num,
                    "name": node.get("user", {}).get("longName", f"Node {node_num}"),
                    "shortName": node.get("user", {}).get("shortName", f"N{node_num}")[:4],
                    "hardwareModel": node.get("user", {}).get("hwModel", "T-Echo"),
                    "role": "ROUTER" if node.get("user", {}).get("isRouter", False) else "CLIENT",
                    "batteryLevel": node.get("deviceMetrics", {}).get("batteryLevel", 100),
                    "voltage": node.get("deviceMetrics", {}).get("voltage", 3.7),
                    "snr": node.get("snr", 0.0),
                    "rssi": node.get("rssi", 0),
                }

                # Position
                pos = node.get("position", {})
                if pos and pos.get("latitude", 0) != 0:
                    node_entry["latitude"] = pos.get("latitude")
                    node_entry["longitude"] = pos.get("longitude")
                    node_entry["altitude"] = pos.get("altitude")
                
                # Environment metrics
                env = node.get("environmentMetrics", {})
                if env:
                    node_entry["temperature"] = env.get("temperature")
                    node_entry["humidity"] = env.get("humidity")

                nodes_data.append(node_entry)

            if nodes_data:
                sync_url = f"{dashboard_url}/api/meshtastic/sync"
                success, response = http_post(sync_url, {
                    "source": "serial",
                    "nodes": nodes_data,
                })
                
                timestamp = datetime.now().strftime("%H:%M:%S")
                if success:
                    print(f"[{timestamp}] 📡 Отправлено {len(nodes_data)} узлов → дашборд")
                else:
                    print(f"[{timestamp}] ❌ Ошибка отправки: {response}")
            else:
                print("⚠ Узлы не найдены. Устройства включены и в одной сети?")

        except Exception as e:
            print(f"❌ Ошибка чтения: {e}")

        # Wait for next poll
        for _ in range(interval):
            if not running:
                break
            time.sleep(1)

    interface.close()
    print("👋 Отключено от устройства")


# ─── MQTT Mode ─────────────────────────────────────────────────────────────

def mqtt_mode(broker, topic, dashboard_url, username=None, password=None):
    """Connect to MQTT broker and listen for Meshtastic messages."""
    if not HAS_MQTT:
        print("ОШИБКА: Установите paho-mqtt: pip install paho-mqtt")
        sys.exit(1)

    print(f"📡 Подключение к MQTT брокеру: {broker}")
    print(f"📡 Топик: {topic}")

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

    if username:
        client.username_pw_set(username, password)

    def on_connect(client, userdata, flags, rc, properties=None):
        if rc == 0:
            print("✅ Подключено к MQTT брокеру")
            client.subscribe(topic)
            print(f"📡 Подписка на: {topic}")
        else:
            print(f"❌ Ошибка подключения MQTT: код {rc}")

    def on_message(client, userdata, msg):
        try:
            # Meshtastic MQTT messages are protobuf-encoded
            # For a basic implementation, we extract what we can
            payload = msg.payload
            
            # Try to decode as MeshPacket
            try:
                packet = MeshPacket()
                packet.ParseFromString(payload)
                
                node_data = {
                    "nodeId": getattr(packet, 'from', 0),
                    "snr": packet.rxSnr,
                    "rssi": packet.rxRssi,
                }
                
                # Try to extract user info from decoded payload
                if packet.HasField("decoded"):
                    decoded = packet.decoded
                    if decoded.portnum == portnums.USER_APP:
                        # This is a node info packet
                        pass
                
                sync_url = f"{dashboard_url}/api/meshtastic/sync"
                http_post(sync_url, {
                    "source": "mqtt",
                    "nodes": [node_data],
                })
                
            except Exception:
                # If protobuf decoding fails, log raw message info
                topic_parts = msg.topic.split("/")
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"[{timestamp}] 📨 Сообщение на {msg.topic} ({len(payload)} байт)")

        except Exception as e:
            print(f"❌ Ошибка обработки MQTT: {e}")

    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(broker.replace("mqtt://", "").split(":")[0], 
                      int(broker.split(":")[-1]) if ":" in broker else 1883)
    except Exception as e:
        print(f"❌ Не удалось подключиться к MQTT: {e}")
        sys.exit(1)

    print("🔄 Слушаю сообщения... (Ctrl+C для остановки)")
    
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        client.disconnect()
        print("\n👋 Отключено от MQTT")


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

    args = parser.parse_args()

    print("=" * 60)
    print("  T-Echo Meshtastic Bridge")
    print("  Подключение устройств к дашборду")
    print("=" * 60)

    if args.mode == "serial":
        serial_mode(args.port, args.dashboard, args.interval)
    elif args.mode == "mqtt":
        mqtt_mode(args.broker, args.topic, args.dashboard, 
                 args.mqtt_user, args.mqtt_pass)


if __name__ == "__main__":
    main()
