#!/bin/bash
set -e

# IceNet MQTT Server - Easy Installation Script
# This script automates the installation and setup process

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              IceNet MQTT Server - Easy Installer              ║"
echo "║     Meshtastic & Reticulum MQTT Bridge with Web Dashboard     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to print status messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if running as root for system-wide installation
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Consider running as a regular user for local installation."
    INSTALL_DIR="/opt/icenet-mqtt"
else
    INSTALL_DIR="$HOME/icenet-mqtt"
fi

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    print_error "Unsupported OS: $OSTYPE"
    exit 1
fi

print_info "Detected OS: $OS"
echo ""

# Check for Docker installation
echo "Checking prerequisites..."
DOCKER_AVAILABLE=false
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    print_status "Docker and Docker Compose found"
    DOCKER_AVAILABLE=true
else
    print_warning "Docker not found. Will use Node.js installation."
fi

# Check for Node.js
NODE_AVAILABLE=false
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js found: $NODE_VERSION"
    NODE_AVAILABLE=true
else
    print_warning "Node.js not found"
fi

# Check for Python
PYTHON_AVAILABLE=false
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    print_status "Python found: $PYTHON_VERSION"
    PYTHON_AVAILABLE=true
else
    print_warning "Python3 not found"
fi

echo ""

# Ask user for installation method
if $DOCKER_AVAILABLE; then
    echo "Choose installation method:"
    echo "1) Docker (Recommended - Easy, isolated)"
    echo "2) Native (Node.js + Python)"
    read -p "Enter choice [1-2]: " INSTALL_METHOD
else
    print_info "Docker not available. Using Native installation."
    INSTALL_METHOD=2
fi

echo ""

# Function to setup environment file
setup_env() {
    if [ -f ".env" ]; then
        print_info ".env file already exists"
        read -p "Do you want to reconfigure? [y/N]: " RECONFIG
        if [[ ! $RECONFIG =~ ^[Yy]$ ]]; then
            return
        fi
    fi

    print_info "Setting up environment configuration..."

    # Interactive configuration
    read -p "Enable authentication? [Y/n]: " ENABLE_AUTH
    ENABLE_AUTH=${ENABLE_AUTH:-Y}

    if [[ $ENABLE_AUTH =~ ^[Yy]$ ]]; then
        read -p "MQTT Username [admin]: " MQTT_USER
        MQTT_USER=${MQTT_USER:-admin}

        read -sp "MQTT Password [changeme]: " MQTT_PASS
        echo ""
        MQTT_PASS=${MQTT_PASS:-changeme}
        AUTH_ENABLED=true
    else
        MQTT_USER=""
        MQTT_PASS=""
        AUTH_ENABLED=false
    fi

    read -p "MQTT TCP Port [1883]: " MQTT_PORT
    MQTT_PORT=${MQTT_PORT:-1883}

    read -p "MQTT WebSocket Port [8883]: " WS_PORT
    WS_PORT=${WS_PORT:-8883}

    read -p "HTTP API Port [8080]: " HTTP_PORT
    HTTP_PORT=${HTTP_PORT:-8080}

    read -p "Enable Meshtastic? [y/N]: " ENABLE_MESHTASTIC
    ENABLE_MESHTASTIC=${ENABLE_MESHTASTIC:-N}

    if [[ $ENABLE_MESHTASTIC =~ ^[Yy]$ ]]; then
        print_info "Available serial ports:"
        if [ "$OS" = "linux" ]; then
            ls /dev/tty{USB,ACM}* 2>/dev/null || echo "None found"
        else
            ls /dev/cu.* 2>/dev/null || echo "None found"
        fi
        read -p "Meshtastic serial port [/dev/ttyUSB0]: " SERIAL_PORT
        SERIAL_PORT=${SERIAL_PORT:-/dev/ttyUSB0}
        MESHTASTIC_ENABLED=true
    else
        SERIAL_PORT="/dev/ttyUSB0"
        MESHTASTIC_ENABLED=false
    fi

    read -p "Enable Reticulum? [y/N]: " ENABLE_RETICULUM
    ENABLE_RETICULUM=${ENABLE_RETICULUM:-N}
    RETICULUM_ENABLED=false
    if [[ $ENABLE_RETICULUM =~ ^[Yy]$ ]]; then
        RETICULUM_ENABLED=true
    fi

    # Generate .env file
    cat > .env << EOF
# IceNet MQTT Server Configuration
# Generated on $(date)

# Server Configuration
NODE_ENV=production
PORT=$MQTT_PORT
WS_PORT=$WS_PORT
HTTP_PORT=$HTTP_PORT
MQTT_HOST=0.0.0.0

# MQTT Configuration
MQTT_MAX_CONNECTIONS=1000
MQTT_KEEPALIVE=60

# Authentication
ENABLE_AUTH=$AUTH_ENABLED
MQTT_USERNAME=$MQTT_USER
MQTT_PASSWORD=$MQTT_PASS

# Meshtastic Configuration
MESHTASTIC_ENABLED=$MESHTASTIC_ENABLED
MESHTASTIC_SERIAL_PORT=$SERIAL_PORT
MESHTASTIC_BAUD_RATE=115200
MESHTASTIC_TOPIC_PREFIX=meshtastic

# Reticulum Configuration
RETICULUM_ENABLED=$RETICULUM_ENABLED
RETICULUM_CONFIG_PATH=./config/reticulum.conf
RETICULUM_TOPIC_PREFIX=reticulum

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/icenet-mqtt.log

# Persistence
ENABLE_PERSISTENCE=true
PERSISTENCE_PATH=./mqtt-data

# SSL/TLS (optional)
ENABLE_TLS=false
TLS_CERT_PATH=./certs/server.crt
TLS_KEY_PATH=./certs/server.key
TLS_CA_PATH=./certs/ca.crt
EOF

    print_status "Configuration saved to .env"
}

# Docker installation
install_docker() {
    print_info "Installing with Docker..."

    # Setup environment
    setup_env

    # Build and start
    print_info "Building Docker image..."
    docker-compose build

    print_info "Starting services..."
    docker-compose up -d

    print_status "Installation complete!"
    echo ""
    print_info "Services are starting up..."
    sleep 3

    # Show status
    docker-compose ps

    echo ""
    print_status "IceNet MQTT Server is running!"
    echo ""
    echo "Access points:"
    echo "  • MQTT TCP:        localhost:$MQTT_PORT"
    echo "  • MQTT WebSocket:  localhost:$WS_PORT"
    echo "  • Web Dashboard:   http://localhost:$HTTP_PORT"
    echo ""
    echo "Useful commands:"
    echo "  • View logs:    docker-compose logs -f"
    echo "  • Stop server:  docker-compose stop"
    echo "  • Restart:      docker-compose restart"
    echo "  • Remove:       docker-compose down"
}

# Native installation
install_native() {
    print_info "Installing natively..."

    # Check Node.js
    if ! $NODE_AVAILABLE; then
        print_error "Node.js is required but not installed."
        print_info "Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi

    # Setup environment
    setup_env

    # Install Node.js dependencies
    print_info "Installing Node.js dependencies..."
    npm install

    # Install Python dependencies if Reticulum is enabled
    if [ "$RETICULUM_ENABLED" = "true" ]; then
        if ! $PYTHON_AVAILABLE; then
            print_error "Python3 is required for Reticulum but not installed."
            exit 1
        fi

        print_info "Installing Reticulum..."
        pip3 install rns || print_warning "Failed to install Reticulum. You may need to install it manually."
    fi

    # Build TypeScript
    print_info "Building application..."
    npm run build

    # Create systemd service (Linux only, non-root)
    if [ "$OS" = "linux" ] && [ "$EUID" -ne 0 ]; then
        read -p "Create systemd service for auto-start? [y/N]: " CREATE_SERVICE
        if [[ $CREATE_SERVICE =~ ^[Yy]$ ]]; then
            mkdir -p ~/.config/systemd/user/
            cat > ~/.config/systemd/user/icenet-mqtt.service << EOF
[Unit]
Description=IceNet MQTT Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$(pwd)
ExecStart=$(which node) $(pwd)/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF
            systemctl --user daemon-reload
            systemctl --user enable icenet-mqtt.service
            systemctl --user start icenet-mqtt.service
            print_status "Systemd service created and started"
        fi
    fi

    print_status "Installation complete!"
    echo ""
    print_info "Start the server with:"
    echo "  npm start"
    echo ""
    print_info "Or in development mode:"
    echo "  npm run dev"
}

# Main installation logic
case $INSTALL_METHOD in
    1)
        install_docker
        ;;
    2)
        install_native
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
print_info "Configuration file: .env"
print_info "You can edit this file to change settings"
echo ""
print_status "Installation successful! 🎉"
