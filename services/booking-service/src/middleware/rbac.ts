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

export const requirePermission = (requiredPermission: Permission) => {
  return (req: CustomRequest, res: Response, next: NextFunction) => {
    const userRoleStr = req.headers['x-user-role'] as string;
    const userRole = userRoleStr as Role;

    if (req.isPlatformAdmin) {
        return next();
    }

    if (!userRole) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User role not identified.' });
    }

    const permissions = RolePermissions[userRole] || [];
    if (!permissions.includes(requiredPermission)) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `You lack the '${requiredPermission}' permission required for this action.` 
      });
    }
    next();
  };
};
