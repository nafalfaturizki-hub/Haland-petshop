import type { ModuleName, Role } from './permissions';

export type PermissionRoute = ModuleName;

const AUTHORIZED_ROUTES_BY_ROLE: Record<Role, ModuleName[]> = {
  OWNER: [
    'dashboard',
    'customers',
    'pets',
    'appointments',
    'medical-records',
    'procedures',
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
  ],
  ADMIN_KLINIK: [
    'dashboard',
    'customers',
    'pets',
    'appointments',
    'medical-records',
    'procedures',
    'pet-hotel',
    'petshop',
    'pos',
    'billing',
    'reports',
    'users',
    'notifications',
    'profile',
  ],
  DOKTER: [
    'dashboard',
    'customers',
    'pets',
    'appointments',
    'medical-records',
    'procedures',
    'pet-hotel',
    'reports',
    'profile',
  ],
  CUSTOMER: ['profile', 'customer-portal'],
};

export function getAuthorizedRoutes(role: string | undefined): ModuleName[] {
  if (!role) {
    return [];
  }

  if (role in AUTHORIZED_ROUTES_BY_ROLE) {
    return AUTHORIZED_ROUTES_BY_ROLE[role as Role];
  }

  return [];
}

export function canPerform(role: string | undefined, route: PermissionRoute) {
  return getAuthorizedRoutes(role).includes(route);
}
