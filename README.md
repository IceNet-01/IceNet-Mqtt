# IceNet MQTT Server

A fully featured self-hosted MQTT server designed for Meshtastic devices and Reticulum network integration. Built with TypeScript and Node.js, this server provides seamless bridging between MQTT, Meshtastic mesh networks, and the Reticulum network stack.

## Features

- **Full MQTT Broker**: Standards-compliant MQTT 3.1.1 broker with TCP and WebSocket support
- **Meshtastic Integration**: Direct serial communication with Meshtastic devices
- **Reticulum Network**: Bridge MQTT messages with the Reticulum cryptographic networking stack
- **Message Routing**: Automatic routing between MQTT, Meshtastic, and Reticulum protocols
- **HTTP API**: RESTful API for monitoring and management
- **Authentication**: Built-in authentication and authorization
- **Persistence**: Optional message persistence
- **Docker Support**: Easy deployment with Docker and Docker Compose
- **Real-time Monitoring**: Health checks and status endpoints
- **Logging**: Comprehensive logging with configurable levels

## Quick Start

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/IceNet-01/IceNet-MQTT.git
cd IceNet-MQTT
```

2. Copy the environment template:
```bash
cp .env.example .env
```

3. Edit `.env` and configure your settings (authentication, ports, etc.)

4. Start the server:
```bash
docker-compose up -d
```

The server will be available at:
- MQTT TCP: `localhost:1883`
- MQTT WebSocket: `localhost:8883`
- HTTP API: `http://localhost:8080`

### Manual Installation

#### Prerequisites

- Node.js 18 or higher
- Python 3.8+ (for Reticulum support)
- npm or yarn

#### Installation Steps

1. Install dependencies:
```bash
npm install
```

2. Install Python dependencies (for Reticulum):
```bash
pip install rns
```

3. Copy and configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

4. Build the project:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Configuration

Configuration is managed through environment variables. See `.env.example` for all available options.

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 1883 | MQTT TCP port |
| `WS_PORT` | 8883 | MQTT WebSocket port |
| `HTTP_PORT` | 8080 | HTTP API port |
| `MQTT_HOST` | 0.0.0.0 | Bind address |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AUTH` | true | Enable MQTT authentication |
| `MQTT_USERNAME` | admin | MQTT username |
| `MQTT_PASSWORD` | changeme | MQTT password |

### Meshtastic Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MESHTASTIC_ENABLED` | true | Enable Meshtastic adapter |
| `MESHTASTIC_SERIAL_PORT` | /dev/ttyUSB0 | Serial port path |
| `MESHTASTIC_BAUD_RATE` | 115200 | Serial baud rate |
| `MESHTASTIC_TOPIC_PREFIX` | meshtastic | MQTT topic prefix |

### Reticulum Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `RETICULUM_ENABLED` | true | Enable Reticulum adapter |
| `RETICULUM_CONFIG_PATH` | ./config/reticulum.conf | Reticulum config path |
| `RETICULUM_TOPIC_PREFIX` | reticulum | MQTT topic prefix |

## Usage

### MQTT Client Connection

#### Using mosquitto_pub/sub

```bash
# Subscribe to all Meshtastic messages
mosquitto_sub -h localhost -p 1883 -u admin -P changeme -t "meshtastic/#" -v

# Publish to a Meshtastic device
mosquitto_pub -h localhost -p 1883 -u admin -P changeme \
  -t "meshtastic/tx/4294967295/0" -m "Hello Mesh!"
```

#### Using Node.js MQTT client

```javascript
const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://localhost:1883', {
  username: 'admin',
  password: 'changeme'
});

client.on('connect', () => {
  console.log('Connected to IceNet MQTT');

  // Subscribe to Meshtastic received messages
  client.subscribe('meshtastic/rx/#', (err) => {
    if (!err) console.log('Subscribed to Meshtastic');
  });
});

client.on('message', (topic, message) => {
  console.log(`${topic}: ${message.toString()}`);
});
```

#### Using Python MQTT client

```python
import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    client.subscribe("meshtastic/rx/#")

def on_message(client, userdata, msg):
    print(f"{msg.topic}: {msg.payload.decode()}")

client = mqtt.Client()
client.username_pw_set("admin", "changeme")
client.on_connect = on_connect
client.on_message = on_message

client.connect("localhost", 1883, 60)
client.loop_forever()
```

### Meshtastic Integration

#### Topic Structure

**Transmit to Meshtastic:**
- `meshtastic/tx/<to_node_id>/<channel>`
- Example: `meshtastic/tx/4294967295/0` (broadcast to channel 0)

**Receive from Meshtastic:**
- `meshtastic/rx/<from_node>/<to_node>/<channel>` - Full message with metadata (JSON)
- `meshtastic/rx/<from_node>/data` - Raw payload only

#### Message Format

Received messages are published as JSON:

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

### Reticulum Integration

#### Topic Structure

**Transmit to Reticulum:**
- `reticulum/tx/<destination_hash>`
- Example: `reticulum/tx/a1b2c3d4e5f6`

**Receive from Reticulum:**
- `reticulum/rx/<source_hash>/<destination_hash>` - Full packet with metadata (JSON)
- `reticulum/rx/<source_hash>/data` - Raw data only

#### Message Format

```json
{
  "source": "a1b2c3d4e5f6",
  "destination": "1f2e3d4c5b6a",
  "data": "SGVsbG8gUmV0aWN1bHVtIQ==",
  "timestamp": 1699999999000,
  "hops": 2
}
```

### HTTP API

#### Health Check

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2024-01-15T12:00:00.000Z",
  "services": {
    "mqtt": {
      "status": "running",
      "clients": 5
    },
    "meshtastic": {
      "status": "connected"
    },
    "reticulum": {
      "status": "running"
    }
  }
}
```

#### System Status

```bash
curl http://localhost:8080/api/status
```

#### Connected Clients

```bash
curl http://localhost:8080/api/clients
```

#### Publish Message via API

```bash
curl -X POST http://localhost:8080/api/publish \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "test/topic",
    "message": "Hello World",
    "qos": 1,
    "retain": false
  }'
```

## Hardware Setup

### Meshtastic Device Connection

1. Connect your Meshtastic device via USB
2. Identify the serial port:
   - Linux: `/dev/ttyUSB0` or `/dev/ttyACM0`
   - macOS: `/dev/cu.usbserial-*`
   - Windows: `COM3`, `COM4`, etc.

3. Update `.env`:
```bash
MESHTASTIC_ENABLED=true
MESHTASTIC_SERIAL_PORT=/dev/ttyUSB0
```

4. For Docker, uncomment device mapping in `docker-compose.yml`:
```yaml
devices:
  - /dev/ttyUSB0:/dev/ttyUSB0
```

### Reticulum Setup

1. Install Reticulum:
```bash
pip install rns
```

2. Configure Reticulum (optional):
```bash
rnsd --config
```

3. Enable in `.env`:
```bash
RETICULUM_ENABLED=true
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    IceNet MQTT Server                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────┐      ┌─────────────┐      ┌────────────┐ │
│  │   MQTT   │◄────►│   Message   │◄────►│ Meshtastic │ │
│  │  Broker  │      │   Router    │      │  Adapter   │ │
│  │ (Aedes)  │      │             │      │  (Serial)  │ │
│  └──────────┘      └─────────────┘      └────────────┘ │
│       ▲                   ▲                              │
│       │                   │                              │
│       │                   ▼                              │
│       │            ┌────────────┐                        │
│       │            │ Reticulum  │                        │
│       │            │  Adapter   │                        │
│       │            │  (Python)  │                        │
│       │            └────────────┘                        │
│       │                                                  │
│       ▼                                                  │
│  ┌──────────┐                                           │
│  │   HTTP   │                                           │
│  │   API    │                                           │
│  └──────────┘                                           │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Development

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Linting

```bash
npm run lint
```

### Format Code

```bash
npm run format
```

## Troubleshooting

### Meshtastic Device Not Connecting

1. Check serial port permissions:
```bash
sudo usermod -a -G dialout $USER
# Logout and login again
```

2. Verify device is detected:
```bash
ls -l /dev/ttyUSB*
```

3. Check logs:
```bash
docker-compose logs -f
```

### Reticulum Not Starting

1. Verify Python installation:
```bash
python3 --version
pip3 list | grep rns
```

2. Test Reticulum standalone:
```bash
python3 scripts/reticulum_bridge.py
```

### MQTT Connection Issues

1. Check authentication credentials
2. Verify ports are not in use:
```bash
sudo netstat -tlnp | grep 1883
```

3. Test connection:
```bash
mosquitto_pub -h localhost -p 1883 -u admin -P changeme -t test -m "hello"
```

## Security Considerations

1. **Change Default Password**: Always change the default MQTT password in production
2. **Use TLS**: Enable TLS for production deployments
3. **Firewall**: Restrict access to necessary ports only
4. **Network Isolation**: Use Docker networks or VPNs for sensitive deployments
5. **Regular Updates**: Keep dependencies updated

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: https://github.com/IceNet-01/IceNet-MQTT/issues
- Documentation: See `docs/` directory

## Acknowledgments

- [Aedes](https://github.com/moscajs/aedes) - MQTT broker
- [Meshtastic](https://meshtastic.org/) - Mesh network protocol
- [Reticulum](https://reticulum.network/) - Cryptographic networking stack
