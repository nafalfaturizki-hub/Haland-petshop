import { test, expect } from '@playwright/test';
import { login, logout, ensureLoggedOut } from './auth';

test.describe('OWNER - Full Access Tests', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test.afterEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('OWNER can login successfully', async ({ page }) => {
    await login(page, 'OWNER');

    await expect(page).toHaveURL(/\/dashboard(\/|$)/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('OWNER can access settings', async ({ page }) => {
    await login(page, 'OWNER');
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/settings(\/|$)/);
  });

  test('OWNER can manage users', async ({ page }) => {
    await login(page, 'OWNER');
    
    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/users(\/|$)/);
    await expect(page.locator('button').filter({ hasText: /create|tambah|add/i }).first()).toBeVisible();
  });

  test('OWNER can view invoices', async ({ page }) => {
    await login(page, 'OWNER');
    
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/billing(\/|$)/);
  });

  test('OWNER can view appointments', async ({ page }) => {
    await login(page, 'OWNER');
    
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/appointments(\/|$)/);
  });

  test('OWNER can view customers', async ({ page }) => {
    await login(page, 'OWNER');
    
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/customers(\/|$)/);
  });

  test('OWNER can change PIN', async ({ page }) => {
    await login(page, 'OWNER');
    
    await page.goto('/change-pin');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/change-pin(\/|$)/);
  });

  test('OWNER can logout', async ({ page }) => {
    await login(page, 'OWNER');
    
    // Logout
    await logout(page);
    
    await expect(page).toHaveURL(/\/login(\/|$)/);
  });
});
