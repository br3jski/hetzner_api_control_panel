from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from hcloud import Client
from hcloud.actions.domain import Action
from hcloud.images.domain import Image
from hcloud.server_types.domain import ServerType
from hcloud.ssh_keys.domain import SSHKey
from hcloud.floating_ips.domain import FloatingIP
from hcloud.volumes.domain import Volume
from hcloud.firewalls.domain import Firewall, FirewallRule
from hcloud.load_balancers.domain import LoadBalancer
from hcloud.networks.domain import Network
from functools import wraps
import os
from dotenv import load_dotenv
from storage_boxes_client import StorageBoxesClient

load_dotenv()

app = Flask(__name__)
CORS(app)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')


def require_token(f):
    """Decorator to validate Hetzner API token from request headers"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('X-Hetzner-Token')

        if not token:
            return jsonify({'error': 'No API token provided'}), 401

        try:
            client = Client(token=token)
            # Test token validity by making a simple API call
            client.servers.get_all()
            return f(client, *args, **kwargs)
        except Exception as e:
            return jsonify({'error': f'Invalid token or API error: {str(e)}'}), 401

    return decorated_function


def require_storage_token(f):
    """Decorator to validate Hetzner Storage Boxes API token from request headers"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('X-Storage-Token')

        if not token:
            return jsonify({'error': 'No Storage Boxes API token provided'}), 401

        try:
            client = StorageBoxesClient(api_token=token)
            # Test token validity by making a simple API call
            client.list_storage_boxes(per_page=1)
            return f(client, *args, **kwargs)
        except Exception as e:
            return jsonify({'error': f'Invalid token or API error: {str(e)}'}), 401

    return decorated_function


@app.route('/')
def index():
    """Serve the main frontend page"""
    return render_template('index.html')


@app.route('/api/test-token', methods=['POST'])
@require_token
def test_token(client):
    """Test if the provided API token is valid"""
    return jsonify({'valid': True, 'message': 'Token is valid'})


@app.route('/api/servers', methods=['GET'])
@require_token
def get_servers(client):
    """Get all servers"""
    try:
        servers = client.servers.get_all()
        servers_data = []

        for server in servers:
            # Get pricing information
            monthly_price = 0
            try:
                if server.server_type.prices:
                    price_obj = server.server_type.prices[0]
                    # Handle both dict and object formats
                    if hasattr(price_obj, 'price_monthly'):
                        monthly_price = float(price_obj.price_monthly.gross)
                    elif isinstance(price_obj, dict):
                        monthly_price = float(price_obj.get('price_monthly', {}).get('gross', 0))
            except (AttributeError, KeyError, IndexError, ValueError):
                monthly_price = 0

            servers_data.append({
                'id': server.id,
                'name': server.name,
                'status': server.status,
                'server_type': server.server_type.name,
                'server_type_pricing': {
                    'monthly': monthly_price,
                },
                'server_type_specs': {
                    'cores': server.server_type.cores,
                    'memory': server.server_type.memory,  # in GB
                    'disk': server.server_type.disk,  # in GB
                },
                'datacenter': server.datacenter.name,
                'location': server.datacenter.location.name,
                'public_net': {
                    'ipv4': server.public_net.ipv4.ip if server.public_net.ipv4 else None,
                    'ipv6': server.public_net.ipv6.ip if server.public_net.ipv6 else None,
                },
                'created': server.created.isoformat(),
                'image': server.image.name if server.image else None,
            })

        return jsonify({'servers': servers_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/servers/<int:server_id>', methods=['GET'])
@require_token
def get_server(client, server_id):
    """Get details of a specific server"""
    try:
        server = client.servers.get_by_id(server_id)

        if not server:
            return jsonify({'error': 'Server not found'}), 404

        server_data = {
            'id': server.id,
            'name': server.name,
            'status': server.status,
            'server_type': {
                'name': server.server_type.name,
                'cores': server.server_type.cores,
                'memory': server.server_type.memory,
                'disk': server.server_type.disk,
            },
            'datacenter': server.datacenter.name,
            'location': server.datacenter.location.name,
            'public_net': {
                'ipv4': server.public_net.ipv4.ip if server.public_net.ipv4 else None,
                'ipv6': server.public_net.ipv6.ip if server.public_net.ipv6 else None,
            },
            'created': server.created.isoformat(),
            'image': server.image.name if server.image else None,
            'labels': server.labels,
        }

        return jsonify(server_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/servers/<int:server_id>/metrics', methods=['GET'])
@require_token
def get_server_metrics(client, server_id):
    """Get metrics for a specific server"""
    try:
        from datetime import datetime, timedelta

        server = client.servers.get_by_id(server_id)

        if not server:
            return jsonify({'error': 'Server not found'}), 404

        # Get query parameters
        metric_type = request.args.get('type', 'cpu')
        time_range = request.args.get('range', '1h')

        # Calculate time range
        end = datetime.utcnow()
        if time_range == '1h':
            start = end - timedelta(hours=1)
        elif time_range == '24h':
            start = end - timedelta(hours=24)
        elif time_range == '7d':
            start = end - timedelta(days=7)
        elif time_range == '30d':
            start = end - timedelta(days=30)
        else:
            start = end - timedelta(hours=1)

        # Fetch metrics from Hetzner API
        # The API expects ISO format strings with 'Z' suffix for UTC
        metrics_response = client.servers.get_metrics(
            server,
            type=metric_type,
            start=start.isoformat() + 'Z',
            end=end.isoformat() + 'Z'
        )

        # Format the response
        # The hcloud library returns a GetMetricsResponse object with a 'metrics' attribute
        # The 'metrics' attribute contains the time series data
        time_series_data = {}

        if hasattr(metrics_response, 'metrics') and metrics_response.metrics:
            # metrics_response.metrics contains the time series data
            metrics_dict = metrics_response.metrics

            # Check if metrics_dict has a 'time_series' attribute
            if hasattr(metrics_dict, 'time_series'):
                time_series_obj = metrics_dict.time_series

                # Process time series data
                # time_series_obj is a dict like: {'cpu': {'values': [[timestamp, value], ...]}}
                if isinstance(time_series_obj, dict):
                    for metric_name, series_data in time_series_obj.items():
                        # series_data is a dict with 'values' key containing [[timestamp, value], ...]
                        if isinstance(series_data, dict) and 'values' in series_data:
                            values_list = series_data['values']
                            # Convert list of [timestamp, value] pairs to dict
                            time_series_data[metric_name] = {
                                str(int(timestamp)): float(value)
                                for timestamp, value in values_list
                            }
                        elif hasattr(series_data, 'values'):
                            # If it's an object with values attribute
                            values_list = series_data.values
                            time_series_data[metric_name] = {
                                str(int(timestamp)): float(value)
                                for timestamp, value in values_list
                            }
                        else:
                            time_series_data[metric_name] = series_data

            # Fallback to treating metrics_dict as a dict
            elif isinstance(metrics_dict, dict):
                for metric_name, data_points in metrics_dict.items():
                    if isinstance(data_points, dict):
                        # data_points is a dict of timestamp -> value
                        time_series_data[metric_name] = {str(k): v for k, v in data_points.items()}
                    elif isinstance(data_points, list):
                        # data_points is a list of values
                        time_series_data[metric_name] = {str(i): v for i, v in enumerate(data_points)}
                    else:
                        time_series_data[metric_name] = data_points

        metrics_data = {
            'server_id': server_id,
            'server_name': server.name,
            'metric_type': metric_type,
            'time_range': time_range,
            'start': start.isoformat(),
            'end': end.isoformat(),
            'time_series': time_series_data
        }

        return jsonify(metrics_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/servers/<int:server_id>/power', methods=['POST'])
@require_token
def server_power_action(client, server_id):
    """Perform power actions on a server (start, stop, reboot)"""
    try:
        server = client.servers.get_by_id(server_id)

        if not server:
            return jsonify({'error': 'Server not found'}), 404

        action_type = request.json.get('action')

        if action_type == 'start':
            action = client.servers.power_on(server)
        elif action_type == 'stop':
            action = client.servers.power_off(server)
        elif action_type == 'reboot':
            action = client.servers.reboot(server)
        elif action_type == 'shutdown':
            action = client.servers.shutdown(server)
        else:
            return jsonify({'error': 'Invalid action'}), 400

        return jsonify({
            'success': True,
            'action_id': action.action.id if hasattr(action, 'action') else None,
            'message': f'Action {action_type} initiated'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/servers', methods=['POST'])
@require_token
def create_server(client):
    """Create a new server"""
    try:
        data = request.json

        # Required fields
        name = data.get('name')
        server_type = data.get('server_type')
        image = data.get('image')
        location = data.get('location')

        if not all([name, server_type, image, location]):
            return jsonify({'error': 'Missing required fields'}), 400

        # Optional fields
        ssh_keys = data.get('ssh_keys', [])
        user_data = data.get('user_data')

        # Get server type and image objects
        server_type_obj = client.server_types.get_by_name(server_type)
        image_obj = client.images.get_by_name(image)

        if not server_type_obj:
            return jsonify({'error': f'Server type {server_type} not found'}), 404
        if not image_obj:
            return jsonify({'error': f'Image {image} not found'}), 404

        # Get SSH keys if provided
        ssh_key_objs = []
        for key_id in ssh_keys:
            key = client.ssh_keys.get_by_id(key_id)
            if key:
                ssh_key_objs.append(key)

        # Create server
        response = client.servers.create(
            name=name,
            server_type=server_type_obj,
            image=image_obj,
            location=location,
            ssh_keys=ssh_key_objs if ssh_key_objs else None,
            user_data=user_data
        )

        server = response.server

        return jsonify({
            'success': True,
            'server': {
                'id': server.id,
                'name': server.name,
                'status': server.status,
            },
            'action_id': response.action.id if response.action else None,
            'message': 'Server creation initiated'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/servers/<int:server_id>', methods=['DELETE'])
@require_token
def delete_server(client, server_id):
    """Delete a server"""
    try:
        server = client.servers.get_by_id(server_id)

        if not server:
            return jsonify({'error': 'Server not found'}), 404

        action = client.servers.delete(server)

        return jsonify({
            'success': True,
            'message': 'Server deletion initiated',
            'action_id': action.action.id if hasattr(action, 'action') else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/server-types', methods=['GET'])
@require_token
def get_server_types(client):
    """Get all available server types"""
    try:
        server_types = client.server_types.get_all()
        types_data = []

        for st in server_types:
            types_data.append({
                'id': st.id,
                'name': st.name,
                'description': st.description,
                'cores': st.cores,
                'memory': st.memory,
                'disk': st.disk,
                'prices': {
                    'hourly': float(st.prices[0].price_hourly.gross) if st.prices else 0,
                    'monthly': float(st.prices[0].price_monthly.gross) if st.prices else 0,
                },
            })

        return jsonify({'server_types': types_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/images', methods=['GET'])
@require_token
def get_images(client):
    """Get all available images"""
    try:
        images = client.images.get_all(type='system')
        images_data = []

        for img in images:
            images_data.append({
                'id': img.id,
                'name': img.name,
                'description': img.description,
                'os_flavor': img.os_flavor,
                'os_version': img.os_version,
                'type': img.type,
            })

        return jsonify({'images': images_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/locations', methods=['GET'])
@require_token
def get_locations(client):
    """Get all available locations"""
    try:
        locations = client.locations.get_all()
        locations_data = []

        for loc in locations:
            locations_data.append({
                'id': loc.id,
                'name': loc.name,
                'description': loc.description,
                'country': loc.country,
                'city': loc.city,
            })

        return jsonify({'locations': locations_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ssh-keys', methods=['GET'])
@require_token
def get_ssh_keys(client):
    """Get all SSH keys"""
    try:
        ssh_keys = client.ssh_keys.get_all()
        keys_data = []

        for key in ssh_keys:
            keys_data.append({
                'id': key.id,
                'name': key.name,
                'fingerprint': key.fingerprint,
                'public_key': key.public_key,
                'labels': key.labels,
            })

        return jsonify({'ssh_keys': keys_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ssh-keys', methods=['POST'])
@require_token
def create_ssh_key(client):
    """Create a new SSH key"""
    try:
        data = request.json

        name = data.get('name')
        public_key = data.get('public_key')

        if not all([name, public_key]):
            return jsonify({'error': 'Missing required fields'}), 400

        ssh_key = client.ssh_keys.create(
            name=name,
            public_key=public_key
        )

        return jsonify({
            'success': True,
            'ssh_key': {
                'id': ssh_key.id,
                'name': ssh_key.name,
                'fingerprint': ssh_key.fingerprint,
            },
            'message': 'SSH key created successfully'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ssh-keys/<int:key_id>', methods=['DELETE'])
@require_token
def delete_ssh_key(client, key_id):
    """Delete an SSH key"""
    try:
        ssh_key = client.ssh_keys.get_by_id(key_id)

        if not ssh_key:
            return jsonify({'error': 'SSH key not found'}), 404

        client.ssh_keys.delete(ssh_key)

        return jsonify({
            'success': True,
            'message': 'SSH key deleted successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/floating-ips', methods=['GET'])
@require_token
def get_floating_ips(client):
    """Get all floating IPs"""
    try:
        floating_ips = client.floating_ips.get_all()
        ips_data = []

        for fip in floating_ips:
            # Get pricing information
            monthly_price = 0
            try:
                if fip.prices:
                    price_obj = fip.prices[0]
                    # Handle both dict and object formats
                    if hasattr(price_obj, 'price_monthly'):
                        monthly_price = float(price_obj.price_monthly.gross)
                    elif isinstance(price_obj, dict):
                        monthly_price = float(price_obj.get('price_monthly', {}).get('gross', 0))
            except (AttributeError, KeyError, IndexError, ValueError):
                monthly_price = 0

            ips_data.append({
                'id': fip.id,
                'name': fip.name,
                'ip': fip.ip,
                'type': fip.type,
                'server': fip.server.id if fip.server else None,
                'server_name': fip.server.name if fip.server else None,
                'location': fip.home_location.name if fip.home_location else None,
                'blocked': fip.blocked,
                'dns_ptr': [{'ip': ptr['ip'], 'dns_ptr': ptr['dns_ptr']} for ptr in fip.dns_ptr],
                'pricing': {
                    'monthly': monthly_price,
                },
            })

        return jsonify({'floating_ips': ips_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/floating-ips', methods=['POST'])
@require_token
def create_floating_ip(client):
    """Create a new floating IP"""
    try:
        data = request.json

        ip_type = data.get('type', 'ipv4')
        location = data.get('location')
        name = data.get('name')
        description = data.get('description')

        if not location:
            return jsonify({'error': 'Location is required'}), 400

        response = client.floating_ips.create(
            type=ip_type,
            location=location,
            name=name,
            description=description
        )

        fip = response.floating_ip

        return jsonify({
            'success': True,
            'floating_ip': {
                'id': fip.id,
                'ip': fip.ip,
                'type': fip.type,
            },
            'message': 'Floating IP created successfully'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/floating-ips/<int:fip_id>', methods=['DELETE'])
@require_token
def delete_floating_ip(client, fip_id):
    """Delete a floating IP"""
    try:
        fip = client.floating_ips.get_by_id(fip_id)

        if not fip:
            return jsonify({'error': 'Floating IP not found'}), 404

        client.floating_ips.delete(fip)

        return jsonify({
            'success': True,
            'message': 'Floating IP deleted successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/floating-ips/<int:fip_id>/assign', methods=['POST'])
@require_token
def assign_floating_ip(client, fip_id):
    """Assign floating IP to a server"""
    try:
        data = request.json
        server_id = data.get('server_id')

        if not server_id:
            return jsonify({'error': 'Server ID is required'}), 400

        fip = client.floating_ips.get_by_id(fip_id)
        server = client.servers.get_by_id(server_id)

        if not fip:
            return jsonify({'error': 'Floating IP not found'}), 404
        if not server:
            return jsonify({'error': 'Server not found'}), 404

        action = client.floating_ips.assign(fip, server)

        return jsonify({
            'success': True,
            'message': 'Floating IP assigned successfully',
            'action_id': action.id if action else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/floating-ips/<int:fip_id>/unassign', methods=['POST'])
@require_token
def unassign_floating_ip(client, fip_id):
    """Unassign floating IP from server"""
    try:
        fip = client.floating_ips.get_by_id(fip_id)

        if not fip:
            return jsonify({'error': 'Floating IP not found'}), 404

        action = client.floating_ips.unassign(fip)

        return jsonify({
            'success': True,
            'message': 'Floating IP unassigned successfully',
            'action_id': action.id if action else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/volumes', methods=['GET'])
@require_token
def get_volumes(client):
    """Get all volumes"""
    try:
        volumes = client.volumes.get_all()
        volumes_data = []

        for vol in volumes:
            # Calculate volume pricing (€0.0476/GB/month standard pricing)
            monthly_price = vol.size * 0.0476

            volumes_data.append({
                'id': vol.id,
                'name': vol.name,
                'size': vol.size,
                'server': vol.server if vol.server else None,
                'location': vol.location.name if vol.location else None,
                'linux_device': vol.linux_device,
                'format': vol.format,
                'created': vol.created.isoformat(),
                'pricing': {
                    'monthly': monthly_price,
                },
            })

        return jsonify({'volumes': volumes_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/volumes', methods=['POST'])
@require_token
def create_volume(client):
    """Create a new volume"""
    try:
        data = request.json

        name = data.get('name')
        size = data.get('size')
        location = data.get('location')
        format_volume = data.get('format', 'ext4')

        if not all([name, size, location]):
            return jsonify({'error': 'Missing required fields'}), 400

        response = client.volumes.create(
            name=name,
            size=int(size),
            location=location,
            format=format_volume
        )

        vol = response.volume

        return jsonify({
            'success': True,
            'volume': {
                'id': vol.id,
                'name': vol.name,
                'size': vol.size,
            },
            'message': 'Volume created successfully'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/volumes/<int:vol_id>', methods=['DELETE'])
@require_token
def delete_volume(client, vol_id):
    """Delete a volume"""
    try:
        vol = client.volumes.get_by_id(vol_id)

        if not vol:
            return jsonify({'error': 'Volume not found'}), 404

        client.volumes.delete(vol)

        return jsonify({
            'success': True,
            'message': 'Volume deleted successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/volumes/<int:vol_id>/attach', methods=['POST'])
@require_token
def attach_volume(client, vol_id):
    """Attach volume to a server"""
    try:
        data = request.json
        server_id = data.get('server_id')

        if not server_id:
            return jsonify({'error': 'Server ID is required'}), 400

        vol = client.volumes.get_by_id(vol_id)
        server = client.servers.get_by_id(server_id)

        if not vol:
            return jsonify({'error': 'Volume not found'}), 404
        if not server:
            return jsonify({'error': 'Server not found'}), 404

        action = client.volumes.attach(vol, server)

        return jsonify({
            'success': True,
            'message': 'Volume attached successfully',
            'action_id': action.id if action else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/volumes/<int:vol_id>/detach', methods=['POST'])
@require_token
def detach_volume(client, vol_id):
    """Detach volume from server"""
    try:
        vol = client.volumes.get_by_id(vol_id)

        if not vol:
            return jsonify({'error': 'Volume not found'}), 404

        action = client.volumes.detach(vol)

        return jsonify({
            'success': True,
            'message': 'Volume detached successfully',
            'action_id': action.id if action else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/firewalls', methods=['GET'])
@require_token
def get_firewalls(client):
    """Get all firewalls"""
    try:
        firewalls = client.firewalls.get_all()
        firewalls_data = []

        for fw in firewalls:
            firewalls_data.append({
                'id': fw.id,
                'name': fw.name,
                'rules': [{
                    'direction': rule.direction,
                    'protocol': rule.protocol,
                    'port': rule.port,
                    'source_ips': rule.source_ips,
                    'destination_ips': rule.destination_ips,
                } for rule in fw.rules],
                'applied_to': len(fw.applied_to),
            })

        return jsonify({'firewalls': firewalls_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/firewalls', methods=['POST'])
@require_token
def create_firewall(client):
    """Create a new firewall"""
    try:
        data = request.json

        name = data.get('name')
        rules_data = data.get('rules', [])

        if not name:
            return jsonify({'error': 'Name is required'}), 400

        # Create firewall rules
        rules = []
        for rule_data in rules_data:
            rule = FirewallRule(
                direction=rule_data.get('direction', 'in'),
                protocol=rule_data.get('protocol'),
                source_ips=rule_data.get('source_ips', []),
                destination_ips=rule_data.get('destination_ips', []),
                port=rule_data.get('port')
            )
            rules.append(rule)

        firewall = client.firewalls.create(
            name=name,
            rules=rules
        )

        return jsonify({
            'success': True,
            'firewall': {
                'id': firewall.firewall.id,
                'name': firewall.firewall.name,
            },
            'message': 'Firewall created successfully'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/firewalls/<int:fw_id>', methods=['DELETE'])
@require_token
def delete_firewall(client, fw_id):
    """Delete a firewall"""
    try:
        fw = client.firewalls.get_by_id(fw_id)

        if not fw:
            return jsonify({'error': 'Firewall not found'}), 404

        client.firewalls.delete(fw)

        return jsonify({
            'success': True,
            'message': 'Firewall deleted successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/load-balancers', methods=['GET'])
@require_token
def get_load_balancers(client):
    """Get all load balancers"""
    try:
        lbs = client.load_balancers.get_all()
        lbs_data = []

        for lb in lbs:
            # Get pricing information
            monthly_price = 0
            try:
                if lb.load_balancer_type and lb.load_balancer_type.prices:
                    price_obj = lb.load_balancer_type.prices[0]
                    # Handle both dict and object formats
                    if hasattr(price_obj, 'price_monthly'):
                        monthly_price = float(price_obj.price_monthly.gross)
                    elif isinstance(price_obj, dict):
                        monthly_price = float(price_obj.get('price_monthly', {}).get('gross', 0))
            except (AttributeError, KeyError, IndexError, ValueError):
                monthly_price = 0

            lbs_data.append({
                'id': lb.id,
                'name': lb.name,
                'load_balancer_type': lb.load_balancer_type.name if lb.load_balancer_type else None,
                'location': lb.location.name if lb.location else None,
                'public_net': {
                    'ipv4': lb.public_net.ipv4.ip if lb.public_net and lb.public_net.ipv4 else None,
                    'ipv6': lb.public_net.ipv6.ip if lb.public_net and lb.public_net.ipv6 else None,
                },
                'targets': len(lb.targets) if lb.targets else 0,
                'pricing': {
                    'monthly': monthly_price,
                },
            })

        return jsonify({'load_balancers': lbs_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/load-balancers/<int:lb_id>', methods=['DELETE'])
@require_token
def delete_load_balancer(client, lb_id):
    """Delete a load balancer"""
    try:
        lb = client.load_balancers.get_by_id(lb_id)

        if not lb:
            return jsonify({'error': 'Load balancer not found'}), 404

        client.load_balancers.delete(lb)

        return jsonify({
            'success': True,
            'message': 'Load balancer deleted successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/networks', methods=['GET'])
@require_token
def get_networks(client):
    """Get all networks"""
    try:
        networks = client.networks.get_all()
        networks_data = []

        for net in networks:
            networks_data.append({
                'id': net.id,
                'name': net.name,
                'ip_range': net.ip_range,
                'subnets': len(net.subnets) if net.subnets else 0,
                'servers': len(net.servers) if net.servers else 0,
            })

        return jsonify({'networks': networks_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/networks', methods=['POST'])
@require_token
def create_network(client):
    """Create a new network"""
    try:
        data = request.json

        name = data.get('name')
        ip_range = data.get('ip_range', '10.0.0.0/16')

        if not name:
            return jsonify({'error': 'Name is required'}), 400

        network = client.networks.create(
            name=name,
            ip_range=ip_range
        )

        return jsonify({
            'success': True,
            'network': {
                'id': network.network.id,
                'name': network.network.name,
                'ip_range': network.network.ip_range,
            },
            'message': 'Network created successfully'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/networks/<int:net_id>', methods=['DELETE'])
@require_token
def delete_network(client, net_id):
    """Delete a network"""
    try:
        net = client.networks.get_by_id(net_id)

        if not net:
            return jsonify({'error': 'Network not found'}), 404

        client.networks.delete(net)

        return jsonify({
            'success': True,
            'message': 'Network deleted successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== Storage Boxes API Endpoints (api.hetzner.com) =====

@app.route('/api/storage/test-token', methods=['POST'])
@require_storage_token
def test_storage_token(client):
    """Test if the provided Storage Boxes API token is valid"""
    return jsonify({'valid': True, 'message': 'Storage token is valid'})


@app.route('/api/storage/boxes', methods=['GET'])
@require_storage_token
def get_storage_boxes(client):
    """Get all storage boxes"""
    try:
        response = client.list_storage_boxes()
        boxes = response.get('storage_boxes', [])

        # Process and format storage box data
        boxes_data = []
        for box in boxes:
            # Calculate monthly price
            monthly_price = 0
            if box.get('storage_box_type') and box['storage_box_type'].get('prices'):
                prices = box['storage_box_type']['prices']
                if prices:
                    price_obj = prices[0]
                    monthly_price = float(price_obj.get('price_monthly', {}).get('gross', 0))

            boxes_data.append({
                'id': box.get('id'),
                'name': box.get('name'),
                'username': box.get('username'),
                'status': box.get('status'),
                'server': box.get('server'),
                'system': box.get('system'),
                'storage_box_type': {
                    'name': box['storage_box_type'].get('name') if box.get('storage_box_type') else None,
                    'size': box['storage_box_type'].get('size') if box.get('storage_box_type') else None,
                    'description': box['storage_box_type'].get('description') if box.get('storage_box_type') else None,
                },
                'location': {
                    'name': box['location'].get('name') if box.get('location') else None,
                    'city': box['location'].get('city') if box.get('location') else None,
                    'country': box['location'].get('country') if box.get('location') else None,
                },
                'stats': box.get('stats', {}),
                'access_settings': box.get('access_settings', {}),
                'protection': box.get('protection', {}),
                'snapshot_plan': box.get('snapshot_plan'),
                'labels': box.get('labels', {}),
                'created': box.get('created'),
                'pricing': {
                    'monthly': monthly_price,
                },
            })

        return jsonify({
            'storage_boxes': boxes_data,
            'meta': response.get('meta', {})
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>', methods=['GET'])
@require_storage_token
def get_storage_box(client, box_id):
    """Get details of a specific storage box"""
    try:
        response = client.get_storage_box(box_id)
        box = response.get('storage_box', {})

        return jsonify({'storage_box': box})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes', methods=['POST'])
@require_storage_token
def create_storage_box(client):
    """Create a new storage box"""
    try:
        data = request.json

        name = data.get('name')
        location = data.get('location')
        storage_box_type = data.get('storage_box_type')
        password = data.get('password')

        if not all([name, location, storage_box_type, password]):
            return jsonify({'error': 'Missing required fields'}), 400

        response = client.create_storage_box(
            name=name,
            location=location,
            storage_box_type=storage_box_type,
            password=password,
            labels=data.get('labels'),
            ssh_keys=data.get('ssh_keys'),
            access_settings=data.get('access_settings')
        )

        return jsonify({
            'success': True,
            'storage_box': response.get('storage_box'),
            'action': response.get('action'),
            'message': 'Storage box creation initiated'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>', methods=['PUT'])
@require_storage_token
def update_storage_box(client, box_id):
    """Update a storage box"""
    try:
        data = request.json

        response = client.update_storage_box(
            box_id=box_id,
            name=data.get('name'),
            labels=data.get('labels')
        )

        return jsonify({
            'success': True,
            'storage_box': response.get('storage_box'),
            'message': 'Storage box updated successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>', methods=['DELETE'])
@require_storage_token
def delete_storage_box(client, box_id):
    """Delete a storage box"""
    try:
        response = client.delete_storage_box(box_id)

        return jsonify({
            'success': True,
            'action': response.get('action'),
            'message': 'Storage box deletion initiated'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>/folders', methods=['GET'])
@require_storage_token
def get_storage_box_folders(client, box_id):
    """List folders in a storage box"""
    try:
        path = request.args.get('path', '.')
        response = client.list_folders(box_id, path)

        return jsonify(response)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>/actions/change_protection', methods=['POST'])
@require_storage_token
def change_storage_box_protection(client, box_id):
    """Change storage box protection settings"""
    try:
        data = request.json
        delete_protection = data.get('delete', False)

        response = client.change_protection(box_id, delete_protection)

        return jsonify({
            'success': True,
            'action': response.get('action'),
            'message': 'Protection settings updated'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>/actions/change_type', methods=['POST'])
@require_storage_token
def change_storage_box_type(client, box_id):
    """Change storage box type (upgrade/downgrade)"""
    try:
        data = request.json
        storage_box_type = data.get('storage_box_type')

        if not storage_box_type:
            return jsonify({'error': 'storage_box_type is required'}), 400

        response = client.change_type(box_id, storage_box_type)

        return jsonify({
            'success': True,
            'action': response.get('action'),
            'message': 'Storage box type change initiated'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>/actions/reset_password', methods=['POST'])
@require_storage_token
def reset_storage_box_password(client, box_id):
    """Reset storage box password"""
    try:
        data = request.json
        password = data.get('password')

        if not password:
            return jsonify({'error': 'password is required'}), 400

        response = client.reset_password(box_id, password)

        return jsonify({
            'success': True,
            'action': response.get('action'),
            'message': 'Password reset initiated'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>/actions/update_access_settings', methods=['POST'])
@require_storage_token
def update_storage_box_access_settings(client, box_id):
    """Update storage box access settings"""
    try:
        data = request.json

        response = client.update_access_settings(
            box_id=box_id,
            reachable_externally=data.get('reachable_externally'),
            samba_enabled=data.get('samba_enabled'),
            ssh_enabled=data.get('ssh_enabled'),
            webdav_enabled=data.get('webdav_enabled'),
            zfs_enabled=data.get('zfs_enabled')
        )

        return jsonify({
            'success': True,
            'action': response.get('action'),
            'message': 'Access settings updated'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>/actions/enable_snapshot_plan', methods=['POST'])
@require_storage_token
def enable_storage_box_snapshot_plan(client, box_id):
    """Enable snapshot plan for a storage box"""
    try:
        data = request.json

        max_snapshots = data.get('max_snapshots')
        minute = data.get('minute')
        hour = data.get('hour')

        if None in [max_snapshots, minute, hour]:
            return jsonify({'error': 'max_snapshots, minute, and hour are required'}), 400

        response = client.enable_snapshot_plan(
            box_id=box_id,
            max_snapshots=max_snapshots,
            minute=minute,
            hour=hour,
            day_of_week=data.get('day_of_week'),
            day_of_month=data.get('day_of_month')
        )

        return jsonify({
            'success': True,
            'action': response.get('action'),
            'message': 'Snapshot plan enabled'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>/actions/disable_snapshot_plan', methods=['POST'])
@require_storage_token
def disable_storage_box_snapshot_plan(client, box_id):
    """Disable snapshot plan for a storage box"""
    try:
        response = client.disable_snapshot_plan(box_id)

        return jsonify({
            'success': True,
            'action': response.get('action'),
            'message': 'Snapshot plan disabled'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Storage Box Subaccounts

@app.route('/api/storage/boxes/<int:box_id>/subaccounts', methods=['GET'])
@require_storage_token
def get_storage_box_subaccounts(client, box_id):
    """Get all subaccounts for a storage box"""
    try:
        response = client.list_subaccounts(box_id)

        return jsonify(response)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>/subaccounts/<int:subaccount_id>', methods=['GET'])
@require_storage_token
def get_storage_box_subaccount(client, box_id, subaccount_id):
    """Get details of a specific subaccount"""
    try:
        response = client.get_subaccount(box_id, subaccount_id)

        return jsonify(response)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>/subaccounts', methods=['POST'])
@require_storage_token
def create_storage_box_subaccount(client, box_id):
    """Create a new subaccount for a storage box"""
    try:
        data = request.json

        home_directory = data.get('home_directory')
        password = data.get('password')

        if not all([home_directory, password]):
            return jsonify({'error': 'home_directory and password are required'}), 400

        response = client.create_subaccount(
            box_id=box_id,
            home_directory=home_directory,
            password=password,
            description=data.get('description'),
            labels=data.get('labels'),
            access_settings=data.get('access_settings')
        )

        return jsonify({
            'success': True,
            'subaccount': response.get('subaccount'),
            'action': response.get('action'),
            'message': 'Subaccount creation initiated'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>/subaccounts/<int:subaccount_id>', methods=['PUT'])
@require_storage_token
def update_storage_box_subaccount(client, box_id, subaccount_id):
    """Update a subaccount"""
    try:
        data = request.json

        response = client.update_subaccount(
            box_id=box_id,
            subaccount_id=subaccount_id,
            description=data.get('description'),
            labels=data.get('labels')
        )

        return jsonify({
            'success': True,
            'subaccount': response.get('subaccount'),
            'message': 'Subaccount updated successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>/subaccounts/<int:subaccount_id>', methods=['DELETE'])
@require_storage_token
def delete_storage_box_subaccount(client, box_id, subaccount_id):
    """Delete a subaccount"""
    try:
        response = client.delete_subaccount(box_id, subaccount_id)

        return jsonify({
            'success': True,
            'action': response.get('action'),
            'message': 'Subaccount deletion initiated'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>/subaccounts/<int:subaccount_id>/actions/reset_password', methods=['POST'])
@require_storage_token
def reset_subaccount_password(client, box_id, subaccount_id):
    """Reset subaccount password"""
    try:
        data = request.json
        password = data.get('password')

        if not password:
            return jsonify({'error': 'password is required'}), 400

        response = client.reset_subaccount_password(box_id, subaccount_id, password)

        return jsonify({
            'success': True,
            'action': response.get('action'),
            'message': 'Subaccount password reset initiated'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage/boxes/<int:box_id>/subaccounts/<int:subaccount_id>/actions/update_access_settings', methods=['POST'])
@require_storage_token
def update_subaccount_access_settings(client, box_id, subaccount_id):
    """Update subaccount access settings"""
    try:
        data = request.json

        response = client.update_subaccount_access_settings(
            box_id=box_id,
            subaccount_id=subaccount_id,
            reachable_externally=data.get('reachable_externally'),
            samba_enabled=data.get('samba_enabled'),
            ssh_enabled=data.get('ssh_enabled'),
            webdav_enabled=data.get('webdav_enabled'),
            readonly=data.get('readonly')
        )

        return jsonify({
            'success': True,
            'action': response.get('action'),
            'message': 'Subaccount access settings updated'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)
