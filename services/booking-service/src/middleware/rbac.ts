import { Request, Response, NextFunction } from 'express';
import { Role, Permission } from '../types/rbac';

// Extend Request to type user property
interface CustomRequest extends Request {
  user?: any;
  tenantId?: string;
  isPlatformAdmin?: boolean;
}

const RolePermissions: Record<Role, Permission[]> = {
  [Role.AGENT]: [
    Permission.CREATE_BOOKING, Permission.READ_BOOKING, Permission.UPDATE_BOOKING,
    Permission.CREATE_CLIENT, Permission.READ_CLIENT, Permission.UPDATE_CLIENT,
    Permission.READ_VENDOR
  ],
  [Role.COMPANY_ADMIN]: [
    Permission.CREATE_BOOKING, Permission.READ_BOOKING, Permission.UPDATE_BOOKING, Permission.DELETE_BOOKING,
    Permission.CREATE_CLIENT, Permission.READ_CLIENT, Permission.UPDATE_CLIENT, Permission.DELETE_CLIENT,
    Permission.CREATE_VENDOR, Permission.READ_VENDOR, Permission.UPDATE_VENDOR, Permission.DELETE_VENDOR,
    Permission.READ_DASHBOARD,
    Permission.CREATE_USER, Permission.READ_USER, Permission.UPDATE_USER, Permission.DELETE_USER,
    Permission.CREATE_TRANSACTION, Permission.READ_TRANSACTION, Permission.UPDATE_TRANSACTION, Permission.DELETE_TRANSACTION
  ],
  [Role.MAIN_COMPANY_ADMIN]: [
    ...Object.values(Permission) 
  ],
  [Role.ADMIN]: [
    // Mapping legacy ADMIN to MAIN_COMPANY_ADMIN for backward compatibility
    ...Object.values(Permission) 
  ]
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: CustomRequest, res: Response, next: NextFunction) => {
    // Read role from header X-User-Role (injected by API Gateway via auth middleware)
    const userRoleStr = req.headers['x-user-role'] as string;
    const userRole = userRoleStr as Role; 

    if (req.isPlatformAdmin) {
        return next();
    }

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Insufficient role privileges.' });
    }
    next();
  };
};

const getFriendlyPermissionName = (permission: string): string => {
  const mapping: Record<string, string> = {
    CREATE_BOOKING: 'create bookings and itineraries',
    READ_BOOKING: 'view bookings and itineraries',
    UPDATE_BOOKING: 'edit bookings and itineraries',
    DELETE_BOOKING: 'delete bookings and itineraries',
    CREATE_CLIENT: 'create client records',
    READ_CLIENT: 'view client records',
    UPDATE_CLIENT: 'edit client records',
    DELETE_CLIENT: 'delete client records',
    CREATE_VENDOR: 'create vendor records',
    READ_VENDOR: 'view vendor records',
    UPDATE_VENDOR: 'edit vendor records',
    DELETE_VENDOR: 'delete vendor records',
    READ_DASHBOARD: 'access the agency dashboard',
    CREATE_USER: 'create team members',
    READ_USER: 'view team members',
    UPDATE_USER: 'edit team members',
    DELETE_USER: 'delete team members',
    CREATE_TRANSACTION: 'create financial records',
    READ_TRANSACTION: 'view financial records',
    UPDATE_TRANSACTION: 'edit financial records',
    DELETE_TRANSACTION: 'delete financial records',
    MANAGE_SETTINGS: 'manage system settings'
  };
  return mapping[permission] || permission.toLowerCase().replace(/_/g, ' ');
};

export const requirePermission = (requiredPermission: Permission) => {
  return async (req: CustomRequest, res: Response, next: NextFunction) => {
    const userRoleStr = req.headers['x-user-role'] as string;
    const userRole = userRoleStr as Role;
    const tenantIdStr = req.headers['x-tenant-id'] as string;
    const isPlatformAdminStr = req.headers['x-is-platform-admin'] as string;

    if (req.isPlatformAdmin || isPlatformAdminStr === 'true' || userRole === Role.MAIN_COMPANY_ADMIN || userRole === Role.ADMIN) {
        return next();
    }

    if (!userRole) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User role not identified.' });
    }

    try {
      const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:4001';
      const response = await fetch(`${authUrl}/roles/permissions/check?role=${userRole}&tenantId=${tenantIdStr}&permission=${requiredPermission}`, {
        headers: {
          'X-User-Id': req.headers['x-user-id'] as string,
          'X-User-Role': req.headers['x-user-role'] as string,
          'X-Tenant-Id': req.headers['x-tenant-id'] as string
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.allowed) {
          return next();
        } else {
          return res.status(403).json({ 
            error: 'Forbidden', 
            message: `Access Denied: You do not have permission to ${getFriendlyPermissionName(requiredPermission)}.` 
          });
        }
      }
    } catch (error) {
      console.warn('Fallback to static permissions check due to auth service error:', error);
    }

    const permissions = RolePermissions[userRole] || [];
    if (!permissions.includes(requiredPermission)) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Access Denied: You do not have permission to ${getFriendlyPermissionName(requiredPermission)}.` 
      });
    }
    next();
  };
};
