# Reticulum Integration Guide

## Overview

IceNet MQTT Server integrates with the Reticulum Network Stack, providing a bridge between MQTT and Reticulum's cryptographic networking protocol. This enables devices on the Reticulum network to communicate via MQTT and vice versa.

## What is Reticulum?

Reticulum is a cryptographic networking stack for building local and wide-area networks with minimal infrastructure. It provides:

- End-to-end encryption by default
- Multi-hop routing
- Support for various physical layers (LoRa, packet radio, TCP, UDP, etc.)
- Resilient, self-configuring mesh networking

Learn more at: https://reticulum.network/

## Prerequisites

### Install Reticulum

**Python Package:**
```bash
pip install rns
```

**Verify Installation:**
```bash
python3 -c "import RNS; print(RNS.__version__)"
```

### Configure Reticulum

Initialize Reticulum configuration:
```bash
rnsd --config
```

This creates configuration files in:
- Linux/macOS: `~/.reticulum/`
- Windows: `%USERPROFILE%\.reticulum\`

## IceNet Configuration

### Enable Reticulum

Edit `.env`:
```bash
RETICULUM_ENABLED=true
RETICULUM_CONFIG_PATH=~/.reticulum/config
RETICULUM_TOPIC_PREFIX=reticulum
```

### Docker Setup

Reticulum configuration should be mounted as a volume:

```yaml
volumes:
  - ~/.reticulum:/home/icenet/.reticulum:ro
```

## MQTT Topic Structure

### Transmit Packets (MQTT → Reticulum)

**Topic Format:**
```
reticulum/tx/<destination_hash>
```

**Parameters:**
- `<destination_hash>`: Reticulum destination hash (hexadecimal)

**Example:**
```bash
mosquitto_pub -t "reticulum/tx/a1b2c3d4e5f6" -m "Hello Reticulum!"
```

### Receive Packets (Reticulum → MQTT)

**Full Packet with Metadata:**
```
reticulum/rx/<source_hash>/<destination_hash>
```

Payload (JSON):
```json
{
  "source": "a1b2c3d4e5f6",
  "destination": "1f2e3d4c5b6a",
  "data": "SGVsbG8gUmV0aWN1bHVtIQ==",
  "timestamp": 1699999999000,
  "hops": 2
}
```

**Raw Data Only:**
```
reticulum/rx/<source_hash>/data
```

## Message Fields

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Source destination hash |
| `destination` | string | Destination hash |
| `data` | string | Base64-encoded payload |
| `timestamp` | number | Timestamp (milliseconds) |
| `hops` | number | Number of hops traversed |

## Getting Destination Hashes

### IceNet Server Hash

The server's destination hash is logged on startup:
```
Reticulum initialized. Destination: a1:b2:c3:d4:e5:f6
```

### Using Python

```python
import RNS

# Initialize Reticulum
reticulum = RNS.Reticulum()

# Load or create identity
identity = RNS.Identity()

# Create destination
destination = RNS.Destination(
    identity,
    RNS.Destination.IN,
    RNS.Destination.SINGLE,
    "example_app",
    "instance"
)

# Get hash
print(f"Destination hash: {RNS.prettyhexrep(destination.hash)}")
```

## Usage Examples

### Python Example

```python
import paho.mqtt.client as mqtt
import json
import base64

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    # Subscribe to all Reticulum packets
    client.subscribe("reticulum/rx/#")

def on_message(client, userdata, msg):
    if msg.topic.endswith('/data'):
        # Raw data
        print(f"Raw data: {msg.payload}")
    else:
        # JSON metadata
        data = json.loads(msg.payload)
        message_text = base64.b64decode(data['data']).decode('utf-8')
        print(f"From {data['source']}: {message_text}")
        print(f"Hops: {data.get('hops', 'N/A')}")

def send_reticulum_packet(client, dest_hash, message):
    topic = f"reticulum/tx/{dest_hash}"
    client.publish(topic, message)

client = mqtt.Client()
client.username_pw_set("admin", "changeme")
client.on_connect = on_connect
client.on_message = on_message

client.connect("localhost", 1883, 60)

# Send a message
send_reticulum_packet(client, "a1b2c3d4e5f6", "Hello Reticulum Network!")

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
  client.subscribe('reticulum/rx/#');
});

client.on('message', (topic, message) => {
  if (topic.endsWith('/data')) {
    console.log(`Raw data: ${message.toString()}`);
  } else {
    const data = JSON.parse(message.toString());
    const messageText = Buffer.from(data.data, 'base64').toString('utf-8');
    console.log(`From ${data.source}: ${messageText}`);
    console.log(`Hops: ${data.hops || 'N/A'}`);
  }
});

function sendReticulumPacket(destHash, message) {
  const topic = `reticulum/tx/${destHash}`;
  client.publish(topic, message);
}

setTimeout(() => {
  sendReticulumPacket('a1b2c3d4e5f6', 'Hello from Node.js!');
}, 5000);
```

## Reticulum Network Setup

### Local Testing

For local testing, you can run multiple Reticulum instances:

1. Start IceNet MQTT Server with Reticulum enabled
2. Run a separate Reticulum application on the same machine
3. They will communicate via the local UDP interface

### Physical Interfaces

Configure Reticulum interfaces in `~/.reticulum/config`:

**LoRa (RNode):**
```
[[RNode LoRa Interface]]
  type = RNodeInterface
  port = /dev/ttyUSB0
  frequency = 867200000
  bandwidth = 125000
  txpower = 7
  spreadingfactor = 8
  codingrate = 5
```

**TCP:**
```
[[TCP Server Interface]]
  type = TCPServerInterface
  enabled = yes
  listen_ip = 0.0.0.0
  listen_port = 4242
```

**UDP:**
```
[[UDP Interface]]
  type = UDPInterface
  enabled = yes
  listen_ip = 0.0.0.0
  listen_port = 4242
  forward_ip = 255.255.255.255
  forward_port = 4242
```

## Architecture

```
┌──────────────────────────────────────────────────┐
│                IceNet MQTT Server                 │
│  ┌────────────┐        ┌──────────────────┐     │
│  │    MQTT    │◄──────►│  Message Router  │     │
│  │   Broker   │        └──────────────────┘     │
│  └────────────┘                 ▲                │
│                                  │                │
│                          ┌───────▼────────┐      │
│                          │   Reticulum    │      │
│                          │    Adapter     │      │
│                          └───────┬────────┘      │
│                                  │                │
└──────────────────────────────────┼────────────────┘
                                   │ (stdio)
                          ┌────────▼─────────┐
                          │  Python Bridge   │
                          │  (RNS Library)   │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │ Reticulum Stack  │
                          │  - Encryption    │
                          │  - Routing       │
                          │  - Interfaces    │
                          └──────────────────┘
```

## Troubleshooting

### Python Not Found

Ensure Python 3.8+ is installed:
```bash
python3 --version
```

### RNS Module Not Found

Install Reticulum:
```bash
pip3 install rns
```

### Bridge Process Crashes

Check logs:
```bash
docker-compose logs -f | grep Reticulum
```

Test the bridge script directly:
```bash
python3 scripts/reticulum_bridge.py
```

### No Packets Received

1. Verify Reticulum is running
2. Check destination hashes are correct
3. Ensure Reticulum interfaces are configured
4. Check network connectivity

## Performance Considerations

- **Encryption Overhead**: All Reticulum packets are encrypted
- **Path Discovery**: Initial packet delivery may be slower
- **Packet Size**: Limited by physical layer (LoRa: ~237 bytes)
- **Latency**: Depends on number of hops and interface speed

## Security

### Built-in Encryption

Reticulum provides:
- End-to-end encryption (Curve25519)
- Perfect forward secrecy
- Identity verification

### Best Practices

1. Keep Reticulum identities secure
2. Use strong MQTT passwords
3. Enable TLS for MQTT connections
4. Restrict MQTT topic access
5. Monitor for unusual activity

## Advanced Topics

### Custom Identity

To use a specific Reticulum identity:

```python
# In scripts/reticulum_bridge.py
identity_path = "/path/to/custom/identity"
self.identity = RNS.Identity.from_file(identity_path)
```

### Announce Mechanism

Reticulum uses announces for path discovery. To announce periodically:

```python
# Add to ReticulumBridge class
def announce_loop(self):
    while self.running:
        self.destination.announce()
        time.sleep(300)  # Announce every 5 minutes
```

### Link Establishment

For bidirectional communication, establish links:

```python
link = RNS.Link(destination)
link.set_packet_callback(callback_function)
```

## Resources

- Reticulum Manual: https://reticulum.network/manual/
- RNS Python API: https://github.com/markqvist/Reticulum
- Community Forum: https://github.com/markqvist/Reticulum/discussions
