import { redirect } from 'next/navigation';

export type Role = 'OWNER' | 'ADMIN_KLINIK' | 'DOKTER' | 'CUSTOMER';

export type ModuleName =
  | 'dashboard'
  | 'customers'
  | 'pets'
  | 'appointments'
  | 'medical-records'
  | 'pet-hotel'
  | 'petshop'
  | 'pos'
  | 'billing'
  | 'reports'
  | 'users'
  | 'settings'
  | 'notifications'
  | 'customer-portal'
  | 'profile';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'cancel' | 'export' | 'print' | 'payment' | 'stock-adjustment';

export const STAFF_ROLES: Role[] = ['OWNER', 'ADMIN_KLINIK', 'DOKTER'];

export function isStaffRole(role: string | undefined): role is Exclude<Role, 'CUSTOMER'> {
  return Boolean(role && STAFF_ROLES.includes(role as Role));
}

export function isCustomerRole(role: string | undefined) {
  return role === 'CUSTOMER';
}

export function getDefaultRedirectPath(role: string | undefined) {
  if (!role) {
    return '/login';
  }

  return isStaffRole(role) ? '/dashboard' : '/portal';
}

export function getRoleLabel(role: string | undefined) {
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'ADMIN_KLINIK':
      return 'Admin Klinik';
    case 'DOKTER':
      return 'Doctor';
    case 'CUSTOMER':
      return 'Customer';
    default:
      return 'Tidak diketahui';
  }
}

export function canAccessModule(role: Role, module: ModuleName) {
  const staffModules: ModuleName[] = [
    'dashboard',
    'customers',
    'pets',
    'appointments',
    'medical-records',
    'pet-hotel',
    'petshop',
    'pos',
    'billing',
    'reports',
    'users',
    'settings',
    'notifications',
    'customer-portal',
    'profile',
  ];

  if (role === 'OWNER') {
    return staffModules.includes(module);
  }

  if (role === 'ADMIN_KLINIK') {
    return staffModules.includes(module);
  }

  if (role === 'DOKTER') {
    return ['dashboard', 'customers', 'pets', 'appointments', 'medical-records', 'pet-hotel', 'reports', 'profile'].includes(module);
  }

  return ['dashboard', 'profile'].includes(module);
}

export function canPerformAction(role: Role, module: ModuleName, action: PermissionAction) {
  if (role === 'OWNER') {
    return true;
  }

  if (role === 'ADMIN_KLINIK') {
    if (module === 'users') {
      return ['create', 'read', 'update', 'delete'].includes(action);
    }

    return ['create', 'read', 'update', 'delete', 'approve', 'cancel', 'export', 'print', 'payment', 'stock-adjustment'].includes(action);
  }

  if (role === 'DOKTER') {
    if (module === 'medical-records') {
      return ['create', 'read', 'update'].includes(action);
    }

    if (module === 'appointments') {
      return ['read', 'update'].includes(action);
    }

    return action === 'read';
  }

  return action === 'read';
}

/**
 * Server-side helper to require access to a module.
 * If user doesn't have access, redirects to /dashboard.
 */
export function requireModuleAccess(role: Role | undefined, module: ModuleName) {
  if (!role) {
    redirect('/login');
  }

  if (!canAccessModule(role as Role, module)) {
    redirect(getDefaultRedirectPath(role));
  }
}

