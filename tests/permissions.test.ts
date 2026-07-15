import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessModule, canPerformAction, canManageTargetRole, enforceActionPermission, getPermissionAuditEntity } from '../lib/permissions';
import { canPerform, getAuthorizedRoutes } from '../lib/permission-matrix';

test('OWNER can access every module and every action', () => {
  const modules = ['dashboard', 'customers', 'pets', 'appointments', 'medical-records', 'procedures', 'pet-hotel', 'petshop', 'pos', 'billing', 'reports', 'users', 'settings', 'notifications', 'customer-portal', 'profile'] as const;
  for (const moduleName of modules) {
    assert.equal(canAccessModule('OWNER', moduleName), true);
    assert.equal(canPerformAction('OWNER', moduleName, 'create'), true);
    assert.equal(canPerformAction('OWNER', moduleName, 'read'), true);
    assert.equal(canPerformAction('OWNER', moduleName, 'update'), true);
    assert.equal(canPerformAction('OWNER', moduleName, 'delete'), true);
    assert.equal(canPerformAction('OWNER', moduleName, 'approve'), true);
    assert.equal(canPerformAction('OWNER', moduleName, 'cancel'), true);
    assert.equal(canPerformAction('OWNER', moduleName, 'export'), true);
    assert.equal(canPerformAction('OWNER', moduleName, 'payment'), true);
    assert.equal(canPerformAction('OWNER', moduleName, 'stock-adjustment'), true);
  }
});

test('ADMIN_KLINIK cannot access settings but can manage users and staff workflows', () => {
  assert.equal(canAccessModule('ADMIN_KLINIK', 'settings'), false);
  assert.equal(canAccessModule('ADMIN_KLINIK', 'billing'), true);
  assert.equal(canPerformAction('ADMIN_KLINIK', 'users', 'create'), true);
  assert.equal(canPerformAction('ADMIN_KLINIK', 'users', 'delete'), true);
  assert.equal(canPerformAction('ADMIN_KLINIK', 'appointments', 'cancel'), true);
  assert.equal(canPerformAction('ADMIN_KLINIK', 'reports', 'export'), true);
  assert.equal(canPerformAction('ADMIN_KLINIK', 'petshop', 'stock-adjustment'), true);
  assert.equal(canPerformAction('ADMIN_KLINIK', 'settings', 'read'), false);
});

test('DOCTOR and CUSTOMER cannot perform actions in modules they cannot access', () => {
  assert.equal(canPerformAction('DOKTER', 'settings', 'read'), false);
  assert.equal(canPerformAction('CUSTOMER', 'appointments', 'read'), false);
  assert.equal(canPerformAction('CUSTOMER', 'profile', 'update'), false);
});

test('DOKTER can only read most modules and create/update medical records', () => {
  assert.equal(canAccessModule('DOKTER', 'medical-records'), true);
  assert.equal(canPerformAction('DOKTER', 'medical-records', 'create'), true);
  assert.equal(canPerformAction('DOKTER', 'medical-records', 'update'), true);
  assert.equal(canPerformAction('DOKTER', 'medical-records', 'delete'), false);
  assert.equal(canPerformAction('DOKTER', 'appointments', 'update'), true);
  assert.equal(canPerformAction('DOKTER', 'appointments', 'create'), false);
  assert.equal(canPerformAction('DOKTER', 'pets', 'read'), true);
  assert.equal(canPerformAction('DOKTER', 'pets', 'create'), false);
  assert.equal(canPerformAction('DOKTER', 'pet-hotel', 'read'), true);
  assert.equal(canPerformAction('DOKTER', 'pet-hotel', 'create'), false);
  assert.equal(canPerformAction('DOKTER', 'petshop', 'create'), false);
  assert.equal(canPerformAction('DOKTER', 'pos', 'create'), false);
  assert.equal(canPerformAction('DOKTER', 'billing', 'create'), false);
  assert.equal(canPerformAction('DOKTER', 'customers', 'update'), false);
});

test('CUSTOMER has minimal access and cannot manage other modules', () => {
  assert.equal(canAccessModule('CUSTOMER', 'profile'), true);
  assert.equal(canAccessModule('CUSTOMER', 'customer-portal'), true);
  assert.equal(canAccessModule('CUSTOMER', 'appointments'), false);
  assert.equal(canPerformAction('CUSTOMER', 'profile', 'read'), true);
  assert.equal(canPerformAction('CUSTOMER', 'profile', 'update'), false);
  assert.equal(canPerformAction('CUSTOMER', 'customer-portal', 'read'), true);
  assert.equal(canPerformAction('CUSTOMER', 'customer-portal', 'create'), false);
});

test('new permission matrix blocks DOKTER from POS, billing, and petshop routes', () => {
  assert.equal(canPerform('DOKTER', 'pos'), false);
  assert.equal(canPerform('DOKTER', 'billing'), false);
  assert.equal(canPerform('DOKTER', 'petshop'), false);
  assert.equal(canPerform('OWNER', 'pos'), true);
  assert.equal(canPerform('ADMIN_KLINIK', 'petshop'), true);
});

test('getAuthorizedRoutes exposes the expected route set per role', () => {
  assert.deepEqual(getAuthorizedRoutes('DOKTER'), ['dashboard', 'customers', 'pets', 'appointments', 'medical-records', 'procedures', 'pet-hotel', 'reports', 'profile']);
  assert.deepEqual(getAuthorizedRoutes('ADMIN_KLINIK'), ['dashboard', 'customers', 'pets', 'appointments', 'medical-records', 'procedures', 'pet-hotel', 'petshop', 'pos', 'billing', 'reports', 'users', 'notifications', 'profile']);
  assert.deepEqual(getAuthorizedRoutes('CUSTOMER'), ['profile', 'customer-portal']);
});

test('canManageTargetRole allows OWNER to manage every role', () => {
  assert.deepEqual(canManageTargetRole('OWNER', 'OWNER'), { allowed: true });
  assert.deepEqual(canManageTargetRole('OWNER', 'ADMIN_KLINIK'), { allowed: true });
  assert.deepEqual(canManageTargetRole('OWNER', 'DOKTER'), { allowed: true });
  assert.deepEqual(canManageTargetRole('OWNER', 'CUSTOMER'), { allowed: true });
});

test('canManageTargetRole allows ADMIN_KLINIK only to manage CUSTOMER', () => {
  assert.deepEqual(canManageTargetRole('ADMIN_KLINIK', 'CUSTOMER'), { allowed: true });
  assert.deepEqual(canManageTargetRole('ADMIN_KLINIK', 'DOKTER'), { allowed: false, message: 'Anda tidak berwenang mengelola akun tersebut.' });
});

test('canManageTargetRole denies DOKTER and CUSTOMER management access', () => {
  assert.deepEqual(canManageTargetRole('DOKTER', 'CUSTOMER'), { allowed: false, message: 'Anda tidak berwenang mengelola akun tersebut.' });
  assert.deepEqual(canManageTargetRole('CUSTOMER', 'CUSTOMER'), { allowed: false, message: 'Anda tidak berwenang mengelola akun tersebut.' });
});

test('enforceActionPermission blocks DOKTER from creating POS transactions and logs the denial', async () => {
  let deniedLogged = false;

  const result = await enforceActionPermission({
    role: 'DOKTER',
    actorId: 'doctor-1',
    module: 'pos',
    action: 'create',
    denyMessage: 'Anda tidak berwenang melakukan penjualan POS.',
    logDenied: async () => {
      deniedLogged = true;
    },
  });

  assert.deepEqual(result, { allowed: false, message: 'Anda tidak berwenang melakukan penjualan POS.' });
  assert.equal(deniedLogged, true);
});

test('enforceActionPermission denies DOCTOR from creating appointments and logs the denial', async () => {
  let deniedLogged = false;

  const result = await enforceActionPermission({
    role: 'DOKTER',
    actorId: 'doctor-2',
    module: 'appointments',
    action: 'create',
    denyMessage: 'Anda tidak berwenang membuat jadwal.',
    logDenied: async () => {
      deniedLogged = true;
    },
  });

  assert.deepEqual(result, { allowed: false, message: 'Anda tidak berwenang membuat jadwal.' });
  assert.equal(deniedLogged, true);
});

test('enforceActionPermission allows ADMIN_KLINIK to create billing invoices', async () => {
  const result = await enforceActionPermission({
    role: 'ADMIN_KLINIK',
    actorId: 'admin-1',
    module: 'billing',
    action: 'create',
  });

  assert.deepEqual(result, { allowed: true });
});

test('getPermissionAuditEntity maps modules to consistent audit entities', () => {
  assert.equal(getPermissionAuditEntity('customers'), 'Customer');
  assert.equal(getPermissionAuditEntity('pets'), 'Pet');
  assert.equal(getPermissionAuditEntity('petshop'), 'Product');
  assert.equal(getPermissionAuditEntity('billing'), 'Invoice');
  assert.equal(getPermissionAuditEntity('profile'), 'profile');
});
