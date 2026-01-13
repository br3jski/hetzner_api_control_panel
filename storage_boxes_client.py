"""
Client for Hetzner Storage Boxes API (api.hetzner.com)
This is a separate API from the Cloud API (api.hetzner.cloud)
"""

import requests
from typing import Optional, Dict, List, Any


class StorageBoxesClient:
    """Client for interacting with Hetzner Storage Boxes API"""

    BASE_URL = "https://api.hetzner.com/v1"

    def __init__(self, api_token: str):
        """
        Initialize the Storage Boxes client

        Args:
            api_token: Hetzner Storage Boxes API token
        """
        self.api_token = api_token
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }

    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Make an HTTP request to the Storage Boxes API

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint (e.g., '/storage_boxes')
            data: Request body data
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
            headers=self.headers,
            json=data,
            params=params
        )

        response.raise_for_status()
        return response.json()

    # Storage Boxes Operations

    def list_storage_boxes(self, name: Optional[str] = None, label_selector: Optional[str] = None,
                          page: int = 1, per_page: int = 25) -> Dict[str, Any]:
        """
        List all storage boxes

        Args:
            name: Filter by exact name
            label_selector: Filter by label selector
            page: Page number
            per_page: Items per page

        Returns:
            Dict with storage_boxes list and metadata
        """
        params = {"page": page, "per_page": per_page}
        if name:
            params["name"] = name
        if label_selector:
            params["label_selector"] = label_selector

        return self._make_request("GET", "/storage_boxes", params=params)

    def get_storage_box(self, box_id: int) -> Dict[str, Any]:
        """
        Get a specific storage box

        Args:
            box_id: Storage box ID

        Returns:
            Storage box details
        """
        return self._make_request("GET", f"/storage_boxes/{box_id}")

    def create_storage_box(self, name: str, location: str, storage_box_type: str,
                          password: str, labels: Optional[Dict[str, str]] = None,
                          ssh_keys: Optional[List[str]] = None,
                          access_settings: Optional[Dict[str, bool]] = None) -> Dict[str, Any]:
        """
        Create a new storage box

        Args:
            name: Name of the storage box
            location: Location ID or name (e.g., 'fsn1')
            storage_box_type: Storage box type ID or name (e.g., 'bx20')
            password: Password for the storage box
            labels: Optional labels
            ssh_keys: Optional SSH public keys
            access_settings: Optional access settings

        Returns:
            Created storage box and action details
        """
        data = {
            "name": name,
            "location": location,
            "storage_box_type": storage_box_type,
            "password": password
        }

        if labels:
            data["labels"] = labels
        if ssh_keys:
            data["ssh_keys"] = ssh_keys
        if access_settings:
            data["access_settings"] = access_settings

        return self._make_request("POST", "/storage_boxes", data=data)

    def update_storage_box(self, box_id: int, name: Optional[str] = None,
                          labels: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Update a storage box

        Args:
            box_id: Storage box ID
            name: New name
            labels: New labels (replaces existing)

        Returns:
            Updated storage box details
        """
        data = {}
        if name:
            data["name"] = name
        if labels is not None:
            data["labels"] = labels

        return self._make_request("PUT", f"/storage_boxes/{box_id}", data=data)

    def delete_storage_box(self, box_id: int) -> Dict[str, Any]:
        """
        Delete a storage box

        Args:
            box_id: Storage box ID

        Returns:
            Action details
        """
        return self._make_request("DELETE", f"/storage_boxes/{box_id}")

    def list_folders(self, box_id: int, path: str = ".") -> Dict[str, Any]:
        """
        List folders in a storage box

        Args:
            box_id: Storage box ID
            path: Relative path (default: ".")

        Returns:
            List of folders
        """
        params = {"path": path}
        return self._make_request("GET", f"/storage_boxes/{box_id}/folders", params=params)

    # Storage Box Actions

    def change_protection(self, box_id: int, delete: bool) -> Dict[str, Any]:
        """
        Change protection settings

        Args:
            box_id: Storage box ID
            delete: Enable/disable delete protection

        Returns:
            Action details
        """
        data = {"delete": delete}
        return self._make_request("POST", f"/storage_boxes/{box_id}/actions/change_protection", data=data)

    def change_type(self, box_id: int, storage_box_type: str) -> Dict[str, Any]:
        """
        Change storage box type (upgrade/downgrade)

        Args:
            box_id: Storage box ID
            storage_box_type: New storage box type ID or name

        Returns:
            Action details
        """
        data = {"storage_box_type": storage_box_type}
        return self._make_request("POST", f"/storage_boxes/{box_id}/actions/change_type", data=data)

    def reset_password(self, box_id: int, password: str) -> Dict[str, Any]:
        """
        Reset storage box password

        Args:
            box_id: Storage box ID
            password: New password

        Returns:
            Action details
        """
        data = {"password": password}
        return self._make_request("POST", f"/storage_boxes/{box_id}/actions/reset_password", data=data)

    def update_access_settings(self, box_id: int, reachable_externally: Optional[bool] = None,
                              samba_enabled: Optional[bool] = None, ssh_enabled: Optional[bool] = None,
                              webdav_enabled: Optional[bool] = None, zfs_enabled: Optional[bool] = None) -> Dict[str, Any]:
        """
        Update access settings

        Args:
            box_id: Storage box ID
            reachable_externally: External access allowed
            samba_enabled: Samba subsystem enabled
            ssh_enabled: SSH subsystem enabled
            webdav_enabled: WebDAV subsystem enabled
            zfs_enabled: ZFS snapshot folder visible

        Returns:
            Action details
        """
        data = {}
        if reachable_externally is not None:
            data["reachable_externally"] = reachable_externally
        if samba_enabled is not None:
            data["samba_enabled"] = samba_enabled
        if ssh_enabled is not None:
            data["ssh_enabled"] = ssh_enabled
        if webdav_enabled is not None:
            data["webdav_enabled"] = webdav_enabled
        if zfs_enabled is not None:
            data["zfs_enabled"] = zfs_enabled

        return self._make_request("POST", f"/storage_boxes/{box_id}/actions/update_access_settings", data=data)

    def enable_snapshot_plan(self, box_id: int, max_snapshots: int, minute: int, hour: int,
                            day_of_week: Optional[int] = None, day_of_month: Optional[int] = None) -> Dict[str, Any]:
        """
        Enable snapshot plan

        Args:
            box_id: Storage box ID
            max_snapshots: Maximum number of snapshots to keep
            minute: Minute when to execute (0-59)
            hour: Hour when to execute (0-23)
            day_of_week: Day of week (1=Monday to 7=Sunday, null=every day)
            day_of_month: Day of month (1-31, null=every day)

        Returns:
            Action details
        """
        data = {
            "max_snapshots": max_snapshots,
            "minute": minute,
            "hour": hour,
            "day_of_week": day_of_week,
            "day_of_month": day_of_month
        }
        return self._make_request("POST", f"/storage_boxes/{box_id}/actions/enable_snapshot_plan", data=data)

    def disable_snapshot_plan(self, box_id: int) -> Dict[str, Any]:
        """
        Disable snapshot plan

        Args:
            box_id: Storage box ID

        Returns:
            Action details
        """
        return self._make_request("POST", f"/storage_boxes/{box_id}/actions/disable_snapshot_plan")

    # Subaccounts Operations

    def list_subaccounts(self, box_id: int, username: Optional[str] = None,
                        label_selector: Optional[str] = None) -> Dict[str, Any]:
        """
        List subaccounts for a storage box

        Args:
            box_id: Storage box ID
            username: Filter by username
            label_selector: Filter by label selector

        Returns:
            List of subaccounts
        """
        params = {}
        if username:
            params["username"] = username
        if label_selector:
            params["label_selector"] = label_selector

        return self._make_request("GET", f"/storage_boxes/{box_id}/subaccounts", params=params)

    def get_subaccount(self, box_id: int, subaccount_id: int) -> Dict[str, Any]:
        """
        Get a specific subaccount

        Args:
            box_id: Storage box ID
            subaccount_id: Subaccount ID

        Returns:
            Subaccount details
        """
        return self._make_request("GET", f"/storage_boxes/{box_id}/subaccounts/{subaccount_id}")

    def create_subaccount(self, box_id: int, home_directory: str, password: str,
                         description: Optional[str] = None, labels: Optional[Dict[str, str]] = None,
                         access_settings: Optional[Dict[str, bool]] = None) -> Dict[str, Any]:
        """
        Create a subaccount

        Args:
            box_id: Storage box ID
            home_directory: Home directory for the subaccount
            password: Password for the subaccount
            description: Optional description
            labels: Optional labels
            access_settings: Optional access settings

        Returns:
            Created subaccount and action details
        """
        data = {
            "home_directory": home_directory,
            "password": password
        }

        if description:
            data["description"] = description
        if labels:
            data["labels"] = labels
        if access_settings:
            data["access_settings"] = access_settings

        return self._make_request("POST", f"/storage_boxes/{box_id}/subaccounts", data=data)

    def update_subaccount(self, box_id: int, subaccount_id: int, description: Optional[str] = None,
                         labels: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Update a subaccount

        Args:
            box_id: Storage box ID
            subaccount_id: Subaccount ID
            description: New description
            labels: New labels (replaces existing)

        Returns:
            Updated subaccount details
        """
        data = {}
        if description:
            data["description"] = description
        if labels is not None:
            data["labels"] = labels

        return self._make_request("PUT", f"/storage_boxes/{box_id}/subaccounts/{subaccount_id}", data=data)

    def delete_subaccount(self, box_id: int, subaccount_id: int) -> Dict[str, Any]:
        """
        Delete a subaccount

        Args:
            box_id: Storage box ID
            subaccount_id: Subaccount ID

        Returns:
            Action details
        """
        return self._make_request("DELETE", f"/storage_boxes/{box_id}/subaccounts/{subaccount_id}")

    def change_subaccount_home_directory(self, box_id: int, subaccount_id: int, home_directory: str) -> Dict[str, Any]:
        """
        Change subaccount home directory

        Args:
            box_id: Storage box ID
            subaccount_id: Subaccount ID
            home_directory: New home directory

        Returns:
            Action details
        """
        data = {"home_directory": home_directory}
        return self._make_request("POST", f"/storage_boxes/{box_id}/subaccounts/{subaccount_id}/actions/change_home_directory", data=data)

    def reset_subaccount_password(self, box_id: int, subaccount_id: int, password: str) -> Dict[str, Any]:
        """
        Reset subaccount password

        Args:
            box_id: Storage box ID
            subaccount_id: Subaccount ID
            password: New password

        Returns:
            Action details
        """
        data = {"password": password}
        return self._make_request("POST", f"/storage_boxes/{box_id}/subaccounts/{subaccount_id}/actions/reset_subaccount_password", data=data)

    def update_subaccount_access_settings(self, box_id: int, subaccount_id: int,
                                         reachable_externally: Optional[bool] = None,
                                         samba_enabled: Optional[bool] = None,
                                         ssh_enabled: Optional[bool] = None,
                                         webdav_enabled: Optional[bool] = None,
                                         readonly: Optional[bool] = None) -> Dict[str, Any]:
        """
        Update subaccount access settings

        Args:
            box_id: Storage box ID
            subaccount_id: Subaccount ID
            reachable_externally: External access allowed
            samba_enabled: Samba subsystem enabled
            ssh_enabled: SSH subsystem enabled
            webdav_enabled: WebDAV subsystem enabled
            readonly: Read-only access

        Returns:
            Action details
        """
        data = {}
        if reachable_externally is not None:
            data["reachable_externally"] = reachable_externally
        if samba_enabled is not None:
            data["samba_enabled"] = samba_enabled
        if ssh_enabled is not None:
            data["ssh_enabled"] = ssh_enabled
        if webdav_enabled is not None:
            data["webdav_enabled"] = webdav_enabled
        if readonly is not None:
            data["readonly"] = readonly

        return self._make_request("POST", f"/storage_boxes/{box_id}/subaccounts/{subaccount_id}/actions/update_access_settings", data=data)

    # Actions Operations

    def list_actions(self, page: int = 1, per_page: int = 25,
                    action_id: Optional[List[int]] = None,
                    status: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        List all actions

        Args:
            page: Page number
            per_page: Items per page
            action_id: Filter by action IDs
            status: Filter by status (running, success, error)

        Returns:
            List of actions and metadata
        """
        params = {"page": page, "per_page": per_page}
        if action_id:
            params["id"] = action_id
        if status:
            params["status"] = status

        return self._make_request("GET", "/storage_boxes/actions", params=params)

    def get_action(self, action_id: int) -> Dict[str, Any]:
        """
        Get a specific action

        Args:
            action_id: Action ID

        Returns:
            Action details
        """
        return self._make_request("GET", f"/storage_boxes/actions/{action_id}")

    def list_box_actions(self, box_id: int, page: int = 1, per_page: int = 25,
                        status: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        List actions for a storage box

        Args:
            box_id: Storage box ID
            page: Page number
            per_page: Items per page
            status: Filter by status

        Returns:
            List of actions and metadata
        """
        params = {"page": page, "per_page": per_page}
        if status:
            params["status"] = status

        return self._make_request("GET", f"/storage_boxes/{box_id}/actions", params=params)

    def get_box_action(self, box_id: int, action_id: int) -> Dict[str, Any]:
        """
        Get a specific action for a storage box

        Args:
            box_id: Storage box ID
            action_id: Action ID

        Returns:
            Action details
        """
        return self._make_request("GET", f"/storage_boxes/{box_id}/actions/{action_id}")
