class HetznerAPI {
    constructor() {
        this.baseURL = window.location.origin;
        this.tokenKey = 'hetzner_api_token';
    }

    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    saveToken(token) {
        localStorage.setItem(this.tokenKey, token);
    }

    clearToken() {
        localStorage.removeItem(this.tokenKey);
    }

    async request(endpoint, options = {}) {
        const token = this.getToken();

        if (!token) {
            throw new Error('No API token found');
        }

        const headers = {
            'Content-Type': 'application/json',
            'X-Hetzner-Token': token,
            ...options.headers,
        };

        const response = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }

        return data;
    }

    async testToken(token) {
        const tempToken = this.getToken();
        this.saveToken(token);

        try {
            await this.request('/api/test-token', { method: 'POST' });
            return true;
        } catch (error) {
            this.clearToken();
            if (tempToken) {
                this.saveToken(tempToken);
            }
            throw error;
        }
    }

    async getServers() {
        return this.request('/api/servers');
    }

    async getServer(serverId) {
        return this.request(`/api/servers/${serverId}`);
    }

    async serverPowerAction(serverId, action) {
        return this.request(`/api/servers/${serverId}/power`, {
            method: 'POST',
            body: JSON.stringify({ action }),
        });
    }

    async createServer(serverData) {
        return this.request('/api/servers', {
            method: 'POST',
            body: JSON.stringify(serverData),
        });
    }

    async deleteServer(serverId) {
        return this.request(`/api/servers/${serverId}`, {
            method: 'DELETE',
        });
    }

    async getServerTypes() {
        return this.request('/api/server-types');
    }

    async getImages() {
        return this.request('/api/images');
    }

    async getLocations() {
        return this.request('/api/locations');
    }

    async getSSHKeys() {
        return this.request('/api/ssh-keys');
    }

    async createSSHKey(keyData) {
        return this.request('/api/ssh-keys', {
            method: 'POST',
            body: JSON.stringify(keyData),
        });
    }

    async deleteSSHKey(keyId) {
        return this.request(`/api/ssh-keys/${keyId}`, {
            method: 'DELETE',
        });
    }

    async getFloatingIPs() {
        return this.request('/api/floating-ips');
    }

    async createFloatingIP(ipData) {
        return this.request('/api/floating-ips', {
            method: 'POST',
            body: JSON.stringify(ipData),
        });
    }

    async deleteFloatingIP(ipId) {
        return this.request(`/api/floating-ips/${ipId}`, {
            method: 'DELETE',
        });
    }

    async assignFloatingIP(ipId, serverId) {
        return this.request(`/api/floating-ips/${ipId}/assign`, {
            method: 'POST',
            body: JSON.stringify({ server_id: serverId }),
        });
    }

    async unassignFloatingIP(ipId) {
        return this.request(`/api/floating-ips/${ipId}/unassign`, {
            method: 'POST',
        });
    }

    async getVolumes() {
        return this.request('/api/volumes');
    }

    async createVolume(volumeData) {
        return this.request('/api/volumes', {
            method: 'POST',
            body: JSON.stringify(volumeData),
        });
    }

    async deleteVolume(volumeId) {
        return this.request(`/api/volumes/${volumeId}`, {
            method: 'DELETE',
        });
    }

    async attachVolume(volumeId, serverId) {
        return this.request(`/api/volumes/${volumeId}/attach`, {
            method: 'POST',
            body: JSON.stringify({ server_id: serverId }),
        });
    }

    async detachVolume(volumeId) {
        return this.request(`/api/volumes/${volumeId}/detach`, {
            method: 'POST',
        });
    }

    async getFirewalls() {
        return this.request('/api/firewalls');
    }

    async createFirewall(firewallData) {
        return this.request('/api/firewalls', {
            method: 'POST',
            body: JSON.stringify(firewallData),
        });
    }

    async deleteFirewall(firewallId) {
        return this.request(`/api/firewalls/${firewallId}`, {
            method: 'DELETE',
        });
    }

    async getLoadBalancers() {
        return this.request('/api/load-balancers');
    }

    async deleteLoadBalancer(lbId) {
        return this.request(`/api/load-balancers/${lbId}`, {
            method: 'DELETE',
        });
    }

    async getNetworks() {
        return this.request('/api/networks');
    }

    async createNetwork(networkData) {
        return this.request('/api/networks', {
            method: 'POST',
            body: JSON.stringify(networkData),
        });
    }

    async deleteNetwork(networkId) {
        return this.request(`/api/networks/${networkId}`, {
            method: 'DELETE',
        });
    }

    async getServerMetrics(serverId, metricType, timeRange) {
        return this.request(`/api/servers/${serverId}/metrics?type=${metricType}&range=${timeRange}`);
    }
}

class App {
    constructor() {
        this.api = new HetznerAPI();
        this.metrics = {
            servers: [],
            volumes: [],
            floating_ips: [],
            networks: [],
            firewalls: [],
            ssh_keys: [],
            load_balancers: []
        };
        this.themeKey = 'hetzner_theme';
        this.init();
    }

    init() {
        this.loadTheme();
        this.setupEventListeners();
        this.checkToken();
    }

    // Theme Management
    loadTheme() {
        const savedTheme = localStorage.getItem(this.themeKey);
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        }
        this.updateThemeIcon();
    }

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem(this.themeKey, isDark ? 'dark' : 'light');
        this.updateThemeIcon();
    }

    updateThemeIcon() {
        const themeIcon = document.querySelector('.theme-icon');
        const isDark = document.body.classList.contains('dark-mode');
        themeIcon.textContent = isDark ? '☀️' : '🌙';
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        document.getElementById('save-token-btn').addEventListener('click', () => this.handleSaveToken());
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
        document.getElementById('refresh-btn').addEventListener('click', () => this.loadAll());
        document.getElementById('create-server-btn').addEventListener('click', () => this.showCreateServerModal());
        document.getElementById('add-ssh-key-btn').addEventListener('click', () => this.showSSHKeyModal());
        document.getElementById('create-floating-ip-btn').addEventListener('click', () => this.showFloatingIPModal());
        document.getElementById('create-volume-btn').addEventListener('click', () => this.showVolumeModal());
        document.getElementById('create-firewall-btn').addEventListener('click', () => this.showFirewallModal());
        document.getElementById('create-network-btn').addEventListener('click', () => this.showNetworkModal());

        document.getElementById('api-token-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSaveToken();
            }
        });

        // Storage Boxes event listeners
        document.getElementById('save-storage-token-btn').addEventListener('click', () => this.handleSaveStorageToken());
        document.getElementById('storage-api-token-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSaveStorageToken();
            }
        });
        document.getElementById('refresh-storage-boxes-btn').addEventListener('click', () => storageUI.loadStorageBoxes());

        // Setup navigation
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                this.showView(view);
            });
        });
    }

    async handleSaveStorageToken() {
        const tokenInput = document.getElementById('storage-api-token-input');
        const errorDiv = document.getElementById('storage-token-error');
        const token = tokenInput.value.trim();

        if (!token) {
            errorDiv.textContent = 'Please enter a valid token';
            errorDiv.style.display = 'block';
            return;
        }

        try {
            await storageAPI.testToken(token);
            errorDiv.style.display = 'none';
            this.initStorageBoxesView();
        } catch (error) {
            errorDiv.textContent = error.message || 'Invalid token';
            errorDiv.style.display = 'block';
        }
    }

    showView(viewName) {
        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // Update view containers
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.remove('active');
        });

        document.getElementById(`view-${viewName}`).classList.add('active');

        // Handle Storage Boxes view
        if (viewName === 'storage-boxes') {
            this.initStorageBoxesView();
        }
    }

    initStorageBoxesView() {
        const hasStorageToken = storageAPI.getToken();
        const tokenSetup = document.getElementById('storage-token-setup');
        const content = document.getElementById('storage-boxes-content');

        if (hasStorageToken) {
            tokenSetup.style.display = 'none';
            content.style.display = 'block';
            storageUI.loadStorageBoxes();
        } else {
            tokenSetup.style.display = 'block';
            content.style.display = 'none';
        }
    }

    loadAll() {
        this.loadServers();
        this.loadSSHKeys();
        this.loadFloatingIPs();
        this.loadVolumes();
        this.loadFirewalls();
        this.loadLoadBalancers();
        this.loadNetworks();
    }

    updateMetrics() {
        // Server metrics
        const runningServers = this.metrics.servers.filter(s => s.status === 'running').length;
        const stoppedServers = this.metrics.servers.length - runningServers;

        // Calculate total infrastructure specs
        let totalCores = 0;
        let totalMemory = 0;
        let totalDisk = 0;

        this.metrics.servers.forEach(server => {
            if (server.server_type_specs) {
                totalCores += server.server_type_specs.cores || 0;
                totalMemory += server.server_type_specs.memory || 0;
                totalDisk += server.server_type_specs.disk || 0;
            }
        });

        document.getElementById('metric-servers').textContent = this.metrics.servers.length;
        document.getElementById('metric-servers-running').textContent = `${runningServers} running`;
        document.getElementById('metric-servers-stopped').textContent = `${stoppedServers} stopped`;
        document.getElementById('servers-count').textContent = this.metrics.servers.length;

        // Update server details with specs
        const serverDetail = document.getElementById('metric-servers-detail');
        if (serverDetail) {
            serverDetail.textContent = `${totalCores} cores, ${totalMemory} GB RAM`;
        }

        // Storage metrics
        const totalStorage = this.metrics.volumes.reduce((sum, v) => sum + v.size, 0);
        document.getElementById('metric-storage').textContent = `${totalStorage} GB`;
        document.getElementById('metric-volumes-detail').textContent = `${this.metrics.volumes.length} volumes`;

        // Networking metrics
        const totalIPs = this.metrics.floating_ips.length;
        document.getElementById('metric-ips').textContent = totalIPs;
        document.getElementById('metric-networks-detail').textContent =
            `${this.metrics.floating_ips.length} IPs, ${this.metrics.networks.length} networks`;

        // Cost calculation using real pricing from Hetzner API
        let monthlyCost = 0;

        // Servers - use actual pricing from API
        this.metrics.servers.forEach(server => {
            if (server.server_type_pricing && server.server_type_pricing.monthly) {
                monthlyCost += server.server_type_pricing.monthly;
            }
        });

        // Volumes - use actual pricing from API
        this.metrics.volumes.forEach(volume => {
            if (volume.pricing && volume.pricing.monthly) {
                monthlyCost += volume.pricing.monthly;
            }
        });

        // Floating IPs - use actual pricing from API
        this.metrics.floating_ips.forEach(ip => {
            if (ip.pricing && ip.pricing.monthly) {
                monthlyCost += ip.pricing.monthly;
            }
        });

        // Load Balancers - use actual pricing from API
        this.metrics.load_balancers.forEach(lb => {
            if (lb.pricing && lb.pricing.monthly) {
                monthlyCost += lb.pricing.monthly;
            }
        });

        document.getElementById('metric-cost').textContent = `€${monthlyCost.toFixed(2)}`;

        // Update resource summary
        this.updateResourceSummary();
    }

    updateResourceSummary() {
        const summary = document.getElementById('resource-summary');

        const items = [
            { label: 'Servers', value: this.metrics.servers.length, icon: '🖥️' },
            { label: 'Volumes', value: this.metrics.volumes.length, icon: '💾' },
            { label: 'Floating IPs', value: this.metrics.floating_ips.length, icon: '🌐' },
            { label: 'Networks', value: this.metrics.networks.length, icon: '🔗' },
            { label: 'Firewalls', value: this.metrics.firewalls.length, icon: '🔒' },
            { label: 'SSH Keys', value: this.metrics.ssh_keys.length, icon: '🔑' },
            { label: 'Load Balancers', value: this.metrics.load_balancers.length, icon: '⚖️' }
        ];

        summary.innerHTML = items.map(item => `
            <div class="summary-item">
                <span class="summary-label">${item.icon} ${item.label}</span>
                <span class="summary-value">${item.value}</span>
            </div>
        `).join('');
    }

    checkToken() {
        const token = this.api.getToken();

        if (token) {
            this.showDashboard();
            this.loadAll();
        } else {
            this.showTokenSetup();
        }
    }

    showTokenSetup() {
        document.getElementById('token-setup').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('token-status').textContent = '';
    }

    showDashboard() {
        document.getElementById('token-setup').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        document.getElementById('token-status').textContent = '✓ Token Active';
    }

    async handleSaveToken() {
        const tokenInput = document.getElementById('api-token-input');
        const token = tokenInput.value.trim();
        const errorDiv = document.getElementById('token-error');
        const saveBtn = document.getElementById('save-token-btn');

        errorDiv.textContent = '';

        if (!token) {
            errorDiv.textContent = 'Please enter an API token';
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Validating...';

        try {
            await this.api.testToken(token);
            tokenInput.value = '';
            this.showDashboard();
            this.loadAll();
        } catch (error) {
            errorDiv.textContent = `Error: ${error.message}`;
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Token';
        }
    }

    handleLogout() {
        if (confirm('Are you sure you want to clear your API token?')) {
            this.api.clearToken();
            this.showTokenSetup();
        }
    }

    async loadServers() {
        const serversList = document.getElementById('servers-list');
        serversList.innerHTML = '<div class="loading">Loading servers...</div>';

        try {
            const data = await this.api.getServers();
            this.metrics.servers = data.servers || [];
            this.renderServers(data.servers);
            this.updateMetrics();
        } catch (error) {
            serversList.innerHTML = `<div class="error">Error loading servers: ${error.message}</div>`;

            if (error.message.includes('Invalid token')) {
                this.api.clearToken();
                this.showTokenSetup();
            }
        }
    }

    renderServers(servers) {
        const serversList = document.getElementById('servers-list');

        if (!servers || servers.length === 0) {
            serversList.innerHTML = `
                <div class="empty-state">
                    <h3>No servers found</h3>
                    <p>You don't have any servers in your Hetzner Cloud account yet.</p>
                </div>
            `;
            return;
        }

        serversList.innerHTML = servers.map(server => this.createServerCard(server)).join('');

        servers.forEach(server => {
            this.setupServerActions(server.id);
        });
    }

    createServerCard(server) {
        const statusClass = `status-${server.status.toLowerCase()}`;

        // Format specs if available
        let specsText = '';
        if (server.server_type_specs) {
            const cores = server.server_type_specs.cores || 0;
            const memory = server.server_type_specs.memory || 0;
            const disk = server.server_type_specs.disk || 0;
            specsText = `${cores} cores, ${memory} GB RAM, ${disk} GB disk`;
        }

        return `
            <div class="server-card" data-server-id="${server.id}">
                <div class="server-header">
                    <div class="server-name">${server.name}</div>
                    <div class="server-status ${statusClass}">${server.status}</div>
                </div>
                <div class="server-info">
                    <div class="info-item">
                        <span class="info-label">Type:</span> ${server.server_type}
                    </div>
                    <div class="info-item">
                        <span class="info-label">Location:</span> ${server.location}
                    </div>
                    <div class="info-item">
                        <span class="info-label">IPv4:</span> ${server.public_net.ipv4 || 'N/A'}
                    </div>
                    <div class="info-item">
                        <span class="info-label">Image:</span> ${server.image || 'N/A'}
                    </div>
                    ${specsText ? `<div class="info-item" style="grid-column: 1 / -1;">
                        <span class="info-label">Specs:</span> ${specsText}
                    </div>` : ''}
                </div>
                <div class="server-actions">
                    <button class="action-start" data-action="start" ${server.status === 'running' ? 'disabled' : ''}>
                        Start
                    </button>
                    <button class="action-stop" data-action="stop" ${server.status !== 'running' ? 'disabled' : ''}>
                        Stop
                    </button>
                    <button class="action-reboot" data-action="reboot" ${server.status !== 'running' ? 'disabled' : ''}>
                        Reboot
                    </button>
                    <button class="action-edit" data-action="edit">
                        Edit
                    </button>
                    <button class="action-metrics" data-action="metrics">
                        View Metrics
                    </button>
                    <button class="action-delete danger" data-action="delete">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    setupServerActions(serverId) {
        const card = document.querySelector(`[data-server-id="${serverId}"]`);
        const actionButtons = card.querySelectorAll('.server-actions button');

        actionButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const action = e.target.dataset.action;
                await this.handleServerAction(serverId, action, e.target);
            });
        });
    }

    async handleServerAction(serverId, action, button) {
        if (action === 'delete') {
            await this.handleDeleteServer(serverId);
            return;
        }

        if (action === 'edit') {
            this.showEditServerModal(serverId);
            return;
        }

        if (action === 'metrics') {
            this.showMetricsModal(serverId);
            return;
        }

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Processing...';

        try {
            await this.api.serverPowerAction(serverId, action);

            setTimeout(() => {
                this.loadServers();
            }, 2000);
        } catch (error) {
            alert(`Error: ${error.message}`);
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    async handleDeleteServer(serverId) {
        const card = document.querySelector(`[data-server-id="${serverId}"]`);
        const serverName = card.querySelector('.server-name').textContent;

        if (!confirm(`Are you sure you want to delete server "${serverName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await this.api.deleteServer(serverId);
            this.loadServers();
        } catch (error) {
            alert(`Error deleting server: ${error.message}`);
        }
    }

    async showCreateServerModal() {
        const modal = document.getElementById('create-server-modal');
        modal.style.display = 'flex';

        try {
            const [serverTypesData, imagesData, locationsData] = await Promise.all([
                this.api.getServerTypes(),
                this.api.getImages(),
                this.api.getLocations(),
            ]);

            this.populateCreateServerForm(serverTypesData.server_types, imagesData.images, locationsData.locations);
        } catch (error) {
            alert(`Error loading server options: ${error.message}`);
            this.closeCreateServerModal();
        }
    }

    populateCreateServerForm(serverTypes, images, locations) {
        const typeSelect = document.getElementById('server-type-select');
        const imageSelect = document.getElementById('image-select');
        const locationSelect = document.getElementById('location-select');

        typeSelect.innerHTML = serverTypes.map(type =>
            `<option value="${type.name}">${type.name} - ${type.cores} vCPU, ${type.memory}GB RAM, ${type.disk}GB SSD - €${type.prices.monthly}/mo</option>`
        ).join('');

        imageSelect.innerHTML = images.map(img =>
            `<option value="${img.name}">${img.description || img.name}</option>`
        ).join('');

        locationSelect.innerHTML = locations.map(loc =>
            `<option value="${loc.name}">${loc.description} (${loc.city}, ${loc.country})</option>`
        ).join('');
    }

    closeCreateServerModal() {
        document.getElementById('create-server-modal').style.display = 'none';
        document.getElementById('create-server-form').reset();
        document.getElementById('create-server-error').textContent = '';
    }

    async handleCreateServer(e) {
        e.preventDefault();

        const name = document.getElementById('server-name').value.trim();
        const serverType = document.getElementById('server-type-select').value;
        const image = document.getElementById('image-select').value;
        const location = document.getElementById('location-select').value;

        const errorDiv = document.getElementById('create-server-error');
        const submitBtn = document.getElementById('create-server-submit');

        errorDiv.textContent = '';

        if (!name) {
            errorDiv.textContent = 'Please enter a server name';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        try {
            await this.api.createServer({
                name,
                server_type: serverType,
                image,
                location,
            });

            this.closeCreateServerModal();
            this.loadAll();
        } catch (error) {
            errorDiv.textContent = `Error: ${error.message}`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Server';
        }
    }

    async loadSSHKeys() {
        const keysList = document.getElementById('ssh-keys-list');
        keysList.innerHTML = '<div class="loading">Loading SSH keys...</div>';

        try {
            const data = await this.api.getSSHKeys();
            this.metrics.ssh_keys = data.ssh_keys || [];
            this.renderSSHKeys(data.ssh_keys);
            this.updateMetrics();
        } catch (error) {
            keysList.innerHTML = `<div class="error">Error loading SSH keys: ${error.message}</div>`;
        }
    }

    renderSSHKeys(keys) {
        const keysList = document.getElementById('ssh-keys-list');

        if (!keys || keys.length === 0) {
            keysList.innerHTML = `
                <div class="empty-state">
                    <h3>No SSH keys found</h3>
                    <p>Add an SSH key to securely access your servers.</p>
                </div>
            `;
            return;
        }

        keysList.innerHTML = keys.map(key => this.createSSHKeyCard(key)).join('');

        keys.forEach(key => {
            this.setupSSHKeyActions(key.id);
        });
    }

    createSSHKeyCard(key) {
        return `
            <div class="ssh-key-card" data-key-id="${key.id}">
                <div class="ssh-key-header">
                    <div class="ssh-key-name">${key.name}</div>
                </div>
                <div class="ssh-key-fingerprint">Fingerprint: ${key.fingerprint}</div>
                <div class="ssh-key-actions">
                    <button class="action-delete-key danger" data-action="delete">Delete</button>
                </div>
            </div>
        `;
    }

    setupSSHKeyActions(keyId) {
        const card = document.querySelector(`[data-key-id="${keyId}"]`);
        const deleteBtn = card.querySelector('.action-delete-key');

        deleteBtn.addEventListener('click', async () => {
            await this.handleDeleteSSHKey(keyId);
        });
    }

    async handleDeleteSSHKey(keyId) {
        const card = document.querySelector(`[data-key-id="${keyId}"]`);
        const keyName = card.querySelector('.ssh-key-name').textContent;

        if (!confirm(`Are you sure you want to delete SSH key "${keyName}"?`)) {
            return;
        }

        try {
            await this.api.deleteSSHKey(keyId);
            this.loadSSHKeys();
        } catch (error) {
            alert(`Error deleting SSH key: ${error.message}`);
        }
    }

    showSSHKeyModal() {
        document.getElementById('add-ssh-key-modal').style.display = 'flex';
    }

    closeSSHKeyModal() {
        document.getElementById('add-ssh-key-modal').style.display = 'none';
        document.getElementById('add-ssh-key-form').reset();
        document.getElementById('add-ssh-key-error').textContent = '';
    }

    async handleAddSSHKey(e) {
        e.preventDefault();

        const name = document.getElementById('ssh-key-name').value.trim();
        const publicKey = document.getElementById('ssh-key-public').value.trim();

        const errorDiv = document.getElementById('add-ssh-key-error');
        const submitBtn = document.getElementById('add-ssh-key-submit');

        errorDiv.textContent = '';

        if (!name || !publicKey) {
            errorDiv.textContent = 'Please fill in all fields';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';

        try {
            await this.api.createSSHKey({
                name,
                public_key: publicKey,
            });

            this.closeSSHKeyModal();
            this.loadSSHKeys();
        } catch (error) {
            errorDiv.textContent = `Error: ${error.message}`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Key';
        }
    }

    async loadFloatingIPs() {
        const ipsList = document.getElementById('floating-ips-list');
        ipsList.innerHTML = '<div class="loading">Loading floating IPs...</div>';

        try {
            const data = await this.api.getFloatingIPs();
            this.metrics.floating_ips = data.floating_ips || [];
            this.renderFloatingIPs(data.floating_ips);
            this.updateMetrics();
        } catch (error) {
            ipsList.innerHTML = `<div class="error">Error loading floating IPs: ${error.message}</div>`;
        }
    }

    renderFloatingIPs(ips) {
        const ipsList = document.getElementById('floating-ips-list');

        if (!ips || ips.length === 0) {
            ipsList.innerHTML = `
                <div class="empty-state">
                    <h3>No floating IPs found</h3>
                    <p>Create a floating IP to assign flexible IPs to your servers.</p>
                </div>
            `;
            return;
        }

        ipsList.innerHTML = ips.map(ip => this.createFloatingIPCard(ip)).join('');

        ips.forEach(ip => {
            this.setupFloatingIPActions(ip.id, ip.server);
        });
    }

    createFloatingIPCard(ip) {
        const isAssigned = ip.server !== null;
        const statusClass = isAssigned ? 'ip-assigned' : 'ip-unassigned';
        const statusText = isAssigned ? `Assigned to ${ip.server_name}` : 'Unassigned';

        return `
            <div class="floating-ip-card" data-ip-id="${ip.id}">
                <div class="floating-ip-header">
                    <div class="floating-ip-address">${ip.ip}</div>
                    <span class="floating-ip-type">${ip.type.toUpperCase()}</span>
                </div>
                <div class="floating-ip-info">
                    <div class="info-item">
                        <span class="info-label">Name:</span> ${ip.name || 'N/A'}
                    </div>
                    <div class="info-item">
                        <span class="info-label">Location:</span> ${ip.location}
                    </div>
                    <div class="info-item">
                        <span class="floating-ip-status ${statusClass}">${statusText}</span>
                    </div>
                </div>
                <div class="floating-ip-actions">
                    ${isAssigned ?
                        '<button class="action-unassign-ip" data-action="unassign">Unassign</button>' :
                        '<button class="action-assign-ip" data-action="assign">Assign to Server</button>'
                    }
                    <button class="action-delete-ip danger" data-action="delete">Delete</button>
                </div>
            </div>
        `;
    }

    setupFloatingIPActions(ipId, serverId) {
        const card = document.querySelector(`[data-ip-id="${ipId}"]`);
        const actionButtons = card.querySelectorAll('.floating-ip-actions button');

        actionButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const action = e.target.dataset.action;

                if (action === 'delete') {
                    await this.handleDeleteFloatingIP(ipId);
                } else if (action === 'assign') {
                    await this.handleAssignFloatingIP(ipId);
                } else if (action === 'unassign') {
                    await this.handleUnassignFloatingIP(ipId);
                }
            });
        });
    }

    async handleDeleteFloatingIP(ipId) {
        const card = document.querySelector(`[data-ip-id="${ipId}"]`);
        const ipAddress = card.querySelector('.floating-ip-address').textContent;

        if (!confirm(`Are you sure you want to delete floating IP ${ipAddress}?`)) {
            return;
        }

        try {
            await this.api.deleteFloatingIP(ipId);
            this.loadFloatingIPs();
        } catch (error) {
            alert(`Error deleting floating IP: ${error.message}`);
        }
    }

    async handleAssignFloatingIP(ipId) {
        try {
            const serversData = await this.api.getServers();
            const servers = serversData.servers;

            if (!servers || servers.length === 0) {
                alert('No servers available to assign floating IP to.');
                return;
            }

            const serverOptions = servers.map(s =>
                `<option value="${s.id}">${s.name} (${s.public_net.ipv4})</option>`
            ).join('');

            const serverId = prompt(`Select server ID to assign:\n${servers.map(s => `${s.id}: ${s.name}`).join('\n')}`);

            if (!serverId) return;

            await this.api.assignFloatingIP(ipId, parseInt(serverId));
            this.loadFloatingIPs();
        } catch (error) {
            alert(`Error assigning floating IP: ${error.message}`);
        }
    }

    async handleUnassignFloatingIP(ipId) {
        if (!confirm('Are you sure you want to unassign this floating IP?')) {
            return;
        }

        try {
            await this.api.unassignFloatingIP(ipId);
            this.loadFloatingIPs();
        } catch (error) {
            alert(`Error unassigning floating IP: ${error.message}`);
        }
    }

    async showFloatingIPModal() {
        const modal = document.getElementById('create-floating-ip-modal');
        modal.style.display = 'flex';

        try {
            const locationsData = await this.api.getLocations();
            const locationSelect = document.getElementById('floating-ip-location');

            locationSelect.innerHTML = locationsData.locations.map(loc =>
                `<option value="${loc.name}">${loc.description} (${loc.city}, ${loc.country})</option>`
            ).join('');
        } catch (error) {
            alert(`Error loading locations: ${error.message}`);
            this.closeFloatingIPModal();
        }
    }

    closeFloatingIPModal() {
        document.getElementById('create-floating-ip-modal').style.display = 'none';
        document.getElementById('create-floating-ip-form').reset();
        document.getElementById('create-floating-ip-error').textContent = '';
    }

    async handleCreateFloatingIP(e) {
        e.preventDefault();

        const name = document.getElementById('floating-ip-name').value.trim();
        const type = document.getElementById('floating-ip-type').value;
        const location = document.getElementById('floating-ip-location').value;

        const errorDiv = document.getElementById('create-floating-ip-error');
        const submitBtn = document.getElementById('create-floating-ip-submit');

        errorDiv.textContent = '';

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        try {
            await this.api.createFloatingIP({
                name: name || null,
                type,
                location,
            });

            this.closeFloatingIPModal();
            this.loadFloatingIPs();
        } catch (error) {
            errorDiv.textContent = `Error: ${error.message}`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create IP';
        }
    }

    async loadVolumes() {
        const volumesList = document.getElementById('volumes-list');
        volumesList.innerHTML = '<div class="loading">Loading volumes...</div>';

        try {
            const data = await this.api.getVolumes();
            this.metrics.volumes = data.volumes || [];
            this.renderVolumes(data.volumes);
            this.updateMetrics();
        } catch (error) {
            volumesList.innerHTML = `<div class="error">Error loading volumes: ${error.message}</div>`;
        }
    }

    renderVolumes(volumes) {
        const volumesList = document.getElementById('volumes-list');

        if (!volumes || volumes.length === 0) {
            volumesList.innerHTML = `
                <div class="empty-state">
                    <h3>No volumes found</h3>
                    <p>Create a volume to add persistent storage to your servers.</p>
                </div>
            `;
            return;
        }

        volumesList.innerHTML = volumes.map(vol => this.createVolumeCard(vol)).join('');

        volumes.forEach(vol => {
            this.setupVolumeActions(vol.id, vol.server);
        });
    }

    createVolumeCard(vol) {
        const isAttached = vol.server !== null;
        const statusClass = isAttached ? 'volume-attached' : 'volume-detached';
        const statusText = isAttached ? `Attached` : 'Detached';

        return `
            <div class="volume-card" data-volume-id="${vol.id}">
                <div class="volume-header">
                    <div class="volume-name">${vol.name}</div>
                    <span class="volume-size">${vol.size} GB</span>
                </div>
                <div class="volume-info">
                    <div class="info-item">
                        <span class="info-label">Location:</span> ${vol.location}
                    </div>
                    <div class="info-item">
                        <span class="info-label">Format:</span> ${vol.format || 'N/A'}
                    </div>
                    <div class="info-item">
                        <span class="info-label">Device:</span> ${vol.linux_device || 'N/A'}
                    </div>
                    <div class="info-item">
                        <span class="volume-status ${statusClass}">${statusText}</span>
                    </div>
                </div>
                <div class="volume-actions">
                    ${isAttached ?
                        '<button class="action-detach-volume" data-action="detach">Detach</button>' :
                        '<button class="action-attach-volume" data-action="attach">Attach to Server</button>'
                    }
                    <button class="action-delete-volume danger" data-action="delete">Delete</button>
                </div>
            </div>
        `;
    }

    setupVolumeActions(volumeId, serverId) {
        const card = document.querySelector(`[data-volume-id="${volumeId}"]`);
        const actionButtons = card.querySelectorAll('.volume-actions button');

        actionButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const action = e.target.dataset.action;

                if (action === 'delete') {
                    await this.handleDeleteVolume(volumeId);
                } else if (action === 'attach') {
                    await this.handleAttachVolume(volumeId);
                } else if (action === 'detach') {
                    await this.handleDetachVolume(volumeId);
                }
            });
        });
    }

    async handleDeleteVolume(volumeId) {
        const card = document.querySelector(`[data-volume-id="${volumeId}"]`);
        const volumeName = card.querySelector('.volume-name').textContent;

        if (!confirm(`Are you sure you want to delete volume "${volumeName}"?`)) {
            return;
        }

        try {
            await this.api.deleteVolume(volumeId);
            this.loadVolumes();
        } catch (error) {
            alert(`Error deleting volume: ${error.message}`);
        }
    }

    async handleAttachVolume(volumeId) {
        try {
            const serversData = await this.api.getServers();
            const servers = serversData.servers;

            if (!servers || servers.length === 0) {
                alert('No servers available to attach volume to.');
                return;
            }

            const serverId = prompt(`Select server ID to attach:\n${servers.map(s => `${s.id}: ${s.name}`).join('\n')}`);

            if (!serverId) return;

            await this.api.attachVolume(volumeId, parseInt(serverId));
            this.loadVolumes();
        } catch (error) {
            alert(`Error attaching volume: ${error.message}`);
        }
    }

    async handleDetachVolume(volumeId) {
        if (!confirm('Are you sure you want to detach this volume?')) {
            return;
        }

        try {
            await this.api.detachVolume(volumeId);
            this.loadVolumes();
        } catch (error) {
            alert(`Error detaching volume: ${error.message}`);
        }
    }

    async showVolumeModal() {
        const modal = document.getElementById('create-volume-modal');
        modal.style.display = 'flex';

        try {
            const locationsData = await this.api.getLocations();
            const locationSelect = document.getElementById('volume-location');

            locationSelect.innerHTML = locationsData.locations.map(loc =>
                `<option value="${loc.name}">${loc.description} (${loc.city}, ${loc.country})</option>`
            ).join('');
        } catch (error) {
            alert(`Error loading locations: ${error.message}`);
            this.closeVolumeModal();
        }
    }

    closeVolumeModal() {
        document.getElementById('create-volume-modal').style.display = 'none';
        document.getElementById('create-volume-form').reset();
        document.getElementById('create-volume-error').textContent = '';
    }

    async handleCreateVolume(e) {
        e.preventDefault();

        const name = document.getElementById('volume-name').value.trim();
        const size = document.getElementById('volume-size').value;
        const location = document.getElementById('volume-location').value;
        const format = document.getElementById('volume-format').value;

        const errorDiv = document.getElementById('create-volume-error');
        const submitBtn = document.getElementById('create-volume-submit');

        errorDiv.textContent = '';

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        try {
            await this.api.createVolume({
                name,
                size: parseInt(size),
                location,
                format,
            });

            this.closeVolumeModal();
            this.loadVolumes();
        } catch (error) {
            errorDiv.textContent = `Error: ${error.message}`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Volume';
        }
    }

    async loadFirewalls() {
        const firewallsList = document.getElementById('firewalls-list');
        firewallsList.innerHTML = '<div class="loading">Loading firewalls...</div>';

        try {
            const data = await this.api.getFirewalls();
            this.metrics.firewalls = data.firewalls || [];
            this.renderFirewalls(data.firewalls);
            this.updateMetrics();
        } catch (error) {
            firewallsList.innerHTML = `<div class="error">Error loading firewalls: ${error.message}</div>`;
        }
    }

    renderFirewalls(firewalls) {
        const firewallsList = document.getElementById('firewalls-list');

        if (!firewalls || firewalls.length === 0) {
            firewallsList.innerHTML = `
                <div class="empty-state">
                    <h3>No firewalls found</h3>
                    <p>Create a firewall to control network traffic to your servers.</p>
                </div>
            `;
            return;
        }

        firewallsList.innerHTML = firewalls.map(fw => this.createFirewallCard(fw)).join('');

        firewalls.forEach(fw => {
            this.setupFirewallActions(fw.id);
        });
    }

    createFirewallCard(fw) {
        const rulesHtml = fw.rules && fw.rules.length > 0 ? `
            <div class="firewall-rules">
                <h4>Rules:</h4>
                ${fw.rules.map(rule => `
                    <div class="firewall-rule">
                        <span class="rule-direction ${rule.direction}">${rule.direction.toUpperCase()}</span>
                        <span class="rule-protocol">${rule.protocol.toUpperCase()}</span>
                        ${rule.port ? `<span class="rule-port">Port: ${rule.port}</span>` : ''}
                        <span class="rule-source">${rule.direction === 'in' ? 'From' : 'To'}: ${rule.source_ips?.join(', ') || rule.destination_ips?.join(', ') || 'Any'}</span>
                    </div>
                `).join('')}
            </div>
        ` : '<p class="no-rules">No rules defined</p>';

        return `
            <div class="firewall-card" data-firewall-id="${fw.id}">
                <div class="firewall-header">
                    <div class="firewall-name">${fw.name}</div>
                    <span class="firewall-count">${fw.applied_to?.length || 0} resources</span>
                </div>
                ${rulesHtml}
                <div class="firewall-actions">
                    <button class="action-delete-firewall danger" data-action="delete">Delete</button>
                </div>
            </div>
        `;
    }

    setupFirewallActions(firewallId) {
        const card = document.querySelector(`[data-firewall-id="${firewallId}"]`);
        const deleteBtn = card.querySelector('.action-delete-firewall');

        deleteBtn.addEventListener('click', async () => {
            await this.handleDeleteFirewall(firewallId);
        });
    }

    async handleDeleteFirewall(firewallId) {
        const card = document.querySelector(`[data-firewall-id="${firewallId}"]`);
        const firewallName = card.querySelector('.firewall-name').textContent;

        if (!confirm(`Are you sure you want to delete firewall "${firewallName}"?`)) {
            return;
        }

        try {
            await this.api.deleteFirewall(firewallId);
            this.loadFirewalls();
        } catch (error) {
            alert(`Error deleting firewall: ${error.message}`);
        }
    }

    showFirewallModal() {
        document.getElementById('create-firewall-modal').style.display = 'flex';
    }

    closeFirewallModal() {
        document.getElementById('create-firewall-modal').style.display = 'none';
        document.getElementById('create-firewall-form').reset();
        document.getElementById('create-firewall-error').textContent = '';
        document.getElementById('firewall-rules-container').innerHTML = '';
    }

    async handleCreateFirewall(e) {
        e.preventDefault();

        const name = document.getElementById('firewall-name').value.trim();
        const errorDiv = document.getElementById('create-firewall-error');
        const submitBtn = document.getElementById('create-firewall-submit');

        errorDiv.textContent = '';

        if (!name) {
            errorDiv.textContent = 'Please enter a firewall name';
            return;
        }

        const rules = this.collectFirewallRules();

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        try {
            await this.api.createFirewall({ name, rules });
            this.closeFirewallModal();
            this.loadFirewalls();
        } catch (error) {
            errorDiv.textContent = `Error: ${error.message}`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Firewall';
        }
    }

    collectFirewallRules() {
        const rules = [];
        const ruleElements = document.querySelectorAll('.firewall-rule-item');

        ruleElements.forEach(elem => {
            const direction = elem.querySelector('.rule-direction-select').value;
            const protocol = elem.querySelector('.rule-protocol-select').value;
            const port = elem.querySelector('.rule-port-input').value;
            const ips = elem.querySelector('.rule-ips-input').value.trim();

            const rule = {
                direction,
                protocol,
            };

            if (port) {
                rule.port = port;
            }

            if (ips) {
                const ipArray = ips.split(',').map(ip => ip.trim()).filter(ip => ip);
                if (direction === 'in') {
                    rule.source_ips = ipArray;
                } else {
                    rule.destination_ips = ipArray;
                }
            }

            rules.push(rule);
        });

        return rules;
    }

    addFirewallRule() {
        const container = document.getElementById('firewall-rules-container');
        const ruleHtml = `
            <div class="firewall-rule-item">
                <select class="rule-direction-select">
                    <option value="in">Inbound</option>
                    <option value="out">Outbound</option>
                </select>
                <select class="rule-protocol-select">
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="icmp">ICMP</option>
                    <option value="esp">ESP</option>
                    <option value="gre">GRE</option>
                </select>
                <input type="text" class="rule-port-input" placeholder="Port (e.g., 80 or 80-443)">
                <input type="text" class="rule-ips-input" placeholder="IPs (e.g., 0.0.0.0/0, 10.0.0.0/8)">
                <button type="button" class="remove-rule-btn danger" onclick="this.parentElement.remove()">Remove</button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', ruleHtml);
    }

    async loadLoadBalancers() {
        const lbList = document.getElementById('load-balancers-list');
        lbList.innerHTML = '<div class="loading">Loading load balancers...</div>';

        try {
            const data = await this.api.getLoadBalancers();
            this.metrics.load_balancers = data.load_balancers || [];
            this.renderLoadBalancers(data.load_balancers);
            this.updateMetrics();
        } catch (error) {
            lbList.innerHTML = `<div class="error">Error loading load balancers: ${error.message}</div>`;
        }
    }

    renderLoadBalancers(lbs) {
        const lbList = document.getElementById('load-balancers-list');

        if (!lbs || lbs.length === 0) {
            lbList.innerHTML = `
                <div class="empty-state">
                    <h3>No load balancers found</h3>
                    <p>You don't have any load balancers configured.</p>
                </div>
            `;
            return;
        }

        lbList.innerHTML = lbs.map(lb => this.createLoadBalancerCard(lb)).join('');

        lbs.forEach(lb => {
            this.setupLoadBalancerActions(lb.id);
        });
    }

    createLoadBalancerCard(lb) {
        return `
            <div class="lb-card" data-lb-id="${lb.id}">
                <div class="lb-header">
                    <div class="lb-name">${lb.name}</div>
                    <span class="lb-type">${lb.load_balancer_type}</span>
                </div>
                <div class="lb-info">
                    <div class="info-item">
                        <span class="info-label">Location:</span> ${lb.location}
                    </div>
                    <div class="info-item">
                        <span class="info-label">Public IPv4:</span> ${lb.public_net?.ipv4 || 'N/A'}
                    </div>
                    <div class="info-item">
                        <span class="info-label">Targets:</span> ${lb.targets?.length || 0}
                    </div>
                </div>
                <div class="lb-actions">
                    <button class="action-delete-lb danger" data-action="delete">Delete</button>
                </div>
            </div>
        `;
    }

    setupLoadBalancerActions(lbId) {
        const card = document.querySelector(`[data-lb-id="${lbId}"]`);
        const deleteBtn = card.querySelector('.action-delete-lb');

        deleteBtn.addEventListener('click', async () => {
            await this.handleDeleteLoadBalancer(lbId);
        });
    }

    async handleDeleteLoadBalancer(lbId) {
        const card = document.querySelector(`[data-lb-id="${lbId}"]`);
        const lbName = card.querySelector('.lb-name').textContent;

        if (!confirm(`Are you sure you want to delete load balancer "${lbName}"?`)) {
            return;
        }

        try {
            await this.api.deleteLoadBalancer(lbId);
            this.loadLoadBalancers();
        } catch (error) {
            alert(`Error deleting load balancer: ${error.message}`);
        }
    }

    async loadNetworks() {
        const networksList = document.getElementById('networks-list');
        networksList.innerHTML = '<div class="loading">Loading networks...</div>';

        try {
            const [networksData, serversData] = await Promise.all([
                this.api.getNetworks(),
                this.api.getServers()
            ]);
            this.metrics.networks = networksData.networks || [];
            this.renderNetworks(networksData.networks, serversData.servers);
            this.updateMetrics();
        } catch (error) {
            networksList.innerHTML = `<div class="error">Error loading networks: ${error.message}</div>`;
        }
    }

    renderNetworks(networks, servers) {
        const networksList = document.getElementById('networks-list');

        if (!networks || networks.length === 0) {
            networksList.innerHTML = `
                <div class="empty-state">
                    <h3>No private networks found</h3>
                    <p>Create a private network to connect your servers securely.</p>
                </div>
            `;
            return;
        }

        networksList.innerHTML = networks.map(network => this.createNetworkCard(network, servers)).join('');

        networks.forEach(network => {
            this.setupNetworkActions(network.id);
            this.drawNetworkTopology(network, servers);
        });
    }

    createNetworkCard(network, servers) {
        const attachedServers = servers.filter(s =>
            s.private_net?.some(pn => pn.network === network.id)
        );

        return `
            <div class="network-card" data-network-id="${network.id}">
                <div class="network-header">
                    <div class="network-name">${network.name}</div>
                    <span class="network-range">${network.ip_range}</span>
                </div>
                <div class="network-info">
                    <div class="info-item">
                        <span class="info-label">Subnets:</span> ${network.subnets?.length || 0}
                    </div>
                    <div class="info-item">
                        <span class="info-label">Connected Servers:</span> ${attachedServers.length}
                    </div>
                </div>
                <div class="network-topology" id="topology-${network.id}">
                    <canvas id="canvas-${network.id}" width="600" height="300"></canvas>
                </div>
                <div class="network-servers-list">
                    ${attachedServers.map(s => {
                        const privateNet = s.private_net.find(pn => pn.network === network.id);
                        return `
                            <div class="network-server-item">
                                <span class="server-name-small">${s.name}</span>
                                <span class="server-private-ip">${privateNet?.ip || 'N/A'}</span>
                            </div>
                        `;
                    }).join('') || '<p class="no-servers">No servers connected</p>'}
                </div>
                <div class="network-actions">
                    <button class="action-delete-network danger" data-action="delete">Delete</button>
                </div>
            </div>
        `;
    }

    drawNetworkTopology(network, servers) {
        setTimeout(() => {
            const canvas = document.getElementById(`canvas-${network.id}`);
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;

            ctx.clearRect(0, 0, width, height);

            // Draw network cloud
            ctx.fillStyle = '#e3f2fd';
            ctx.strokeStyle = '#1976d2';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(50, 50, width - 100, height - 100, 20);
            ctx.fill();
            ctx.stroke();

            // Network label
            ctx.fillStyle = '#1976d2';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(network.name, 70, 80);
            ctx.font = '12px monospace';
            ctx.fillStyle = '#666';
            ctx.fillText(network.ip_range, 70, 100);

            // Draw connected servers
            const attachedServers = servers.filter(s =>
                s.private_net?.some(pn => pn.network === network.id)
            );

            const serverCount = attachedServers.length;
            if (serverCount === 0) {
                ctx.fillStyle = '#999';
                ctx.font = '14px sans-serif';
                ctx.fillText('No servers connected', width / 2 - 70, height / 2);
                return;
            }

            const centerX = width / 2;
            const centerY = height / 2;
            const radius = Math.min(width, height) / 3;

            attachedServers.forEach((server, index) => {
                const angle = (2 * Math.PI * index) / serverCount - Math.PI / 2;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);

                // Draw connection line to center
                ctx.strokeStyle = '#667eea';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(x, y);
                ctx.stroke();

                // Draw server box
                ctx.fillStyle = server.status === 'running' ? '#d4edda' : '#f8d7da';
                ctx.strokeStyle = server.status === 'running' ? '#155724' : '#721c24';
                ctx.lineWidth = 2;
                ctx.fillRect(x - 40, y - 25, 80, 50);
                ctx.strokeRect(x - 40, y - 25, 80, 50);

                // Server name
                ctx.fillStyle = '#333';
                ctx.font = 'bold 11px sans-serif';
                const serverName = server.name.length > 10 ? server.name.substring(0, 9) + '...' : server.name;
                ctx.fillText(serverName, x - 35, y - 5);

                // Private IP
                const privateNet = server.private_net.find(pn => pn.network === network.id);
                ctx.font = '10px monospace';
                ctx.fillStyle = '#666';
                ctx.fillText(privateNet?.ip || 'N/A', x - 35, y + 10);
            });

            // Draw center hub
            ctx.fillStyle = '#667eea';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 15, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#5568d3';
            ctx.lineWidth = 2;
            ctx.stroke();

        }, 100);
    }

    setupNetworkActions(networkId) {
        const card = document.querySelector(`[data-network-id="${networkId}"]`);
        const deleteBtn = card.querySelector('.action-delete-network');

        deleteBtn.addEventListener('click', async () => {
            await this.handleDeleteNetwork(networkId);
        });
    }

    async handleDeleteNetwork(networkId) {
        const card = document.querySelector(`[data-network-id="${networkId}"]`);
        const networkName = card.querySelector('.network-name').textContent;

        if (!confirm(`Are you sure you want to delete network "${networkName}"?`)) {
            return;
        }

        try {
            await this.api.deleteNetwork(networkId);
            this.loadNetworks();
        } catch (error) {
            alert(`Error deleting network: ${error.message}`);
        }
    }

    showNetworkModal() {
        document.getElementById('create-network-modal').style.display = 'flex';
    }

    closeNetworkModal() {
        document.getElementById('create-network-modal').style.display = 'none';
        document.getElementById('create-network-form').reset();
        document.getElementById('create-network-error').textContent = '';
    }

    async handleCreateNetwork(e) {
        e.preventDefault();

        const name = document.getElementById('network-name').value.trim();
        const ipRange = document.getElementById('network-ip-range').value.trim();

        const errorDiv = document.getElementById('create-network-error');
        const submitBtn = document.getElementById('create-network-submit');

        errorDiv.textContent = '';

        if (!name) {
            errorDiv.textContent = 'Please enter a network name';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        try {
            await this.api.createNetwork({
                name,
                ip_range: ipRange || '10.0.0.0/16',
            });

            this.closeNetworkModal();
            this.loadNetworks();
        } catch (error) {
            errorDiv.textContent = `Error: ${error.message}`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Network';
        }
    }

    showMetricsModal(serverId) {
        this.currentMetricsServerId = serverId;
        const server = this.metrics.servers.find(s => s.id === serverId);
        if (server) {
            document.getElementById('metrics-server-name').textContent = server.name;
        }
        document.getElementById('server-metrics-modal').style.display = 'flex';
        this.loadMetricsData();
    }

    closeMetricsModal() {
        document.getElementById('server-metrics-modal').style.display = 'none';
        this.currentMetricsServerId = null;
        // Destroy chart if it exists
        if (this.metricsChart) {
            this.metricsChart.destroy();
            this.metricsChart = null;
        }
    }

    // Edit Server Modal Methods
    async showEditServerModal(serverId) {
        this.currentEditServerId = serverId;
        const server = this.metrics.servers.find(s => s.id === serverId);
        if (server) {
            document.getElementById('edit-server-name').textContent = server.name;
            document.getElementById('edit-server-id').value = serverId;
        }

        // Load dropdown options
        await this.loadEditServerOptions(server);

        document.getElementById('edit-server-modal').style.display = 'flex';
    }

    closeEditServerModal() {
        document.getElementById('edit-server-modal').style.display = 'none';
        this.currentEditServerId = null;
    }

    async loadEditServerOptions(server) {
        // Load available networks
        const networkSelect = document.getElementById('attach-network-select');
        networkSelect.innerHTML = '<option value="">Select a network...</option>';
        this.metrics.networks.forEach(net => {
            const isAttached = server.private_net && server.private_net.some(pn => pn.network === net.id);
            if (!isAttached) {
                networkSelect.innerHTML += `<option value="${net.id}">${net.name} (${net.ip_range})</option>`;
            }
        });

        // Display attached networks
        const networksListDiv = document.getElementById('server-networks-list');
        if (server.private_net && server.private_net.length > 0) {
            networksListDiv.innerHTML = server.private_net.map(pn => {
                const network = this.metrics.networks.find(n => n.id === pn.network);
                return `<div class="resource-item">
                    <span>${network ? network.name : 'Network ' + pn.network}: ${pn.ip}</span>
                    <button class="btn-small" onclick="app.detachNetworkFromServer(${pn.network})">Detach</button>
                </div>`;
            }).join('');
        } else {
            networksListDiv.innerHTML = '<p style="color: var(--text-secondary);">No networks attached</p>';
        }

        // Load available floating IPs
        const floatingIPSelect = document.getElementById('assign-floating-ip-select');
        floatingIPSelect.innerHTML = '<option value="">Select a floating IP...</option>';
        this.metrics.floating_ips.forEach(fip => {
            if (!fip.server || fip.server === server.id) {
                const text = fip.server === server.id ? `${fip.ip} (already assigned)` : `${fip.ip}`;
                floatingIPSelect.innerHTML += `<option value="${fip.id}" ${fip.server === server.id ? 'disabled' : ''}>${text}</option>`;
            }
        });

        // Display assigned floating IPs
        const floatingIPsListDiv = document.getElementById('server-floating-ips-list');
        const assignedFIPs = this.metrics.floating_ips.filter(fip => fip.server === server.id);
        if (assignedFIPs.length > 0) {
            floatingIPsListDiv.innerHTML = assignedFIPs.map(fip => `
                <div class="resource-item">
                    <span>${fip.ip} (${fip.type})</span>
                    <button class="btn-small" onclick="app.unassignFloatingIPFromServer(${fip.id})">Unassign</button>
                </div>
            `).join('');
        } else {
            floatingIPsListDiv.innerHTML = '<p style="color: var(--text-secondary);">No floating IPs assigned</p>';
        }

        // Load available volumes
        const volumeSelect = document.getElementById('attach-volume-select');
        volumeSelect.innerHTML = '<option value="">Select a volume...</option>';
        this.metrics.volumes.forEach(vol => {
            if (!vol.server) {
                volumeSelect.innerHTML += `<option value="${vol.id}">${vol.name} (${vol.size}GB)</option>`;
            }
        });

        // Display attached volumes
        const volumesListDiv = document.getElementById('server-volumes-list');
        const attachedVolumes = this.metrics.volumes.filter(vol => vol.server === server.id);
        if (attachedVolumes.length > 0) {
            volumesListDiv.innerHTML = attachedVolumes.map(vol => `
                <div class="resource-item">
                    <span>${vol.name} (${vol.size}GB)</span>
                    <button class="btn-small" onclick="app.detachVolumeFromServer(${vol.id})">Detach</button>
                </div>
            `).join('');
        } else {
            volumesListDiv.innerHTML = '<p style="color: var(--text-secondary);">No volumes attached</p>';
        }

        // Load server types
        try {
            const data = await this.api.getServerTypes();
            const serverTypeSelect = document.getElementById('change-server-type-select');
            serverTypeSelect.innerHTML = '<option value="">Select a server type...</option>';
            data.server_types.forEach(st => {
                const selected = st.name === server.server_type ? 'selected' : '';
                serverTypeSelect.innerHTML += `<option value="${st.name}" ${selected}>${st.name} - ${st.cores} cores, ${st.memory}GB RAM (€${st.prices.monthly.toFixed(2)}/month)</option>`;
            });
        } catch (error) {
            console.error('Error loading server types:', error);
        }
    }

    async attachNetworkToServer() {
        const serverId = this.currentEditServerId;
        const networkId = parseInt(document.getElementById('attach-network-select').value);

        if (!networkId) {
            alert('Please select a network');
            return;
        }

        try {
            await this.api.request(`/api/servers/${serverId}/attach-network`, {
                method: 'POST',
                body: JSON.stringify({ network_id: networkId })
            });
            alert('Network attached successfully');

            // Reload all data to refresh the UI
            await this.loadAll();

            // Get updated server data and reload edit options
            const server = this.metrics.servers.find(s => s.id === serverId);
            await this.loadEditServerOptions(server);
        } catch (error) {
            alert(`Error attaching network: ${error.message}`);
        }
    }

    async detachNetworkFromServer(networkId) {
        const serverId = this.currentEditServerId;

        if (!confirm('Are you sure you want to detach this network?')) {
            return;
        }

        try {
            await this.api.request(`/api/servers/${serverId}/detach-network`, {
                method: 'POST',
                body: JSON.stringify({ network_id: networkId })
            });
            alert('Network detached successfully');
            await this.loadServers();
            const server = this.metrics.servers.find(s => s.id === serverId);
            await this.loadEditServerOptions(server);
        } catch (error) {
            alert(`Error detaching network: ${error.message}`);
        }
    }

    async assignFloatingIPToServer() {
        const serverId = this.currentEditServerId;
        const floatingIpId = parseInt(document.getElementById('assign-floating-ip-select').value);

        if (!floatingIpId) {
            alert('Please select a floating IP');
            return;
        }

        try {
            await this.api.request(`/api/servers/${serverId}/assign-floating-ip`, {
                method: 'POST',
                body: JSON.stringify({ floating_ip_id: floatingIpId })
            });
            alert('Floating IP assigned successfully');
            await this.loadFloatingIPs();
            await this.loadServers();
            const server = this.metrics.servers.find(s => s.id === serverId);
            await this.loadEditServerOptions(server);
        } catch (error) {
            alert(`Error assigning floating IP: ${error.message}`);
        }
    }

    async unassignFloatingIPFromServer(floatingIpId) {
        const serverId = this.currentEditServerId;

        if (!confirm('Are you sure you want to unassign this floating IP?')) {
            return;
        }

        try {
            await this.api.request(`/api/servers/${serverId}/unassign-floating-ip`, {
                method: 'POST',
                body: JSON.stringify({ floating_ip_id: floatingIpId })
            });
            alert('Floating IP unassigned successfully');
            await this.loadFloatingIPs();
            await this.loadServers();
            const server = this.metrics.servers.find(s => s.id === serverId);
            await this.loadEditServerOptions(server);
        } catch (error) {
            alert(`Error unassigning floating IP: ${error.message}`);
        }
    }

    async attachVolumeToServer() {
        const serverId = this.currentEditServerId;
        const volumeId = parseInt(document.getElementById('attach-volume-select').value);

        if (!volumeId) {
            alert('Please select a volume');
            return;
        }

        try {
            await this.api.request(`/api/servers/${serverId}/attach-volume`, {
                method: 'POST',
                body: JSON.stringify({ volume_id: volumeId, automount: true })
            });
            alert('Volume attached successfully');
            await this.loadVolumes();
            await this.loadServers();
            const server = this.metrics.servers.find(s => s.id === serverId);
            await this.loadEditServerOptions(server);
        } catch (error) {
            alert(`Error attaching volume: ${error.message}`);
        }
    }

    async detachVolumeFromServer(volumeId) {
        const serverId = this.currentEditServerId;

        if (!confirm('Are you sure you want to detach this volume?')) {
            return;
        }

        try {
            await this.api.request(`/api/servers/${serverId}/detach-volume`, {
                method: 'POST',
                body: JSON.stringify({ volume_id: volumeId })
            });
            alert('Volume detached successfully');
            await this.loadVolumes();
            await this.loadServers();
            const server = this.metrics.servers.find(s => s.id === serverId);
            await this.loadEditServerOptions(server);
        } catch (error) {
            alert(`Error detaching volume: ${error.message}`);
        }
    }

    async changeServerType() {
        const serverId = this.currentEditServerId;
        const serverType = document.getElementById('change-server-type-select').value;
        const upgradeDisk = document.getElementById('upgrade-disk-checkbox').checked;

        if (!serverType) {
            alert('Please select a server type');
            return;
        }

        const server = this.metrics.servers.find(s => s.id === serverId);
        if (server.server_type === serverType) {
            alert('Server is already using this type');
            return;
        }

        if (!confirm(`Change server type to ${serverType}? ${upgradeDisk ? 'This will upgrade the disk (cannot be reverted).' : 'Disk size will remain the same.'}`)) {
            return;
        }

        try {
            await this.api.request(`/api/servers/${serverId}/change-type`, {
                method: 'POST',
                body: JSON.stringify({ server_type: serverType, upgrade_disk: upgradeDisk })
            });
            alert('Server type change initiated. This may take several minutes.');
            this.closeEditServerModal();
            await this.loadServers();
        } catch (error) {
            alert(`Error changing server type: ${error.message}`);
        }
    }

    async loadMetricsData() {
        if (!this.currentMetricsServerId) return;

        const metricType = document.getElementById('metrics-type-select').value;
        const timeRange = document.getElementById('metrics-range-select').value;
        const displayDiv = document.getElementById('metrics-display');

        displayDiv.innerHTML = '<div class="loading">Loading metrics...</div>';

        try {
            const data = await this.api.getServerMetrics(this.currentMetricsServerId, metricType, timeRange);
            this.renderMetrics(data);
        } catch (error) {
            displayDiv.innerHTML = `<div class="error">Error loading metrics: ${error.message}</div>`;
        }
    }

    renderMetrics(data) {
        const displayDiv = document.getElementById('metrics-display');

        if (!data.time_series || Object.keys(data.time_series).length === 0) {
            displayDiv.innerHTML = '<div class="empty-state"><p>No metrics data available for this time range.</p></div>';
            return;
        }

        // Destroy existing chart if it exists
        if (this.metricsChart) {
            this.metricsChart.destroy();
        }

        const metricKeys = Object.keys(data.time_series);
        const firstMetricKey = metricKeys[0];
        const timestamps = Object.keys(data.time_series[firstMetricKey]).sort((a, b) => parseInt(a) - parseInt(b));

        // Prepare chart HTML
        let metricsHtml = `
            <div class="metrics-info">
                <p><strong>Metric Type:</strong> ${this.getMetricTypeName(data.metric_type)}</p>
                <p><strong>Time Range:</strong> ${this.getTimeRangeName(data.time_range)}</p>
                <p><strong>Period:</strong> ${new Date(data.start).toLocaleString()} - ${new Date(data.end).toLocaleString()}</p>
            </div>
            <div class="metrics-chart-container">
                <canvas id="metrics-chart"></canvas>
            </div>
        `;

        // Add summary statistics
        metricsHtml += '<div class="metrics-summary"><h3>Summary Statistics</h3>';
        metricKeys.forEach(key => {
            const values = Object.values(data.time_series[key]);
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            const max = Math.max(...values);
            const min = Math.min(...values);

            metricsHtml += `
                <div class="summary-item">
                    <strong>${this.formatMetricName(key)}:</strong><br>
                    Average: ${this.formatMetricValue(avg, data.metric_type, key)}<br>
                    Min: ${this.formatMetricValue(min, data.metric_type, key)}<br>
                    Max: ${this.formatMetricValue(max, data.metric_type, key)}
                </div>
            `;
        });
        metricsHtml += '</div>';

        displayDiv.innerHTML = metricsHtml;

        // Create chart
        const ctx = document.getElementById('metrics-chart').getContext('2d');

        // Prepare datasets for Chart.js
        const datasets = metricKeys.map((key, index) => {
            const colors = [
                'rgb(102, 126, 234)',
                'rgb(118, 75, 162)',
                'rgb(237, 100, 166)',
                'rgb(255, 154, 0)',
                'rgb(46, 125, 50)'
            ];
            const color = colors[index % colors.length];

            return {
                label: this.formatMetricName(key),
                data: timestamps.map(ts => ({
                    x: parseInt(ts) * 1000, // Convert to milliseconds
                    y: data.time_series[key][ts]
                })),
                borderColor: color,
                backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
                tension: 0.4,
                fill: true
            };
        });

        // Get unit for Y-axis
        let yAxisLabel = 'Value';
        if (data.metric_type === 'cpu') {
            yAxisLabel = 'CPU Usage (%)';
        } else if (data.metric_type === 'disk') {
            yAxisLabel = 'Disk I/O (ops/s)';
        } else if (data.metric_type === 'network') {
            yAxisLabel = 'Network Traffic (bytes/s)';
        }

        this.metricsChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += this.formatMetricValue(context.parsed.y, data.metric_type, '');
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            displayFormats: {
                                hour: 'HH:mm',
                                day: 'MMM d',
                                week: 'MMM d',
                                month: 'MMM yyyy'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Time'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: yAxisLabel
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                }
            }
        });
    }

    getMetricTypeName(type) {
        const names = {
            'cpu': 'CPU Usage',
            'disk': 'Disk I/O',
            'network': 'Network Traffic'
        };
        return names[type] || type;
    }

    getTimeRangeName(range) {
        const names = {
            '1h': 'Last Hour',
            '24h': 'Last 24 Hours',
            '7d': 'Last 7 Days',
            '30d': 'Last 30 Days'
        };
        return names[range] || range;
    }

    formatMetricName(key) {
        return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    formatMetricValue(value, metricType, metricKey) {
        if (value === null || value === undefined) return 'N/A';

        // Round to 2 decimal places
        const rounded = Math.round(value * 100) / 100;

        // Add units based on metric type
        if (metricType === 'cpu') {
            return `${rounded}%`;
        } else if (metricType === 'disk') {
            return `${rounded} ops/s`;
        } else if (metricType === 'network') {
            return `${rounded} bytes/s`;
        }

        return rounded.toString();
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
});
