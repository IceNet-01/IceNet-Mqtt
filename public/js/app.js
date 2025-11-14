// IceNet MQTT Dashboard JavaScript

let autoScroll = true;
let refreshInterval;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    checkConnection();
    loadDashboardData();
    loadSettings();
    startAutoRefresh();
});

// Tab navigation
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // Update active states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(tabName).classList.add('active');

            // Load data for specific tabs
            if (tabName === 'clients') {
                refreshClients();
            }
        });
    });
}

// Check server connection
async function checkConnection() {
    try {
        const response = await fetch('/health');
        const data = await response.json();

        const statusBadge = document.getElementById('connection-status');
        if (data.status === 'ok') {
            statusBadge.textContent = 'Online';
            statusBadge.className = 'status-badge status-online';
        } else {
            statusBadge.textContent = 'Degraded';
            statusBadge.className = 'status-badge status-warning';
        }
    } catch (error) {
        const statusBadge = document.getElementById('connection-status');
        statusBadge.textContent = 'Offline';
        statusBadge.className = 'status-badge status-offline';
        console.error('Connection check failed:', error);
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();

        // Update stats
        document.getElementById('mqtt-clients').textContent = data.mqtt.clients || 0;
        document.getElementById('meshtastic-status').textContent =
            data.meshtastic.connected ? 'Connected' : 'Disconnected';
        document.getElementById('reticulum-status').textContent =
            data.reticulum.running ? 'Running' : 'Stopped';
        document.getElementById('uptime').textContent = formatUptime(data.server.uptime);

        // Update server info
        document.getElementById('mqtt-port').textContent = data.mqtt.port;
        document.getElementById('ws-port').textContent = data.mqtt.wsPort;
        document.getElementById('http-port').textContent = window.location.port || 8080;
        document.getElementById('node-version').textContent = data.server.nodeVersion;

        addLog(`Dashboard updated - ${data.mqtt.clients} clients connected`);
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        addLog('Failed to load dashboard data', 'error');
    }
}

// Load settings
async function loadSettings() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();

        // MQTT settings
        document.getElementById('mqtt-port-input').value = config.mqtt.port;
        document.getElementById('ws-port-input').value = config.mqtt.wsPort;
        document.getElementById('max-connections-input').value = config.mqtt.maxConnections;

        // Meshtastic settings
        document.getElementById('meshtastic-enabled').checked = config.meshtastic.enabled;

        // Reticulum settings
        document.getElementById('reticulum-enabled').checked = config.reticulum.enabled;
    } catch (error) {
        console.error('Failed to load settings:', error);
        addLog('Failed to load settings', 'error');
    }
}

// Save settings
async function saveSettings() {
    const settings = {
        mqtt: {
            port: parseInt(document.getElementById('mqtt-port-input').value),
            wsPort: parseInt(document.getElementById('ws-port-input').value),
            maxConnections: parseInt(document.getElementById('max-connections-input').value),
        },
        auth: {
            enabled: document.getElementById('auth-enabled').checked,
            username: document.getElementById('mqtt-username').value,
            password: document.getElementById('mqtt-password').value,
        },
        meshtastic: {
            enabled: document.getElementById('meshtastic-enabled').checked,
            serialPort: document.getElementById('serial-port').value,
            baudRate: parseInt(document.getElementById('baud-rate').value),
        },
        reticulum: {
            enabled: document.getElementById('reticulum-enabled').checked,
        },
        logging: {
            level: document.getElementById('log-level').value,
        }
    };

    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            alert('Settings saved successfully! Please restart the server for changes to take effect.');
            addLog('Settings saved successfully', 'info');
        } else {
            alert('Failed to save settings. Check console for details.');
            addLog('Failed to save settings', 'error');
        }
    } catch (error) {
        console.error('Failed to save settings:', error);
        alert('Failed to save settings: ' + error.message);
        addLog('Failed to save settings: ' + error.message, 'error');
    }
}

// Refresh clients list
async function refreshClients() {
    const clientsList = document.getElementById('clients-list');
    clientsList.innerHTML = '<div class="loading">Loading clients...</div>';

    try {
        const response = await fetch('/api/clients');
        const data = await response.json();

        if (data.clients.length === 0) {
            clientsList.innerHTML = '<div class="loading">No clients connected</div>';
            return;
        }

        clientsList.innerHTML = '';
        data.clients.forEach(client => {
            const clientItem = document.createElement('div');
            clientItem.className = 'client-item';
            clientItem.innerHTML = `
                <span class="client-id">${client.id}</span>
                <span class="client-status client-${client.connected ? 'connected' : 'disconnected'}">
                    ${client.connected ? 'Connected' : 'Disconnected'}
                </span>
            `;
            clientsList.appendChild(clientItem);
        });

        addLog(`Refreshed clients list - ${data.count} clients`, 'info');
    } catch (error) {
        console.error('Failed to load clients:', error);
        clientsList.innerHTML = '<div class="loading">Failed to load clients</div>';
        addLog('Failed to load clients', 'error');
    }
}

// Test publish
async function testPublish() {
    try {
        const response = await fetch('/api/publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                topic: 'test/dashboard',
                message: `Test message from dashboard at ${new Date().toISOString()}`,
                qos: 1
            })
        });

        if (response.ok) {
            alert('Test message published successfully!');
            addLog('Test message published to test/dashboard', 'info');
        } else {
            alert('Failed to publish test message');
            addLog('Failed to publish test message', 'error');
        }
    } catch (error) {
        console.error('Test publish failed:', error);
        alert('Failed to publish: ' + error.message);
        addLog('Test publish failed: ' + error.message, 'error');
    }
}

// Refresh data
function refreshData() {
    checkConnection();
    loadDashboardData();
    addLog('Manual refresh triggered', 'info');
}

// View logs
function viewLogs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    document.querySelector('[data-tab="logs"]').classList.add('active');
    document.getElementById('logs').classList.add('active');
}

// Clear logs
function clearLogs() {
    const logsContent = document.getElementById('logs-content');
    logsContent.innerHTML = '';
    addLog('Logs cleared', 'info');
}

// Toggle auto-scroll
function toggleAutoScroll() {
    autoScroll = !autoScroll;
    const text = document.getElementById('autoscroll-text');
    text.textContent = autoScroll ? '⏸️ Pause' : '▶️ Resume';
    addLog(`Auto-scroll ${autoScroll ? 'enabled' : 'disabled'}`, 'info');
}

// Add log entry
function addLog(message, level = 'info') {
    const logsContent = document.getElementById('logs-content');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${level}`;

    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    logsContent.appendChild(entry);

    // Auto-scroll to bottom if enabled
    if (autoScroll) {
        logsContent.scrollTop = logsContent.scrollHeight;
    }

    // Limit log entries to 1000
    const entries = logsContent.querySelectorAll('.log-entry');
    if (entries.length > 1000) {
        entries[0].remove();
    }
}

// Download configuration
async function downloadConfig() {
    try {
        const response = await fetch('/api/config/export');
        const data = await response.text();

        const blob = new Blob([data], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '.env';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        addLog('Configuration file downloaded', 'info');
    } catch (error) {
        console.error('Failed to download config:', error);
        alert('Failed to download configuration');
        addLog('Failed to download configuration', 'error');
    }
}

// Copy configuration
async function copyConfig() {
    try {
        const response = await fetch('/api/config/export');
        const data = await response.text();

        await navigator.clipboard.writeText(data);
        alert('Configuration copied to clipboard!');
        addLog('Configuration copied to clipboard', 'info');
    } catch (error) {
        console.error('Failed to copy config:', error);
        alert('Failed to copy configuration');
        addLog('Failed to copy configuration', 'error');
    }
}

// Start auto-refresh
function startAutoRefresh() {
    refreshInterval = setInterval(() => {
        if (document.querySelector('[data-tab="dashboard"]').classList.contains('active')) {
            checkConnection();
            loadDashboardData();
        }
    }, 5000); // Refresh every 5 seconds
}

// Format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

// Log initial message
addLog('Dashboard initialized successfully', 'info');
