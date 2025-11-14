# IceNet MQTT - Quick Start Guide

Get your IceNet MQTT server up and running in minutes!

## 🚀 Fastest Way to Start

### One Command Installation

```bash
git clone https://github.com/IceNet-01/IceNet-MQTT.git
cd IceNet-MQTT
./install.sh
```

The installation script will:
1. Check your system for Docker or Node.js
2. Ask you a few simple questions about your setup
3. Automatically configure everything
4. Start the server

**That's it!** 🎉

## 📊 Access Your Dashboard

Once installed, open your web browser and go to:

```
http://localhost:8080
```

You'll see a modern dashboard showing:
- Connected clients
- Server status
- Meshtastic and Reticulum status
- Real-time logs

## 🔧 Quick Configuration

### Via Web Dashboard (Easiest)

1. Click the **Settings** tab in the dashboard
2. Adjust any settings you need
3. Click **Save Configuration**
4. Restart the server

### Via Command Line

Edit the `.env` file:
```bash
nano .env
```

Common settings to change:
```bash
# Authentication
MQTT_USERNAME=admin
MQTT_PASSWORD=your-secure-password

# Ports
PORT=1883
WS_PORT=8883
HTTP_PORT=8080

# Meshtastic
MESHTASTIC_ENABLED=true
MESHTASTIC_SERIAL_PORT=/dev/ttyUSB0

# Reticulum
RETICULUM_ENABLED=false
```

## 📱 Connect Your First Client

### Using mosquitto_sub (Command Line)

Subscribe to all messages:
```bash
mosquitto_sub -h localhost -p 1883 -u admin -P changeme -t "#" -v
```

### Using MQTT.js (Node.js)

```javascript
const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://localhost:1883', {
  username: 'admin',
  password: 'changeme'
});

client.on('connect', () => {
  console.log('Connected!');
  client.subscribe('test/#');
});

client.on('message', (topic, message) => {
  console.log(`${topic}: ${message.toString()}`);
});
```

### Using Python

```python
import paho.mqtt.client as mqtt

client = mqtt.Client()
client.username_pw_set('admin', 'changeme')
client.connect('localhost', 1883)

client.subscribe('test/#')
client.loop_forever()
```

## 🌐 Meshtastic Setup

1. Connect your Meshtastic device via USB
2. Find the serial port:
   - Linux: `/dev/ttyUSB0` or `/dev/ttyACM0`
   - macOS: `/dev/cu.usbserial-*`
   - Windows: `COM3` or similar

3. Enable in Settings tab or `.env`:
   ```bash
   MESHTASTIC_ENABLED=true
   MESHTASTIC_SERIAL_PORT=/dev/ttyUSB0
   ```

4. Subscribe to mesh messages:
   ```bash
   mosquitto_sub -t "meshtastic/rx/#" -u admin -P changeme
   ```

5. Send a broadcast:
   ```bash
   mosquitto_pub -t "meshtastic/tx/4294967295/0" -m "Hello Mesh!" -u admin -P changeme
   ```

## 🔌 Test Your Setup

### From the Dashboard

1. Go to the Dashboard tab
2. Click **Test Publish**
3. Check the Logs tab to see it worked

### From Command Line

Terminal 1 (Subscribe):
```bash
mosquitto_sub -h localhost -u admin -P changeme -t test/hello
```

Terminal 2 (Publish):
```bash
mosquitto_pub -h localhost -u admin -P changeme -t test/hello -m "Hello World!"
```

You should see "Hello World!" appear in Terminal 1!

## 🛠️ Managing the Server

### Docker Installation

```bash
# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose stop

# Start
docker-compose start

# Remove (keeps data)
docker-compose down
```

### Native Installation

```bash
# Start
npm start

# Start in development mode
npm run dev

# View logs
tail -f logs/icenet-mqtt.log

# Using systemd (if installed)
systemctl --user status icenet-mqtt
systemctl --user restart icenet-mqtt
```

## 📋 Common Tasks

### Change the Password

1. Go to **Settings** tab in dashboard
2. Enter new password
3. Click **Save Configuration**
4. Restart server

### Add Persistence

Set in `.env`:
```bash
ENABLE_PERSISTENCE=true
PERSISTENCE_PATH=./mqtt-data
```

### Enable TLS/SSL

1. Generate certificates:
   ```bash
   mkdir -p certs
   openssl req -newkey rsa:2048 -nodes -keyout certs/server.key \
     -x509 -days 365 -out certs/server.crt
   ```

2. Update `.env`:
   ```bash
   ENABLE_TLS=true
   TLS_CERT_PATH=./certs/server.crt
   TLS_KEY_PATH=./certs/server.key
   ```

### Check System Status

Via Dashboard: Go to http://localhost:8080

Via API:
```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/status
```

## 🐛 Troubleshooting

### Can't Access Dashboard

1. Check if server is running:
   ```bash
   curl http://localhost:8080/health
   ```

2. Check firewall:
   ```bash
   sudo ufw allow 8080
   ```

3. Check logs in the dashboard or:
   ```bash
   docker-compose logs -f
   # or
   tail -f logs/icenet-mqtt.log
   ```

### Meshtastic Not Connecting

1. Check USB connection
2. Verify port permissions (Linux):
   ```bash
   sudo usermod -a -G dialout $USER
   # Logout and login again
   ```

3. Check the port:
   ```bash
   ls -l /dev/ttyUSB*
   ```

### Authentication Failed

Make sure you're using the correct credentials from your `.env` file:
```bash
cat .env | grep MQTT_USERNAME
cat .env | grep MQTT_PASSWORD
```

## 🎓 Next Steps

- Read the [full documentation](README.md)
- Check out [example clients](examples/)
- Learn about [Meshtastic integration](docs/MESHTASTIC.md)
- Explore [Reticulum networking](docs/RETICULUM.md)
- Review the [HTTP API](docs/API.md)

## 💡 Tips

- **Bookmark the dashboard** for easy access
- **Use the web interface** for configuration - it's easier than editing files
- **Check logs regularly** via the Logs tab
- **Test with mosquitto tools** before connecting real devices
- **Enable authentication** in production environments

## 🆘 Need Help?

- Check the dashboard **Logs** tab for error messages
- Visit our [GitHub Issues](https://github.com/IceNet-01/IceNet-MQTT/issues)
- Review the [full documentation](README.md)

---

**You're all set!** Start sending messages and enjoy your new MQTT server! 🚀
