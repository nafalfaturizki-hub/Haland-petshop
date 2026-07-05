import { redirect } from 'next/navigation';

export type Role = 'OWNER' | 'ADMIN_KLINIK' | 'DOKTER' | 'CUSTOMER';

export type ModuleName =
  | 'dashboard'
  | 'customers'
  | 'pets'
  | 'appointments'
  | 'medical-records'
  | 'procedures'
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

const STAFF_ROLES: Role[] = ['OWNER', 'ADMIN_KLINIK', 'DOKTER'];

export function isStaffRole(role: string | undefined): role is Exclude<Role, 'CUSTOMER'> {
  return Boolean(role && STAFF_ROLES.includes(role as Role));
}

export function isCustomerRole(role: string | undefined): role is 'CUSTOMER' {
  return role === 'CUSTOMER';
}

export function isDoctor(role?: string) {
  return role === 'DOKTER';
}

export function getDefaultRedirectPath(role: string | undefined) {
  if (!role) {
    return '/login';
  }

  if (isCustomerRole(role)) {
    return '/portal';
  }

  return '/dashboard';
}

export function getRoleLabel(role: string | undefined) {
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'ADMIN_KLINIK':
      return 'Admin Klinik';
    case 'DOKTER':
      return 'Dokter';
    case 'CUSTOMER':
      return 'Customer';
    default:
      return 'Tidak diketahui';
  }
}

function isModuleAccessibleByRole(role: Role, module: ModuleName) {
  switch (role) {
    case 'OWNER':
      return true;
    case 'ADMIN_KLINIK':
      return module !== 'settings';
    case 'DOKTER':
      return ['dashboard', 'customers', 'pets', 'appointments', 'medical-records', 'procedures', 'pet-hotel', 'reports', 'profile'].includes(module);
    case 'CUSTOMER':
      return ['profile', 'customer-portal'].includes(module);
    default:
      return false;
  }
}

export function canAccessModule(role: string | undefined, module: ModuleName) {
  if (!role) {
    return false;
  }

  return isModuleAccessibleByRole(role as Role, module);
}

export function canPerformAction(role: string | undefined, module: ModuleName, action: PermissionAction) {
  if (!role) {
    return false;
  }

  const normalizedRole = role as Role;

  if (normalizedRole === 'OWNER') {
    return true;
  }

  if (normalizedRole === 'ADMIN_KLINIK') {
    if (module === 'users') {
      return ['create', 'read', 'update', 'delete'].includes(action);
    }

    return ['create', 'read', 'update', 'delete', 'approve', 'cancel', 'export', 'print', 'payment', 'stock-adjustment'].includes(action);
  }

  if (normalizedRole === 'DOKTER') {
    if (module === 'medical-records') {
      return ['create', 'read', 'update'].includes(action);
    }

    if (module === 'appointments') {
      return ['read', 'update'].includes(action);
    }

    return action === 'read';
  }

  if (normalizedRole === 'CUSTOMER') {
    return action === 'read' && ['profile', 'customer-portal'].includes(module);
  }

  return false;
}

export function canManageTargetRole(role: string | undefined, targetRole: Role) {
  if (!role) {
    return { allowed: false, message: 'Tidak terautentikasi.' };
  }

  if (role === 'OWNER') {
    return { allowed: true };
  }

  if (role === 'ADMIN_KLINIK' && targetRole === 'CUSTOMER') {
    return { allowed: true };
  }

  return { allowed: false, message: 'Anda tidak berwenang mengelola akun tersebut.' };
}

export function requireModuleAccess(role: Role | undefined, module: ModuleName) {
  if (!role) {
    redirect('/login');
  }

  if (!canAccessModule(role, module)) {
    redirect(getDefaultRedirectPath(role));
  }
}

