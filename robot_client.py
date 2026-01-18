"""
Client for Hetzner Robot API (robot-ws.your-server.de)
This API manages dedicated servers (bare metal), not cloud resources
"""

import requests
from typing import Optional, Dict, List, Any
from requests.auth import HTTPBasicAuth


class RobotClient:
    """Client for interacting with Hetzner Robot API"""

    BASE_URL = "https://robot-ws.your-server.de"

    def __init__(self, username: str, password: str):
        """
        Initialize the Robot client

        Args:
            username: Robot webservice username
            password: Robot webservice password
        """
        self.auth = HTTPBasicAuth(username, password)
        self.headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }

    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None,
                     params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Make an HTTP request to the Robot API

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint (e.g., '/server')
            data: Form data for POST/PUT
            params: URL query parameters

        Returns:
            Response data as dictionary

        Raises:
            requests.exceptions.HTTPError: If the request fails
        """
        url = f"{self.BASE_URL}{endpoint}"

        response = requests.request(
            method=method,
            url=url,
            auth=self.auth,
            headers=self.headers if method in ['POST', 'PUT'] else {},
            data=data,
            params=params
        )

        response.raise_for_status()
        return response.json()

    # Server Operations

    def list_servers(self) -> List[Dict[str, Any]]:
        """
        List all dedicated servers

        Returns:
            List of servers
        """
        return self._make_request("GET", "/server")

    def get_server(self, server_number: int) -> Dict[str, Any]:
        """
        Get details of a specific server

        Args:
            server_number: Server ID

        Returns:
            Server details
        """
        return self._make_request("GET", f"/server/{server_number}")

    def update_server_name(self, server_number: int, server_name: str) -> Dict[str, Any]:
        """
        Update server name

        Args:
            server_number: Server ID
            server_name: New server name

        Returns:
            Updated server details
        """
        return self._make_request("POST", f"/server/{server_number}",
                                 data={"server_name": server_name})

    # Server Cancellation

    def get_server_cancellation(self, server_number: int) -> Dict[str, Any]:
        """
        Get cancellation info for a server

        Args:
            server_number: Server ID

        Returns:
            Cancellation details
        """
        return self._make_request("GET", f"/server/{server_number}/cancellation")

    def cancel_server(self, server_number: int, cancellation_date: str,
                     cancellation_reason: Optional[str] = None,
                     reserve_location: Optional[bool] = None) -> Dict[str, Any]:
        """
        Cancel a server

        Args:
            server_number: Server ID
            cancellation_date: Date (YYYY-MM-DD) or "now"
            cancellation_reason: Optional reason
            reserve_location: Whether to reserve location

        Returns:
            Cancellation details
        """
        data = {"cancellation_date": cancellation_date}
        if cancellation_reason:
            data["cancellation_reason"] = cancellation_reason
        if reserve_location is not None:
            data["reserve_location"] = "true" if reserve_location else "false"

        return self._make_request("POST", f"/server/{server_number}/cancellation", data=data)

    def revoke_server_cancellation(self, server_number: int) -> None:
        """
        Revoke server cancellation

        Args:
            server_number: Server ID
        """
        self._make_request("DELETE", f"/server/{server_number}/cancellation")

    # IP Operations

    def list_ips(self, server_ip: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List all single IP addresses

        Args:
            server_ip: Optional filter by server IP

        Returns:
            List of IPs
        """
        params = {"server_ip": server_ip} if server_ip else None
        return self._make_request("GET", "/ip", params=params)

    def get_ip(self, ip: str) -> Dict[str, Any]:
        """
        Get details of a specific IP

        Args:
            ip: IP address

        Returns:
            IP details
        """
        return self._make_request("GET", f"/ip/{ip}")

    def update_ip_traffic_warnings(self, ip: str, traffic_warnings: bool,
                                   traffic_hourly: Optional[int] = None,
                                   traffic_daily: Optional[int] = None,
                                   traffic_monthly: Optional[int] = None) -> Dict[str, Any]:
        """
        Update IP traffic warnings

        Args:
            ip: IP address
            traffic_warnings: Enable/disable warnings
            traffic_hourly: Hourly limit in MB
            traffic_daily: Daily limit in MB
            traffic_monthly: Monthly limit in GB

        Returns:
            Updated IP details
        """
        data = {"traffic_warnings": "true" if traffic_warnings else "false"}
        if traffic_hourly is not None:
            data["traffic_hourly"] = str(traffic_hourly)
        if traffic_daily is not None:
            data["traffic_daily"] = str(traffic_daily)
        if traffic_monthly is not None:
            data["traffic_monthly"] = str(traffic_monthly)

        return self._make_request("POST", f"/ip/{ip}", data=data)

    def get_ip_mac(self, ip: str) -> Dict[str, Any]:
        """
        Get MAC address for IP

        Args:
            ip: IP address

        Returns:
            MAC address details
        """
        return self._make_request("GET", f"/ip/{ip}/mac")

    def set_ip_mac(self, ip: str) -> Dict[str, Any]:
        """
        Generate separate MAC address for IP

        Args:
            ip: IP address

        Returns:
            MAC address details
        """
        return self._make_request("PUT", f"/ip/{ip}/mac")

    def delete_ip_mac(self, ip: str) -> Dict[str, Any]:
        """
        Remove separate MAC address

        Args:
            ip: IP address

        Returns:
            MAC address details
        """
        return self._make_request("DELETE", f"/ip/{ip}/mac")

    # Subnet Operations

    def list_subnets(self, server_ip: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List all subnets

        Args:
            server_ip: Optional filter by server IP

        Returns:
            List of subnets
        """
        params = {"server_ip": server_ip} if server_ip else None
        return self._make_request("GET", "/subnet", params=params)

    def get_subnet(self, net_ip: str) -> Dict[str, Any]:
        """
        Get subnet details

        Args:
            net_ip: Subnet IP

        Returns:
            Subnet details
        """
        return self._make_request("GET", f"/subnet/{net_ip}")

    # Reset Operations

    def list_reset_options(self) -> List[Dict[str, Any]]:
        """
        List reset options for all servers

        Returns:
            List of reset options
        """
        return self._make_request("GET", "/reset")

    def get_reset_options(self, server_number: int) -> Dict[str, Any]:
        """
        Get reset options for a server

        Args:
            server_number: Server ID

        Returns:
            Reset options
        """
        return self._make_request("GET", f"/reset/{server_number}")

    def execute_reset(self, server_number: int, reset_type: str) -> Dict[str, Any]:
        """
        Execute reset on server

        Args:
            server_number: Server ID
            reset_type: Reset type (sw, hw, man, power, power_long)

        Returns:
            Reset details
        """
        return self._make_request("POST", f"/reset/{server_number}",
                                 data={"type": reset_type})

    # Failover Operations

    def list_failover(self) -> List[Dict[str, Any]]:
        """
        List all failover IPs

        Returns:
            List of failover IPs
        """
        return self._make_request("GET", "/failover")

    def get_failover(self, failover_ip: str) -> Dict[str, Any]:
        """
        Get failover IP details

        Args:
            failover_ip: Failover IP address

        Returns:
            Failover details
        """
        return self._make_request("GET", f"/failover/{failover_ip}")

    def switch_failover(self, failover_ip: str, active_server_ip: str) -> Dict[str, Any]:
        """
        Switch failover IP to another server

        Args:
            failover_ip: Failover IP address
            active_server_ip: Target server IP

        Returns:
            Failover details
        """
        return self._make_request("POST", f"/failover/{failover_ip}",
                                 data={"active_server_ip": active_server_ip})

    def delete_failover_routing(self, failover_ip: str) -> Dict[str, Any]:
        """
        Delete failover IP routing

        Args:
            failover_ip: Failover IP address

        Returns:
            Failover details
        """
        return self._make_request("DELETE", f"/failover/{failover_ip}")

    # Wake on LAN

    def get_wol(self, server_number: int) -> Dict[str, Any]:
        """
        Get Wake on LAN info

        Args:
            server_number: Server ID

        Returns:
            WoL details
        """
        return self._make_request("GET", f"/wol/{server_number}")

    def send_wol(self, server_number: int) -> Dict[str, Any]:
        """
        Send Wake on LAN packet

        Args:
            server_number: Server ID

        Returns:
            WoL details
        """
        return self._make_request("POST", f"/wol/{server_number}", data={})

    # Boot Configuration

    def get_boot_config(self, server_number: int) -> Dict[str, Any]:
        """
        Get boot configuration

        Args:
            server_number: Server ID

        Returns:
            Boot configuration
        """
        return self._make_request("GET", f"/boot/{server_number}")

    def get_rescue_config(self, server_number: int) -> Dict[str, Any]:
        """
        Get rescue system configuration

        Args:
            server_number: Server ID

        Returns:
            Rescue config
        """
        return self._make_request("GET", f"/boot/{server_number}/rescue")

    def activate_rescue(self, server_number: int, os: str = "linux",
                       authorized_keys: Optional[List[str]] = None,
                       keyboard: str = "us") -> Dict[str, Any]:
        """
        Activate rescue system

        Args:
            server_number: Server ID
            os: Operating system (linux, vkvm)
            authorized_keys: SSH key fingerprints
            keyboard: Keyboard layout

        Returns:
            Rescue activation details
        """
        data = {"os": os, "keyboard": keyboard}
        if authorized_keys:
            for i, key in enumerate(authorized_keys):
                data[f"authorized_key[{i}]"] = key

        return self._make_request("POST", f"/boot/{server_number}/rescue", data=data)

    def deactivate_rescue(self, server_number: int) -> None:
        """
        Deactivate rescue system

        Args:
            server_number: Server ID
        """
        self._make_request("DELETE", f"/boot/{server_number}/rescue")

    # Reverse DNS

    def get_rdns(self, ip: str) -> Dict[str, Any]:
        """
        Get reverse DNS for IP

        Args:
            ip: IP address

        Returns:
            rDNS details
        """
        return self._make_request("GET", f"/rdns/{ip}")

    def set_rdns(self, ip: str, ptr: str) -> Dict[str, Any]:
        """
        Set reverse DNS

        Args:
            ip: IP address
            ptr: PTR record

        Returns:
            rDNS details
        """
        return self._make_request("PUT", f"/rdns/{ip}", data={"ptr": ptr})

    def delete_rdns(self, ip: str) -> Dict[str, Any]:
        """
        Delete reverse DNS

        Args:
            ip: IP address

        Returns:
            rDNS details
        """
        return self._make_request("DELETE", f"/rdns/{ip}")

    # Traffic

    def get_traffic(self, server_number: int, type: str = "day",
                   from_date: Optional[str] = None, to_date: Optional[str] = None) -> Dict[str, Any]:
        """
        Get traffic statistics

        Args:
            server_number: Server ID
            type: Type (day, month, year)
            from_date: Start date (YYYY-MM-DD)
            to_date: End date (YYYY-MM-DD)

        Returns:
            Traffic statistics
        """
        params = {"type": type}
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date

        return self._make_request("GET", f"/traffic/{server_number}", params=params)
