// Storage Boxes API Client (api.hetzner.com)
class StorageBoxesAPI {
    constructor() {
        this.baseURL = window.location.origin;
        this.tokenKey = 'hetzner_storage_token';
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
            throw new Error('No Storage API token found');
        }

        const headers = {
            'Content-Type': 'application/json',
            'X-Storage-Token': token,
            ...options.headers,
        };

        const response = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Storage API request failed');
        }

        return data;
    }

    async testToken(token) {
        const tempToken = this.getToken();
        this.saveToken(token);

        try {
            await this.request('/api/storage/test-token', { method: 'POST' });
            return true;
        } catch (error) {
            this.clearToken();
            if (tempToken) {
                this.saveToken(tempToken);
            }
            throw error;
        }
    }

    // Storage Boxes methods
    async getStorageBoxes() {
        return this.request('/api/storage/boxes');
    }

    async getStorageBox(boxId) {
        return this.request(`/api/storage/boxes/${boxId}`);
    }

    async createStorageBox(boxData) {
        return this.request('/api/storage/boxes', {
            method: 'POST',
            body: JSON.stringify(boxData),
        });
    }

    async updateStorageBox(boxId, updates) {
        return this.request(`/api/storage/boxes/${boxId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deleteStorageBox(boxId) {
        return this.request(`/api/storage/boxes/${boxId}`, {
            method: 'DELETE',
        });
    }

    async listFolders(boxId, path = '.') {
        return this.request(`/api/storage/boxes/${boxId}/folders?path=${encodeURIComponent(path)}`);
    }

    async changeProtection(boxId, deleteProtection) {
        return this.request(`/api/storage/boxes/${boxId}/actions/change_protection`, {
            method: 'POST',
            body: JSON.stringify({ delete: deleteProtection }),
        });
    }

    async changeType(boxId, storageBoxType) {
        return this.request(`/api/storage/boxes/${boxId}/actions/change_type`, {
            method: 'POST',
            body: JSON.stringify({ storage_box_type: storageBoxType }),
        });
    }

    async resetPassword(boxId, password) {
        return this.request(`/api/storage/boxes/${boxId}/actions/reset_password`, {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
    }

    async updateAccessSettings(boxId, settings) {
        return this.request(`/api/storage/boxes/${boxId}/actions/update_access_settings`, {
            method: 'POST',
            body: JSON.stringify(settings),
        });
    }

    async enableSnapshotPlan(boxId, planData) {
        return this.request(`/api/storage/boxes/${boxId}/actions/enable_snapshot_plan`, {
            method: 'POST',
            body: JSON.stringify(planData),
        });
    }

    async disableSnapshotPlan(boxId) {
        return this.request(`/api/storage/boxes/${boxId}/actions/disable_snapshot_plan`, {
            method: 'POST',
        });
    }

    // Subaccounts methods
    async getSubaccounts(boxId) {
        return this.request(`/api/storage/boxes/${boxId}/subaccounts`);
    }

    async getSubaccount(boxId, subaccountId) {
        return this.request(`/api/storage/boxes/${boxId}/subaccounts/${subaccountId}`);
    }

    async createSubaccount(boxId, subaccountData) {
        return this.request(`/api/storage/boxes/${boxId}/subaccounts`, {
            method: 'POST',
            body: JSON.stringify(subaccountData),
        });
    }

    async updateSubaccount(boxId, subaccountId, updates) {
        return this.request(`/api/storage/boxes/${boxId}/subaccounts/${subaccountId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deleteSubaccount(boxId, subaccountId) {
        return this.request(`/api/storage/boxes/${boxId}/subaccounts/${subaccountId}`, {
            method: 'DELETE',
        });
    }

    async resetSubaccountPassword(boxId, subaccountId, password) {
        return this.request(`/api/storage/boxes/${boxId}/subaccounts/${subaccountId}/actions/reset_password`, {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
    }

    async updateSubaccountAccessSettings(boxId, subaccountId, settings) {
        return this.request(`/api/storage/boxes/${boxId}/subaccounts/${subaccountId}/actions/update_access_settings`, {
            method: 'POST',
            body: JSON.stringify(settings),
        });
    }
}

// Initialize Storage Boxes API client
const storageAPI = new StorageBoxesAPI();

// Storage Boxes UI Manager
class StorageBoxesUI {
    constructor() {
        this.currentView = null;
        this.currentBox = null;
    }

    async init() {
        // Check if we have a storage token
        const hasToken = storageAPI.getToken();

        if (hasToken) {
            await this.loadStorageBoxes();
        }
    }

    async loadStorageBoxes() {
        try {
            const response = await storageAPI.getStorageBoxes();
            this.renderStorageBoxes(response.storage_boxes);
        } catch (error) {
            console.error('Failed to load storage boxes:', error);
            this.showError('Failed to load storage boxes: ' + error.message);
        }
    }

    renderStorageBoxes(boxes) {
        const container = document.getElementById('storage-boxes-list');
        if (!container) return;

        if (boxes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No storage boxes found</p>
                    <button class="btn btn-primary" onclick="storageUI.showCreateBoxDialog()">Create Storage Box</button>
                </div>
            `;
            return;
        }

        container.innerHTML = boxes.map(box => `
            <div class="resource-card storage-box-card" data-box-id="${box.id}">
                <div class="resource-card-header">
                    <h3>${box.name || 'Unnamed Storage Box'}</h3>
                    <span class="status-badge status-${box.status}">${box.status}</span>
                </div>
                <div class="resource-card-body">
                    <div class="resource-info">
                        <div class="info-row">
                            <span class="label">Username:</span>
                            <span class="value">${box.username || 'N/A'}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Server:</span>
                            <span class="value">${box.server || 'N/A'}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Type:</span>
                            <span class="value">${box.storage_box_type?.description || 'N/A'}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Size:</span>
                            <span class="value">${this.formatBytes(box.storage_box_type?.size || 0)}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Location:</span>
                            <span class="value">${box.location?.city || 'N/A'}, ${box.location?.country || 'N/A'}</span>
                        </div>
                        ${box.stats ? `
                        <div class="info-row">
                            <span class="label">Usage:</span>
                            <span class="value">${this.formatBytes(box.stats.size || 0)} used</span>
                        </div>
                        ` : ''}
                        <div class="info-row">
                            <span class="label">Access:</span>
                            <span class="value">
                                ${box.access_settings?.ssh_enabled ? '🔑 SSH ' : ''}
                                ${box.access_settings?.samba_enabled ? '📁 Samba ' : ''}
                                ${box.access_settings?.webdav_enabled ? '🌐 WebDAV ' : ''}
                            </span>
                        </div>
                        <div class="info-row">
                            <span class="label">Monthly Cost:</span>
                            <span class="value">€${(box.pricing?.monthly || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                <div class="resource-card-actions">
                    <button class="btn btn-sm" onclick="storageUI.showBoxDetails(${box.id})">Details</button>
                    <button class="btn btn-sm" onclick="storageUI.showSubaccounts(${box.id})">Subaccounts</button>
                    <button class="btn btn-sm" onclick="storageUI.showAccessSettings(${box.id})">Access</button>
                    <button class="btn btn-sm btn-danger" onclick="storageUI.deleteBox(${box.id})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showError(message) {
        const errorDiv = document.getElementById('storage-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        } else {
            alert(message);
        }
    }

    showSuccess(message) {
        const successDiv = document.getElementById('storage-success');
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 3000);
        } else {
            alert(message);
        }
    }

    async showBoxDetails(boxId) {
        try {
            const response = await storageAPI.getStorageBox(boxId);
            const box = response.storage_box;

            // Create and show modal with box details
            alert(`Storage Box Details\n\nName: ${box.name}\nUsername: ${box.username}\nServer: ${box.server}\nStatus: ${box.status}`);
        } catch (error) {
            this.showError('Failed to load box details: ' + error.message);
        }
    }

    async showSubaccounts(boxId) {
        try {
            const response = await storageAPI.getSubaccounts(boxId);
            const subaccounts = response.subaccounts || [];

            // In a real implementation, this would open a modal/view
            if (subaccounts.length === 0) {
                alert('No subaccounts found for this storage box.');
            } else {
                const list = subaccounts.map(sub =>
                    `- ${sub.username}: ${sub.description || 'No description'} (${sub.home_directory})`
                ).join('\n');
                alert(`Subaccounts:\n\n${list}`);
            }
        } catch (error) {
            this.showError('Failed to load subaccounts: ' + error.message);
        }
    }

    async showAccessSettings(boxId) {
        try {
            const response = await storageAPI.getStorageBox(boxId);
            const box = response.storage_box;
            const settings = box.access_settings;

            alert(`Access Settings\n\nSSH: ${settings.ssh_enabled ? 'Enabled' : 'Disabled'}\nSamba: ${settings.samba_enabled ? 'Enabled' : 'Disabled'}\nWebDAV: ${settings.webdav_enabled ? 'Enabled' : 'Disabled'}\nZFS Snapshots: ${settings.zfs_enabled ? 'Visible' : 'Hidden'}\nExternal Access: ${settings.reachable_externally ? 'Allowed' : 'Blocked'}`);
        } catch (error) {
            this.showError('Failed to load access settings: ' + error.message);
        }
    }

    async deleteBox(boxId) {
        if (!confirm('Are you sure you want to delete this storage box? This action cannot be undone!')) {
            return;
        }

        try {
            await storageAPI.deleteStorageBox(boxId);
            this.showSuccess('Storage box deletion initiated');
            await this.loadStorageBoxes();
        } catch (error) {
            this.showError('Failed to delete storage box: ' + error.message);
        }
    }

    showCreateBoxDialog() {
        alert('Create Storage Box functionality would open a modal here. Implementation coming soon!');
    }
}

// Initialize Storage Boxes UI
const storageUI = new StorageBoxesUI();

// Export for use in main app
window.storageAPI = storageAPI;
window.storageUI = storageUI;
