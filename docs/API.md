# HTTP API Documentation

## Base URL

`http://localhost:8080`

## Endpoints

### Health Check

Check if the server is running and healthy.

**Endpoint:** `GET /health`

**Response:**
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

**Status Codes:**
- `200 OK` - Server is healthy
- `503 Service Unavailable` - Server is not healthy

### System Status

Get detailed system information.

**Endpoint:** `GET /api/status`

**Response:**
```json
{
  "server": {
    "name": "IceNet MQTT Server",
    "version": "1.0.0",
    "uptime": 3600,
    "nodeVersion": "v18.0.0"
  },
  "mqtt": {
    "running": true,
    "clients": 5,
    "port": 1883,
    "wsPort": 8883
  },
  "meshtastic": {
    "enabled": true,
    "connected": true,
    "serialPort": "/dev/ttyUSB0"
  },
  "reticulum": {
    "enabled": true,
    "running": true
  },
  "router": {
    "mqttClients": 5,
    "meshtasticConnected": true,
    "reticulumRunning": true
  }
}
```

### Get Connected Clients

List all connected MQTT clients.

**Endpoint:** `GET /api/clients`

**Response:**
```json
{
  "clients": [
    {
      "id": "client-1234",
      "connected": true
    },
    {
      "id": "client-5678",
      "connected": true
    }
  ],
  "count": 2
}
```

### Publish Message

Publish a message to an MQTT topic via HTTP.

**Endpoint:** `POST /api/publish`

**Request Body:**
```json
{
  "topic": "test/topic",
  "message": "Hello World",
  "qos": 1,
  "retain": false
}
```

**Parameters:**
- `topic` (required): MQTT topic to publish to
- `message` (required): Message payload (string or object)
- `qos` (optional): Quality of Service (0, 1, or 2), default: 0
- `retain` (optional): Retain flag (boolean), default: false

**Response:**
```json
{
  "success": true,
  "topic": "test/topic",
  "message": "Hello World"
}
```

**Status Codes:**
- `200 OK` - Message published successfully
- `400 Bad Request` - Missing required parameters
- `500 Internal Server Error` - Failed to publish message

### Get Configuration

Get server configuration (sensitive data excluded).

**Endpoint:** `GET /api/config`

**Response:**
```json
{
  "mqtt": {
    "host": "0.0.0.0",
    "port": 1883,
    "wsPort": 8883,
    "maxConnections": 1000
  },
  "meshtastic": {
    "enabled": true,
    "topicPrefix": "meshtastic"
  },
  "reticulum": {
    "enabled": true,
    "topicPrefix": "reticulum"
  }
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message description"
}
```

**Common Status Codes:**
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Endpoint not found
- `500 Internal Server Error` - Server error

## Authentication

Currently, the HTTP API does not require authentication. For production deployments, consider adding authentication middleware or using a reverse proxy with authentication.

## Rate Limiting

No rate limiting is currently implemented. Consider adding rate limiting for production deployments.

## CORS

CORS is enabled for all origins (`*`). In production, configure this to allow only specific origins.
