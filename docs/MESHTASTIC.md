# Meshtastic Integration Guide

## Overview

IceNet MQTT Server integrates directly with Meshtastic devices via serial connection, enabling MQTT clients to send and receive messages over the mesh network.

## Hardware Requirements

- Meshtastic device (any supported board: T-Beam, HELTEC, etc.)
- USB cable for serial connection
- Computer or Raspberry Pi running IceNet MQTT Server

## Setup

### 1. Connect Meshtastic Device

Connect your Meshtastic device via USB and identify the serial port:

**Linux:**
```bash
ls -l /dev/ttyUSB* /dev/ttyACM*
```

**macOS:**
```bash
ls -l /dev/cu.usbserial-*
```

**Windows:**
Check Device Manager for COM ports.

### 2. Configure Permissions (Linux)

Add your user to the dialout group:
```bash
sudo usermod -a -G dialout $USER
```

Logout and login for changes to take effect.

### 3. Update Configuration

Edit `.env`:
```bash
MESHTASTIC_ENABLED=true
MESHTASTIC_SERIAL_PORT=/dev/ttyUSB0
MESHTASTIC_BAUD_RATE=115200
MESHTASTIC_TOPIC_PREFIX=meshtastic
```

### 4. Docker Setup

If using Docker, uncomment device mapping in `docker-compose.yml`:

```yaml
devices:
  - /dev/ttyUSB0:/dev/ttyUSB0
```

## MQTT Topic Structure

### Transmit Messages (MQTT → Meshtastic)

**Topic Format:**
```
meshtastic/tx/<to_node_id>/<channel>
```

**Parameters:**
- `<to_node_id>`: Target node ID in decimal, or `4294967295` for broadcast
- `<channel>`: Channel number (0-7)

**Examples:**
```bash
# Broadcast to all nodes on channel 0
mosquitto_pub -t "meshtastic/tx/4294967295/0" -m "Hello everyone!"

# Send to specific node 123456789 on channel 1
mosquitto_pub -t "meshtastic/tx/123456789/1" -m "Private message"
```

### Receive Messages (Meshtastic → MQTT)

**Full Message with Metadata:**
```
meshtastic/rx/<from_node>/<to_node>/<channel>
```

Payload (JSON):
```json
{
  "from": 123456789,
  "to": 4294967295,
  "id": 1699999999000,
  "channel": 0,
  "data": "SGVsbG8gTWVzaCE=",
  "rxTime": 1699999999000,
  "rxSnr": 9.5,
  "rxRssi": -45,
  "hopLimit": 3
}
```

**Raw Data Only:**
```
meshtastic/rx/<from_node>/data
```

Payload: Raw binary data (base64 decoded)

## Message Fields

| Field | Type | Description |
|-------|------|-------------|
| `from` | number | Sender node ID |
| `to` | number | Recipient node ID (broadcast: 4294967295) |
| `id` | number | Message ID (timestamp) |
| `channel` | number | Channel number (0-7) |
| `data` | string | Base64-encoded payload |
| `rxTime` | number | Reception timestamp (ms) |
| `rxSnr` | number | Signal-to-noise ratio (dB) |
| `rxRssi` | number | Received signal strength (dBm) |
| `hopLimit` | number | Remaining hop count |

## Usage Examples

### Python Example

```python
import paho.mqtt.client as mqtt
import json
import base64

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    # Subscribe to all received messages
    client.subscribe("meshtastic/rx/#")

def on_message(client, userdata, msg):
    if msg.topic.endswith('/data'):
        # Raw data topic
        print(f"Raw data from {msg.topic}: {msg.payload}")
    else:
        # JSON metadata topic
        data = json.loads(msg.payload)
        message_text = base64.b64decode(data['data']).decode('utf-8')
        print(f"From node {data['from']}: {message_text}")
        print(f"SNR: {data.get('rxSnr', 'N/A')}, RSSI: {data.get('rxRssi', 'N/A')}")

# Send a message
def send_mesh_message(client, node_id, channel, message):
    topic = f"meshtastic/tx/{node_id}/{channel}"
    client.publish(topic, message)

client = mqtt.Client()
client.username_pw_set("admin", "changeme")
client.on_connect = on_connect
client.on_message = on_message

client.connect("localhost", 1883, 60)

# Send a broadcast message
send_mesh_message(client, 4294967295, 0, "Hello Mesh Network!")

client.loop_forever()
```

### Node.js Example

```javascript
const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://localhost:1883', {
  username: 'admin',
  password: 'changeme'
});

client.on('connect', () => {
  console.log('Connected to IceNet MQTT');
  client.subscribe('meshtastic/rx/#');
});

client.on('message', (topic, message) => {
  if (topic.endsWith('/data')) {
    console.log(`Raw data: ${message.toString()}`);
  } else {
    const data = JSON.parse(message.toString());
    const messageText = Buffer.from(data.data, 'base64').toString('utf-8');
    console.log(`From node ${data.from}: ${messageText}`);
    console.log(`SNR: ${data.rxSnr}, RSSI: ${data.rxRssi}`);
  }
});

// Send a broadcast message
function sendMeshMessage(nodeId, channel, message) {
  const topic = `meshtastic/tx/${nodeId}/${channel}`;
  client.publish(topic, message);
}

// Send broadcast after 5 seconds
setTimeout(() => {
  sendMeshMessage(4294967295, 0, 'Hello from Node.js!');
}, 5000);
```

## Node ID Reference

### Getting Node IDs

1. Using Meshtastic CLI:
```bash
meshtastic --info
```

2. Using Meshtastic app (iOS/Android)

3. From received MQTT messages (check `from` field)

### Broadcast Address

Use `4294967295` (0xFFFFFFFF) to broadcast to all nodes.

## Channel Configuration

Meshtastic supports 8 channels (0-7):
- Channel 0: Primary channel (default)
- Channels 1-7: Secondary channels (must be configured on devices)

Ensure both sender and receiver are configured for the same channel.

## Troubleshooting

### Device Not Detected

1. Check USB connection
2. Verify serial port permissions
3. Check if another program is using the port:
```bash
sudo lsof /dev/ttyUSB0
```

### No Messages Received

1. Verify Meshtastic device is powered on
2. Check serial connection in logs:
```bash
docker-compose logs -f | grep Meshtastic
```

3. Ensure devices are on the same channel
4. Check device range (LoRa has limited range indoors)

### Connection Keeps Dropping

1. Check USB cable quality
2. Verify power supply
3. Check system logs:
```bash
dmesg | grep ttyUSB
```

## Performance Considerations

- **Message Size**: Keep messages under 237 bytes for LoRa transmission
- **Frequency**: Limit message frequency to avoid flooding the mesh
- **Acknowledgments**: Meshtastic provides automatic acknowledgments
- **Retries**: Messages may be retried automatically by Meshtastic

## Security

- Meshtastic encryption is handled at the device level
- Configure encryption keys on Meshtastic devices
- MQTT layer provides additional authentication
- Consider using MQTT over TLS for internet-facing deployments
