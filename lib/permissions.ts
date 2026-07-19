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

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'cancel' | 'export' | 'print' | 'payment' | 'stock-adjustment' | 'pricing' | 'bulk-import';

const STAFF_ROLES: Role[] = ['OWNER', 'ADMIN_KLINIK', 'DOKTER'];
const OWNER_ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete', 'approve', 'cancel', 'export', 'payment', 'stock-adjustment'];

const ROLE_PERMISSION_MATRIX: Record<Role, Record<ModuleName, PermissionAction[]>> = {
  OWNER: {
    dashboard: OWNER_ACTIONS,
    customers: OWNER_ACTIONS,
    pets: OWNER_ACTIONS,
    appointments: OWNER_ACTIONS,
    'medical-records': OWNER_ACTIONS,
    procedures: OWNER_ACTIONS,
    'pet-hotel': OWNER_ACTIONS,
    petshop: ['create', 'read', 'update', 'delete', 'pricing', 'bulk-import', 'stock-adjustment', 'export', 'payment', 'approve', 'cancel'],
    pos: ['create', 'read', 'update', 'delete', 'payment', 'print', 'export', 'approve', 'cancel', 'stock-adjustment'],
    billing: ['create', 'read', 'update', 'delete', 'payment', 'print', 'export', 'approve', 'cancel', 'stock-adjustment'],
    reports: OWNER_ACTIONS,
    users: OWNER_ACTIONS,
    settings: OWNER_ACTIONS,
    notifications: OWNER_ACTIONS,
    'customer-portal': OWNER_ACTIONS,
    profile: OWNER_ACTIONS,
  },
  ADMIN_KLINIK: {
    dashboard: ['read'],
    customers: ['create', 'read', 'update'],
    pets: ['create', 'read', 'update'],
    appointments: ['create', 'read', 'update', 'approve', 'cancel'],
    'medical-records': ['create', 'read', 'update'],
    procedures: ['create', 'read', 'update'],
    'pet-hotel': ['create', 'read', 'update', 'approve', 'cancel'],
    petshop: ['create', 'read', 'update', 'stock-adjustment'],
    pos: ['create', 'read', 'payment', 'print'],
    billing: ['create', 'read', 'payment', 'print'],
    reports: ['read', 'export'],
    users: ['create', 'read', 'update', 'delete'],
    settings: [],
    notifications: ['read', 'update'],
    'customer-portal': ['read'],
    profile: ['read', 'update'],
  },
  DOKTER: {
    dashboard: ['read'],
    customers: ['read'],
    pets: ['read'],
    appointments: ['read', 'update'],
    'medical-records': ['create', 'read', 'update'],
    procedures: ['read'],
    'pet-hotel': ['read'],
    petshop: [],
    pos: [],
    billing: [],
    reports: ['read'],
    users: [],
    settings: [],
    notifications: ['read'],
    'customer-portal': ['read'],
    profile: ['read', 'update'],
  },
  CUSTOMER: {
    dashboard: [],
    customers: [],
    pets: ['read'],
    appointments: [],
    'medical-records': [],
    procedures: [],
    'pet-hotel': ['create', 'read', 'update'],
    petshop: [],
    pos: [],
    billing: ['read'],
    reports: [],
    users: [],
    settings: [],
    notifications: ['read'],
    'customer-portal': ['read'],
    profile: ['read'],
  },
};

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
  return Boolean(ROLE_PERMISSION_MATRIX[role][module]?.length);
}

export function canAccessModule(role: string | undefined, module: ModuleName) {
  if (!role) {
    return false;
  }

  return isModuleAccessibleByRole(role as Role, module);
}

export function getPermissionAuditEntity(module: ModuleName) {
  switch (module) {
    case 'customers':
      return 'Customer';
    case 'pets':
      return 'Pet';
    case 'appointments':
      return 'Appointment';
    case 'medical-records':
      return 'MedicalRecord';
    case 'procedures':
      return 'Procedure';
    case 'pet-hotel':
      return 'PetHotelBooking';
    case 'petshop':
      return 'Product';
    case 'pos':
      return 'PosSale';
    case 'billing':
      return 'Invoice';
    case 'users':
      return 'User';
    case 'settings':
      return 'Settings';
    case 'notifications':
      return 'Notification';
    default:
      return module;
  }
}

export function canPerformAction(role: string | undefined, module: ModuleName, action: PermissionAction) {
  if (!role) {
    return false;
  }

  if (!canAccessModule(role, module)) {
    return false;
  }

  const normalizedRole = role as Role;
  const allowedActions = ROLE_PERMISSION_MATRIX[normalizedRole]?.[module] ?? [];
  return allowedActions.includes(action);
}

type EnforceActionPermissionInput = {
  role: string | undefined;
  actorId?: string | null;
  module: ModuleName;
  action: PermissionAction;
  denyMessage?: string;
  logDenied?: (input: { role: string | undefined; actorId?: string | null; module: ModuleName; action: PermissionAction }) => Promise<void> | void;
};

export async function enforceActionPermission(input: EnforceActionPermissionInput) {
  const { role, actorId, module, action, denyMessage, logDenied } = input;

  if (!role) {
    if (logDenied) {
      await logDenied({ role, actorId, module, action });
    }

    return {
      allowed: false,
      message: denyMessage ?? 'Anda tidak terautentikasi.',
    } as const;
  }

  const allowed = canPerformAction(role, module, action);
  if (!allowed) {
    if (logDenied) {
      await logDenied({ role, actorId, module, action });
    }

    return {
      allowed: false,
      message: denyMessage ?? 'Anda tidak berwenang melakukan tindakan ini.',
    } as const;
  }

  return { allowed: true } as const;
}

export function getPermissionDeniedAuditDescription(role: string | undefined, module: ModuleName, action: PermissionAction) {
  const entity = getPermissionAuditEntity(module);
  const actionLabel = (() => {
    switch (action) {
      case 'create':
        return 'membuat';
      case 'update':
        return 'mengubah';
      case 'delete':
        return 'menghapus';
      case 'cancel':
        return 'membatalkan';
      case 'payment':
        return 'mencatat pembayaran';
      case 'approve':
        return 'menyetujui';
      case 'export':
        return 'mengekspor';
      case 'print':
        return 'mencetak';
      case 'stock-adjustment':
        return 'mengubah stok';
      default:
        return 'melakukan tindakan';
    }
  })();

  return `Mencoba ${actionLabel} ${entity.toLowerCase()} tanpa izin (${role ?? 'unknown'}).`;
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

export function ensureStaffAccess(actorRole: string | undefined, action: 'create' | 'read' | 'update' | 'delete', module?: ModuleName, denyMessage?: string) {
  if (!actorRole) {
    return { allowed: false, message: 'Tidak terautentikasi.' };
  }

  if (canPerformAction(actorRole, module ?? 'dashboard', action)) {
    return { allowed: true };
  }

  return { allowed: false, message: denyMessage ?? 'Anda tidak berwenang.' };
}

export async function requireModuleAccess(role: Role | undefined, module: ModuleName) {
  if (!role) {
    try {
      const { redirect } = await import('next/navigation');
      redirect('/login');
    } catch {
      // Fallback for non-Next runtime contexts.
    }
    return;
  }

  if (!canAccessModule(role, module)) {
    try {
      const { redirect } = await import('next/navigation');
      redirect(getDefaultRedirectPath(role));
    } catch {
      // Fallback for non-Next runtime contexts.
    }
    return;
  }
}

