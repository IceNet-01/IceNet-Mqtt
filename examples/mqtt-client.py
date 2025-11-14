#!/usr/bin/env python3
"""
Example MQTT Client for IceNet MQTT Server

This example demonstrates:
- Connecting to the MQTT broker
- Subscribing to Meshtastic and Reticulum topics
- Publishing messages
- Handling received messages

Install dependencies:
    pip install paho-mqtt

Usage:
    python3 mqtt-client.py
"""

import paho.mqtt.client as mqtt
import json
import base64
import time
from datetime import datetime

# Configuration
CONFIG = {
    'host': 'localhost',
    'port': 1883,
    'username': 'admin',
    'password': 'changeme',
    'client_id': f'mqtt-client-{int(time.time())}'
}


def on_connect(client, userdata, flags, rc):
    """Callback for when the client receives a CONNACK response from the server."""
    if rc == 0:
        print(f"✓ Connected to IceNet MQTT Server")
        print()

        # Subscribe to topics
        topics = [
            ('meshtastic/rx/#', 0),
            ('reticulum/rx/#', 0),
            ('test/#', 0)
        ]

        for topic, qos in topics:
            result = client.subscribe(topic, qos)
            if result[0] == mqtt.MQTT_ERR_SUCCESS:
                print(f"✓ Subscribed to: {topic}")
            else:
                print(f"✗ Failed to subscribe to {topic}")

        print()
        print("Listening for messages...")
        print("Press Ctrl+C to exit")
        print("─" * 60)

    else:
        print(f"✗ Connection failed with code {rc}")


def on_message(client, userdata, msg):
    """Callback for when a PUBLISH message is received from the server."""
    print()
    print(f"📨 Message received on topic: {msg.topic}")

    # Try to parse as JSON
    try:
        data = json.loads(msg.payload.decode('utf-8'))
        print("Payload (JSON):")
        print(json.dumps(data, indent=2))

        # Decode base64 data if present
        if 'data' in data:
            try:
                decoded = base64.b64decode(data['data']).decode('utf-8')
                print(f"Decoded message: {decoded}")
            except UnicodeDecodeError:
                # Not valid UTF-8, show as hex
                decoded_hex = base64.b64decode(data['data']).hex()
                print(f"Decoded message (hex): {decoded_hex}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        # Not JSON, show raw
        print(f"Payload (raw): {msg.payload}")

    print("─" * 60)


def on_disconnect(client, userdata, rc):
    """Callback for when the client disconnects from the broker."""
    if rc != 0:
        print(f"⚠ Unexpected disconnection. Code: {rc}")


def on_publish(client, userdata, mid):
    """Callback for when a message is published."""
    print(f"✓ Message published (mid: {mid})")


def main():
    """Main function"""
    # Create MQTT client
    client = mqtt.Client(client_id=CONFIG['client_id'])
    client.username_pw_set(CONFIG['username'], CONFIG['password'])

    # Set callbacks
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect
    client.on_publish = on_publish

    # Connect to broker
    print(f"Connecting to mqtt://{CONFIG['host']}:{CONFIG['port']}...")
    try:
        client.connect(CONFIG['host'], CONFIG['port'], 60)
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        return

    # Publish a test message after 5 seconds
    def publish_test_message():
        time.sleep(5)
        print()
        print("📤 Publishing test message...")
        payload = json.dumps({
            'message': 'Hello from Python MQTT client!',
            'timestamp': datetime.now().isoformat()
        })
        client.publish('test/example', payload)

    import threading
    threading.Thread(target=publish_test_message, daemon=True).start()

    # Start the loop
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print()
        print("Disconnecting...")
        client.disconnect()


if __name__ == '__main__':
    main()
