import test from 'node:test';
import assert from 'node:assert/strict';
import { canPerformAction } from '../lib/permissions';

test('admin klinik is restricted from settings but can manage users', () => {
  assert.equal(canPerformAction('ADMIN_KLINIK', 'settings', 'read'), false);
  assert.equal(canPerformAction('ADMIN_KLINIK', 'users', 'create'), true);
  assert.equal(canPerformAction('ADMIN_KLINIK', 'users', 'update'), true);
});

test('doctor can access medical records but not pos or billing', () => {
  assert.equal(canPerformAction('DOKTER', 'medical-records', 'create'), true);
  assert.equal(canPerformAction('DOKTER', 'pos', 'create'), false);
  assert.equal(canPerformAction('DOKTER', 'billing', 'payment'), false);
});
