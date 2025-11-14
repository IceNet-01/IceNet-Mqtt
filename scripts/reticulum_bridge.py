#!/usr/bin/env python3
"""
Reticulum Bridge Script
Bridges IceNet MQTT Server with Reticulum Network Stack

This script acts as a bridge between the Node.js MQTT server and the
Reticulum network. It communicates via stdin/stdout using JSON messages.

Requirements:
    pip install rns

Message Format (JSON):
    Input (from Node.js):
        {"type": "send", "destination": "<hash>", "data": "<base64>", "timestamp": <ms>}

    Output (to Node.js):
        {"type": "packet", "source": "<hash>", "destination": "<hash>",
         "data": "<base64>", "timestamp": <ms>, "hops": <int>}
        {"type": "status", "message": "<string>"}
        {"type": "error", "message": "<string>"}
"""

import sys
import json
import time
import base64
import threading
from typing import Optional

try:
    import RNS
except ImportError:
    print(json.dumps({"type": "error", "message": "Reticulum (RNS) not installed. Install with: pip install rns"}))
    sys.exit(1)


class ReticulumBridge:
    def __init__(self):
        self.reticulum: Optional[RNS.Reticulum] = None
        self.identity: Optional[RNS.Identity] = None
        self.destination: Optional[RNS.Destination] = None
        self.running = True

    def log_status(self, message: str):
        """Send status message to Node.js"""
        output = {"type": "status", "message": message}
        print(json.dumps(output), flush=True)

    def log_error(self, message: str):
        """Send error message to Node.js"""
        output = {"type": "error", "message": message}
        print(json.dumps(output), flush=True)

    def send_packet(self, source: str, destination: str, data: bytes, hops: int = 0):
        """Send received packet to Node.js"""
        output = {
            "type": "packet",
            "source": source,
            "destination": destination,
            "data": base64.b64encode(data).decode('utf-8'),
            "timestamp": int(time.time() * 1000),
            "hops": hops
        }
        print(json.dumps(output), flush=True)

    def initialize_reticulum(self):
        """Initialize Reticulum network stack"""
        try:
            self.log_status("Initializing Reticulum...")

            # Initialize Reticulum with default configuration
            self.reticulum = RNS.Reticulum()

            # Create or load identity
            identity_path = RNS.Reticulum.identitypath + "/icenet_mqtt"
            if RNS.Identity.recall(identity_path):
                self.identity = RNS.Identity.recall(identity_path)
                self.log_status(f"Loaded existing identity: {identity_path}")
            else:
                self.identity = RNS.Identity()
                self.identity.to_file(identity_path)
                self.log_status(f"Created new identity: {identity_path}")

            # Create a destination for receiving messages
            self.destination = RNS.Destination(
                self.identity,
                RNS.Destination.IN,
                RNS.Destination.SINGLE,
                "icenet_mqtt",
                "bridge"
            )

            # Set packet callback
            self.destination.set_packet_callback(self.packet_received)

            dest_hash = RNS.prettyhexrep(self.destination.hash)
            self.log_status(f"Reticulum initialized. Destination: {dest_hash}")

        except Exception as e:
            self.log_error(f"Failed to initialize Reticulum: {str(e)}")
            raise

    def packet_received(self, data: bytes, packet: RNS.Packet):
        """Callback for received Reticulum packets"""
        try:
            source_hash = RNS.prettyhexrep(packet.source_hash) if packet.source_hash else "unknown"
            dest_hash = RNS.prettyhexrep(packet.destination_hash)
            hops = packet.hops if hasattr(packet, 'hops') else 0

            self.send_packet(source_hash, dest_hash, data, hops)

        except Exception as e:
            self.log_error(f"Error processing received packet: {str(e)}")

    def send_data(self, destination_hash: str, data: bytes):
        """Send data to a Reticulum destination"""
        try:
            # Parse destination hash
            dest_hash_bytes = bytes.fromhex(destination_hash.replace(":", ""))

            # Create destination
            dest = RNS.Destination(
                None,
                RNS.Destination.OUT,
                RNS.Destination.SINGLE,
                "icenet_mqtt",
                "bridge"
            )
            dest.hash = dest_hash_bytes

            # Create and send packet
            packet = RNS.Packet(dest, data)
            packet.send()

            self.log_status(f"Sent packet to {destination_hash}")

        except Exception as e:
            self.log_error(f"Failed to send packet: {str(e)}")

    def process_input(self, line: str):
        """Process input message from Node.js"""
        try:
            message = json.loads(line)
            msg_type = message.get("type")

            if msg_type == "send":
                destination = message.get("destination")
                data_b64 = message.get("data")

                if not destination or not data_b64:
                    self.log_error("Invalid send message: missing destination or data")
                    return

                data = base64.b64decode(data_b64)
                self.send_data(destination, data)

            else:
                self.log_error(f"Unknown message type: {msg_type}")

        except json.JSONDecodeError as e:
            self.log_error(f"Invalid JSON: {str(e)}")
        except Exception as e:
            self.log_error(f"Error processing input: {str(e)}")

    def input_loop(self):
        """Read and process input from stdin"""
        try:
            for line in sys.stdin:
                line = line.strip()
                if line:
                    self.process_input(line)

                if not self.running:
                    break

        except KeyboardInterrupt:
            self.running = False
        except Exception as e:
            self.log_error(f"Input loop error: {str(e)}")
            self.running = False

    def run(self):
        """Main run loop"""
        try:
            # Initialize Reticulum
            self.initialize_reticulum()

            # Start input processing thread
            input_thread = threading.Thread(target=self.input_loop, daemon=True)
            input_thread.start()

            self.log_status("Reticulum bridge running")

            # Keep main thread alive
            while self.running:
                time.sleep(1)

        except KeyboardInterrupt:
            self.log_status("Shutting down...")
        except Exception as e:
            self.log_error(f"Fatal error: {str(e)}")
        finally:
            self.running = False


if __name__ == "__main__":
    bridge = ReticulumBridge()
    bridge.run()
