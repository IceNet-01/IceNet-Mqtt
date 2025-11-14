import { EventEmitter } from 'events';
import { MQTTBroker } from '../mqtt/broker';
import { MeshtasticAdapter } from '../meshtastic';
import { ReticulumAdapter } from '../reticulum';
import { config } from '../config';
import logger from '../utils/logger';
import { MeshtasticMessage, ReticulumPacket } from '../types';

/**
 * Message Router
 * Routes messages between MQTT, Meshtastic, and Reticulum protocols
 */
export class MessageRouter extends EventEmitter {
  private mqttBroker: MQTTBroker;
  private meshtasticAdapter: MeshtasticAdapter;
  private reticulumAdapter: ReticulumAdapter;

  constructor(
    mqttBroker: MQTTBroker,
    meshtasticAdapter: MeshtasticAdapter,
    reticulumAdapter: ReticulumAdapter
  ) {
    super();
    this.mqttBroker = mqttBroker;
    this.meshtasticAdapter = meshtasticAdapter;
    this.reticulumAdapter = reticulumAdapter;

    this.setupRouting();
  }

  private setupRouting(): void {
    // Route MQTT messages to Meshtastic
    this.mqttBroker.on('message', (msg) => {
      if (msg.topic.startsWith(`${config.meshtastic.topicPrefix}/tx/`)) {
        this.routeToMeshtastic(msg);
      } else if (msg.topic.startsWith(`${config.reticulum.topicPrefix}/tx/`)) {
        this.routeToReticulum(msg);
      }
    });

    // Route Meshtastic messages to MQTT
    this.meshtasticAdapter.on('message', (message: MeshtasticMessage) => {
      this.routeFromMeshtastic(message);
    });

    // Route Reticulum packets to MQTT
    this.reticulumAdapter.on('packet', (packet: ReticulumPacket) => {
      this.routeFromReticulum(packet);
    });

    logger.info('Message routing configured');
  }

  private routeToMeshtastic(msg: any): void {
    try {
      const payload = Buffer.isBuffer(msg.payload)
        ? msg.payload
        : Buffer.from(msg.payload.toString());

      // Parse topic to extract destination
      // Format: meshtastic/tx/<to_node>/<channel>
      const parts = msg.topic.split('/');
      const to = parseInt(parts[2], 10) || 0xffffffff; // Default to broadcast
      const channel = parseInt(parts[3], 10) || 0;

      const meshtasticMsg: MeshtasticMessage = {
        from: 0, // Will be set by device
        to,
        id: Date.now(),
        channel,
        payload,
        rxTime: Date.now(),
      };

      this.meshtasticAdapter.send(meshtasticMsg);
      logger.debug(`Routed MQTT message to Meshtastic node ${to}`);
    } catch (error) {
      logger.error(`Failed to route message to Meshtastic: ${error}`);
    }
  }

  private routeFromMeshtastic(message: MeshtasticMessage): void {
    try {
      // Publish to MQTT topic
      // Format: meshtastic/rx/<from_node>/<to_node>/<channel>
      const topic = `${config.meshtastic.topicPrefix}/rx/${message.from}/${message.to}/${message.channel}`;

      // Add metadata
      const payload = JSON.stringify({
        from: message.from,
        to: message.to,
        id: message.id,
        channel: message.channel,
        data: message.payload.toString('base64'),
        rxTime: message.rxTime,
        rxSnr: message.rxSnr,
        rxRssi: message.rxRssi,
        hopLimit: message.hopLimit,
      });

      this.mqttBroker.publish(topic, payload, { qos: 1 });
      logger.debug(`Routed Meshtastic message from node ${message.from} to MQTT`);

      // Also publish raw payload to data topic
      const dataTopic = `${config.meshtastic.topicPrefix}/rx/${message.from}/data`;
      this.mqttBroker.publish(dataTopic, message.payload, { qos: 0 });
    } catch (error) {
      logger.error(`Failed to route Meshtastic message to MQTT: ${error}`);
    }
  }

  private routeToReticulum(msg: any): void {
    try {
      const payload = Buffer.isBuffer(msg.payload)
        ? msg.payload
        : Buffer.from(msg.payload.toString());

      // Parse topic to extract destination
      // Format: reticulum/tx/<destination_hash>
      const parts = msg.topic.split('/');
      const destination = parts[2];

      const packet: ReticulumPacket = {
        destination,
        source: '', // Will be set by Reticulum
        data: payload,
        timestamp: Date.now(),
      };

      this.reticulumAdapter.send(packet);
      logger.debug(`Routed MQTT message to Reticulum destination ${destination}`);
    } catch (error) {
      logger.error(`Failed to route message to Reticulum: ${error}`);
    }
  }

  private routeFromReticulum(packet: ReticulumPacket): void {
    try {
      // Publish to MQTT topic
      // Format: reticulum/rx/<source_hash>/<destination_hash>
      const topic = `${config.reticulum.topicPrefix}/rx/${packet.source}/${packet.destination}`;

      const payload = JSON.stringify({
        source: packet.source,
        destination: packet.destination,
        data: packet.data.toString('base64'),
        timestamp: packet.timestamp,
        hops: packet.hops,
      });

      this.mqttBroker.publish(topic, payload, { qos: 1 });
      logger.debug(`Routed Reticulum packet from ${packet.source} to MQTT`);

      // Also publish raw data
      const dataTopic = `${config.reticulum.topicPrefix}/rx/${packet.source}/data`;
      this.mqttBroker.publish(dataTopic, packet.data, { qos: 0 });
    } catch (error) {
      logger.error(`Failed to route Reticulum packet to MQTT: ${error}`);
    }
  }

  public getStats(): any {
    return {
      mqttClients: this.mqttBroker.getClientCount(),
      meshtasticConnected: this.meshtasticAdapter.getConnectionStatus(),
      reticulumRunning: this.reticulumAdapter.getStatus(),
    };
  }
}
