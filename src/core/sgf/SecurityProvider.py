"""
SecurityProvider.py

Provides security and access control for the Knowledge Graph in enterprise deployments.
This component enables role-based access control, entity-level permissions, and audit logging.
"""

import os
import json
import datetime
from typing import Dict, Any, List, Optional, Set

from knowledge_graph_schema import Entity

class SecurityProvider:
    """
    Provides security and access control for Knowledge Graph operations.
    
    This class manages access control lists (ACLs), enforces permissions,
    and provides audit logging for enterprise deployments.
    """
    
    def __init__(self, acl_store_path: Optional[str] = None):
        """
        Initializes the SecurityProvider.
        
        Args:
            acl_store_path (Optional[str]): Path to the ACL store file.
                                           If None, a default path is used.
        """
        self.acl_store_path = acl_store_path or os.path.join(
            os.path.dirname(os.path.abspath(__file__)), 
            "data", 
            "acl_store.json"
        )
        
        # Initialize ACL store
        self.acl_store = self._load_acl_store()
        
        # Initialize audit log
        self.audit_log = []
        
        # Set default permissions
        self._set_default_permissions()
        
        print(f"SecurityProvider initialized with ACL store at {self.acl_store_path}")
    
    def _load_acl_store(self) -> Dict[str, Any]:
        """
        Loads the ACL store from disk.
        
        Returns:
            Dict[str, Any]: The ACL store.
        """
        try:
            if os.path.exists(self.acl_store_path):
                with open(self.acl_store_path, 'r') as f:
                    return json.load(f)
            else:
                print(f"ACL store file not found, initializing with default permissions")
                return self._initialize_acl_store()
        except Exception as e:
            print(f"Error loading ACL store: {e}")
            return self._initialize_acl_store()
    
    def _initialize_acl_store(self) -> Dict[str, Any]:
        """
        Initializes a new ACL store with default structure.
        
        Returns:
            Dict[str, Any]: The initialized ACL store.
        """
        acl_store = {
            "operations": {},
            "entity_types": {},
            "relationship_types": {},
            "users": {}
        }
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(self.acl_store_path), exist_ok=True)
        
        # Save to disk
        with open(self.acl_store_path, 'w') as f:
            json.dump(acl_store, f, indent=2)
        
        return acl_store
    
    def _save_acl_store(self) -> None:
        """
        Saves the ACL store to disk.
        """
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.acl_store_path), exist_ok=True)
            
            # Save to disk
            with open(self.acl_store_path, 'w') as f:
                json.dump(self.acl_store, f, indent=2)
            
            print(f"Saved ACL store to {self.acl_store_path}")
        except Exception as e:
            print(f"Error saving ACL store: {e}")
    
    def _set_default_permissions(self) -> None:
        """
        Sets default permissions for common operations and roles.
        """
        # Define default operations
        default_operations = {
            "read_entity": {
                "roles": {
                    "admin": True,
                    "editor": True,
                    "viewer": True
                }
            },
            "write_entity": {
                "roles": {
                    "admin": True,
                    "editor": True,
                    "viewer": False
                }
            },
            "delete_entity": {
                "roles": {
                    "admin": True,
                    "editor": False,
                    "viewer": False
                }
            },
            "read_relationship": {
                "roles": {
                    "admin": True,
                    "editor": True,
                    "viewer": True
                }
            },
            "write_relationship": {
                "roles": {
                    "admin": True,
                    "editor": True,
                    "viewer": False
                }
            },
            "delete_relationship": {
                "roles": {
                    "admin": True,
                    "editor": False,
                    "viewer": False
                }
            },
            "read_pattern": {
                "roles": {
                    "admin": True,
                    "editor": True,
                    "viewer": True
                }
            }
        }
        
        # Set default operations if not already set
        for operation, permissions in default_operations.items():
            if operation not in self.acl_store.get("operations", {}):
                if "operations" not in self.acl_store:
                    self.acl_store["operations"] = {}
                self.acl_store["operations"][operation] = permissions
        
        # Save changes
        self._save_acl_store()
    
    def can_access(self, user_context: Dict[str, Any], operation: str) -> bool:
        """
        Checks if a user has permission to perform an operation.
        
        Args:
            user_context (Dict[str, Any]): Context containing user ID, role, and other information.
            operation (str): The operation to check permission for.
            
        Returns:
            bool: True if the user has permission, False otherwise.
        """
        user_id = user_context.get("user_id")
        role = user_context.get("role", "viewer")  # Default to viewer role
        
        # Check user-specific permissions first
        if user_id and "users" in self.acl_store and user_id in self.acl_store["users"]:
            user_permissions = self.acl_store["users"][user_id]
            if operation in user_permissions:
                return user_permissions[operation]
        
        # Check role-based permissions
        if "operations" in self.acl_store and operation in self.acl_store["operations"]:
            operation_permissions = self.acl_store["operations"][operation]
            if "roles" in operation_permissions and role in operation_permissions["roles"]:
                return operation_permissions["roles"][role]
        
        # Default deny
        return False
    
    def can_access_entity_type(self, user_context: Dict[str, Any], entity_type: str) -> bool:
        """
        Checks if a user has permission to access an entity type.
        
        Args:
            user_context (Dict[str, Any]): Context containing user ID, role, and other information.
            entity_type (str): The entity type to check permission for.
            
        Returns:
            bool: True if the user has permission, False otherwise.
        """
        user_id = user_context.get("user_id")
        role = user_context.get("role", "viewer")  # Default to viewer role
        
        # Check if entity type has specific permissions
        if "entity_types" in self.acl_store and entity_type in self.acl_store["entity_types"]:
            entity_type_permissions = self.acl_store["entity_types"][entity_type]
            
            # Check user-specific permissions first
            if user_id and "users" in entity_type_permissions and user_id in entity_type_permissions["users"]:
                return entity_type_permissions["users"][user_id]
            
            # Check role-based permissions
            if "roles" in entity_type_permissions and role in entity_type_permissions["roles"]:
                return entity_type_permissions["roles"][role]
        
        # If no specific permissions for this entity type, allow access by default
        return True
    
    def can_access_relationship_type(self, user_context: Dict[str, Any], relationship_type: str) -> bool:
        """
        Checks if a user has permission to access a relationship type.
        
        Args:
            user_context (Dict[str, Any]): Context containing user ID, role, and other information.
            relationship_type (str): The relationship type to check permission for.
            
        Returns:
            bool: True if the user has permission, False otherwise.
        """
        user_id = user_context.get("user_id")
        role = user_context.get("role", "viewer")  # Default to viewer role
        
        # Check if relationship type has specific permissions
        if "relationship_types" in self.acl_store and relationship_type in self.acl_store["relationship_types"]:
            relationship_type_permissions = self.acl_store["relationship_types"][relationship_type]
            
            # Check user-specific permissions first
            if user_id and "users" in relationship_type_permissions and user_id in relationship_type_permissions["users"]:
                return relationship_type_permissions["users"][user_id]
            
            # Check role-based permissions
            if "roles" in relationship_type_permissions and role in relationship_type_permissions["roles"]:
                return relationship_type_permissions["roles"][role]
        
        # If no specific permissions for this relationship type, allow access by default
        return True
    
    def filter_entity_for_user(self, user_context: Dict[str, Any], entity: Entity) -> Optional[Entity]:
        """
        Filters an entity based on user permissions.
        
        Args:
            user_context (Dict[str, Any]): Context containing user ID, role, and other information.
            entity (Entity): The entity to filter.
            
        Returns:
            Optional[Entity]: The filtered entity, or None if the user doesn't have permission.
        """
        # Check if user has permission to access this entity type
        if entity and entity.type and not self.can_access_entity_type(user_context, entity.type.value):
            return None
        
        # If user has permission, return the entity
        return entity
    
    def create_audit_log(self, user_context: Dict[str, Any], action: str, details: Dict[str, Any] = None) -> None:
        """
        Creates an audit log entry.
        
        Args:
            user_context (Dict[str, Any]): Context containing user ID, role, and other information.
            action (str): The action being performed.
            details (Dict[str, Any], optional): Additional details about the action.
        """
        log_entry = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "user_id": user_context.get("user_id"),
            "role": user_context.get("role"),
            "tenant_id": user_context.get("tenant_id"),
            "action": action,
            "details": details or {}
        }
        
        self.audit_log.append(log_entry)
        
        # TODO: Implement persistent audit logging
    
    def get_audit_logs(self, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Retrieves audit logs, optionally filtered.
        
        Args:
            filters (Dict[str, Any], optional): Filters to apply to the logs.
            
        Returns:
            List[Dict[str, Any]]: The filtered audit logs.
        """
        if not filters:
            return self.audit_log
        
        filtered_logs = []
        for log in self.audit_log:
            match = True
            for key, value in filters.items():
                if key not in log or log[key] != value:
                    match = False
                    break
            
            if match:
                filtered_logs.append(log)
        
        return filtered_logs
    
    def set_operation_permission(self, operation: str, role: str, allowed: bool) -> bool:
        """
        Sets permission for an operation and role.
        
        Args:
            operation (str): The operation to set permission for.
            role (str): The role to set permission for.
            allowed (bool): Whether access is allowed.
            
        Returns:
            bool: True if the permission was set, False otherwise.
        """
        if "operations" not in self.acl_store:
            self.acl_store["operations"] = {}
            
        if operation not in self.acl_store["operations"]:
            self.acl_store["operations"][operation] = {"roles": {}}
            
        self.acl_store["operations"][operation]["roles"][role] = allowed
        self._save_acl_store()
        
        print(f"Set permission for role {role} to perform operation {operation}: {allowed}")
        return True
    
    def set_user_operation_permission(self, operation: str, user_id: str, allowed: bool) -> bool:
        """
        Sets permission for an operation and specific user.
        
        Args:
            operation (str): The operation to set permission for.
            user_id (str): The user ID to set permission for.
            allowed (bool): Whether access is allowed.
            
        Returns:
            bool: True if the permission was set, False otherwise.
        """
        if "users" not in self.acl_store:
            self.acl_store["users"] = {}
            
        if user_id not in self.acl_store["users"]:
            self.acl_store["users"][user_id] = {}
            
        self.acl_store["users"][user_id][operation] = allowed
        self._save_acl_store()
        
        print(f"Set permission for user {user_id} to perform operation {operation}: {allowed}")
        return True
    
    def set_entity_type_permission(self, entity_type: str, role: str, allowed: bool) -> bool:
        """
        Sets permission for a specific entity type and role.
        
        Args:
            entity_type (str): The entity type to set permission for.
            role (str): The role to set permission for.
            allowed (bool): Whether access is allowed.
            
        Returns:
            bool: True if the permission was set, False otherwise.
        """
        if "entity_types" not in self.acl_store:
            self.acl_store["entity_types"] = {}
            
        if entity_type not in self.acl_store["entity_types"]:
            self.acl_store["entity_types"][entity_type] = {"roles": {}}
            
        self.acl_store["entity_types"][entity_type]["roles"][role] = allowed
        self._save_acl_store()
        print(f"Set permission for role {role} to access entity type {entity_type}: {allowed}")
        return True
    
    def set_relationship_type_permission(self, relationship_type: str, role: str, allowed: bool) -> bool:
        """
        Sets permission for a specific relationship type and role.
        
        Args:
            relationship_type (str): The relationship type to set permission for.
            role (str): The role to set permission for.
            allowed (bool): Whether access is allowed.
            
        Returns:
            bool: True if the permission was set, False otherwise.
        """
        if "relationship_types" not in self.acl_store:
            self.acl_store["relationship_types"] = {}
            
        if relationship_type not in self.acl_store["relationship_types"]:
            self.acl_store["relationship_types"][relationship_type] = {"roles": {}}
            
        self.acl_store["relationship_types"][relationship_type]["roles"][role] = allowed
        self._save_acl_store()
        return True
    
    def filter_pattern_for_user(self, user_context: Dict[str, Any], pattern: Dict[str, Any]) -> Dict[str, Any]:
        """
        Filters a pattern based on user permissions.
        
        Args:
            user_context (Dict[s
(Content truncated due to size limit. Use line ranges to read in chunks)