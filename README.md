# Hetzner Cloud Control Panel

Web-based control panel for Hetzner Cloud using their API.

## Features

### Dashboard & Metrics
- **Overview Dashboard** with real-time infrastructure metrics
- **Resource Count Cards** showing servers, storage, networking, and estimated costs
- **Quick Actions** for common operations
- **Resource Summary** with all your cloud resources at a glance
- **Estimated Monthly Cost** calculator based on active resources

### Improved UI/UX
- **Sidebar Navigation** - Easy access to different resource categories
- **Organized Views** - Resources grouped into logical sections:
  - Overview: Dashboard with metrics and quick actions
  - Servers: All compute resources
  - Networking: Floating IPs, Networks, Load Balancers
  - Storage: Volumes
  - Security: Firewalls and SSH Keys
- **No Endless Scrolling** - Content organized in separate views
- **Responsive Design** - Works on desktop and mobile devices

### Server Management
- Create, delete, and manage cloud servers
- Power actions: start, stop, reboot, shutdown
- View server details (IP addresses, location, type, status)
- **Server Metrics** - View real-time performance metrics:
  - CPU usage over time
  - Disk I/O operations
  - Network traffic statistics
  - Multiple time ranges (1 hour, 24 hours, 7 days, 30 days)
  - Summary statistics (average, min, max)

### SSH Keys
- Add and manage SSH keys
- View key fingerprints
- Delete unused keys

### Floating IPs
- Create IPv4 and IPv6 floating IPs
- Assign/unassign IPs to servers
- Manage IP locations

### Volumes
- Create and manage persistent storage volumes
- Attach/detach volumes to servers
- Configure volume format (ext4, xfs)

### Firewalls
- Create custom firewall configurations
- Define inbound/outbound rules
- Specify protocols, ports, and IP ranges
- Visual rule display with color coding

### Private Networks
- Create private networks with custom IP ranges
- Visual network topology diagram
- See all servers connected to each network
- Canvas-based visualization showing server connections

### Load Balancers
- View and manage load balancers
- Monitor targets and health status
- Delete load balancers

### Storage Boxes (api.hetzner.com)
- **Separate API** from Cloud API - requires different token
- List and manage Storage Boxes
- View storage usage statistics and pricing
- Manage access settings (SSH, Samba, WebDAV, FTP/FTPS)
- Configure snapshot plans for automatic backups
- Change storage box type (upgrade/downgrade)
- Reset passwords
- Browse folders in storage boxes
- **Subaccounts Management**:
  - Create subaccounts with separate credentials
  - Set home directories for each subaccount
  - Configure read-only access
  - Manage subaccount access settings independently
  - Reset subaccount passwords

## Technology Stack

- **Backend**: Python Flask with gunicorn
- **API Client**:
  - Official `hcloud` library for Cloud API (api.hetzner.cloud)
  - Custom wrapper using `requests` for Storage Boxes API (api.hetzner.com)
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Styling**: Custom CSS with gradient design
- **Security**: Client-side token storage with backend validation

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and configure if needed

3. Run the application:
```bash
python app.py
```

4. Open your browser and navigate to `http://localhost:5000`

5. Enter your API tokens to get started:
   - **Cloud API Token** - For servers, volumes, networking, etc. (api.hetzner.cloud)
   - **Storage Boxes Token** (Optional) - For Storage Boxes management (api.hetzner.com)

## API Tokens

This application supports **two different Hetzner APIs**:

### 1. Cloud API (api.hetzner.cloud)
- Manages: Servers, Volumes, Networks, Floating IPs, Load Balancers, Firewalls, SSH Keys
- Get token from: [Hetzner Cloud Console](https://console.hetzner.cloud/) → Security → API Tokens

### 2. Storage Boxes API (api.hetzner.com)
- Manages: Storage Boxes and Subaccounts
- Get token from: [Hetzner Cloud Console](https://console.hetzner.cloud/) → Security → API Tokens
- **Note**: This is a separate API requiring a different token

Both tokens are optional and independent - you can use only one or both depending on your needs.

## Security

- API tokens are stored only in browser localStorage
- Backend never stores tokens permanently
- All API calls are proxied through the backend
- Token validation on every request
- No secrets in version control