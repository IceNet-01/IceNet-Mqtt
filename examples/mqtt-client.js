#!/usr/bin/env node
/**
 * Example MQTT Client for IceNet MQTT Server
 *
 * This example demonstrates:
 * - Connecting to the MQTT broker
 * - Subscribing to Meshtastic and Reticulum topics
 * - Publishing messages
 * - Handling received messages
 *
 * Install dependencies:
 *   npm install mqtt
 *
 * Usage:
 *   node mqtt-client.js
 */

const mqtt = require('mqtt');

// Configuration
const config = {
  host: 'localhost',
  port: 1883,
  username: 'admin',
  password: 'changeme'
};

// Connect to MQTT broker
console.log(`Connecting to mqtt://${config.host}:${config.port}...`);
const client = mqtt.connect(`mqtt://${config.host}:${config.port}`, {
  username: config.username,
  password: config.password,
  clientId: `mqtt-client-${Math.random().toString(16).slice(2, 10)}`
});

// Connection event
client.on('connect', () => {
  console.log('✓ Connected to IceNet MQTT Server');
  console.log('');

  // Subscribe to topics
  const topics = [
    'meshtastic/rx/#',
    'reticulum/rx/#',
    'test/#'
  ];

  topics.forEach(topic => {
    client.subscribe(topic, (err) => {
      if (!err) {
        console.log(`✓ Subscribed to: ${topic}`);
      } else {
        console.error(`✗ Failed to subscribe to ${topic}:`, err.message);
      }
    });
  });

  console.log('');
  console.log('Listening for messages...');
  console.log('Press Ctrl+C to exit');
  console.log('─'.repeat(60));
});

// Message event
client.on('message', (topic, message) => {
  console.log('');
  console.log(`📨 Message received on topic: ${topic}`);

  // Try to parse as JSON
  try {
    const data = JSON.parse(message.toString());
    console.log('Payload (JSON):');
    console.log(JSON.stringify(data, null, 2));

    // Decode base64 data if present
    if (data.data) {
      try {
        const decoded = Buffer.from(data.data, 'base64').toString('utf-8');
        console.log('Decoded message:', decoded);
      } catch (e) {
        // Not valid UTF-8, show as hex
        console.log('Decoded message (hex):', Buffer.from(data.data, 'base64').toString('hex'));
      }
    }
  } catch (e) {
    // Not JSON, show raw
    console.log('Payload (raw):', message.toString());
  }

  console.log('─'.repeat(60));
});

// Error event
client.on('error', (error) => {
  console.error('✗ MQTT Error:', error.message);
});

// Offline event
client.on('offline', () => {
  console.log('⚠ Client is offline');
});

// Reconnect event
client.on('reconnect', () => {
  console.log('⟳ Reconnecting...');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('Disconnecting...');
  client.end();
  process.exit(0);
});

// Example: Publish a test message after 5 seconds
setTimeout(() => {
  console.log('');
  console.log('📤 Publishing test message...');
  client.publish('test/example', JSON.stringify({
    message: 'Hello from MQTT client!',
    timestamp: new Date().toISOString()
  }));
}, 5000);
