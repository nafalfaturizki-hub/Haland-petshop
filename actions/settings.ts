'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

import { getActorRole } from '@/lib/utils';

const settingsSchema = z.object({
  clinicName: z.string().trim().max(100).optional().or(z.literal('')),
  logo: z.string().trim().max(200).optional().or(z.literal('')),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().trim().email().max(100).optional().or(z.literal('')),
  website: z.string().trim().max(200).optional().or(z.literal('')),
  taxNumber: z.string().trim().max(50).optional().or(z.literal('')),
  operationalHours: z.string().trim().max(100).optional().or(z.literal('')),
  timezone: z.string().trim().max(50).optional().or(z.literal('')),
  currency: z.string().trim().max(10).optional().or(z.literal('')),
  language: z.string().trim().max(20).optional().or(z.literal('')),
  footerInfo: z.string().trim().max(200).optional().or(z.literal('')),
  receiptHeader: z.string().trim().max(200).optional().or(z.literal('')),
  receiptFooter: z.string().trim().max(200).optional().or(z.literal('')),
  appName: z.string().trim().max(100).optional().or(z.literal('')),
  appVersion: z.string().trim().max(20).optional().or(z.literal('')),
  dateFormat: z.string().trim().max(20).optional().or(z.literal('')),
  timeFormat: z.string().trim().max(20).optional().or(z.literal('')),
  numberFormat: z.string().trim().max(20).optional().or(z.literal('')),
  pagination: z.coerce.number().int().min(5).max(200).optional().or(z.literal('')),
  sessionTimeout: z.coerce.number().int().min(5).max(1440).optional().or(z.literal('')),
  autoLogout: z.boolean().optional(),
  defaultDashboard: z.string().trim().max(50).optional().or(z.literal('')),
  appointmentDuration: z.coerce.number().int().min(5).max(240).optional().or(z.literal('')),
  workingDays: z.string().trim().max(50).optional().or(z.literal('')),
  holidayRules: z.string().trim().max(200).optional().or(z.literal('')),
  invoicePrefix: z.string().trim().max(20).optional().or(z.literal('')),
  medicalRecordPrefix: z.string().trim().max(20).optional().or(z.literal('')),
  customerPrefix: z.string().trim().max(20).optional().or(z.literal('')),
  petPrefix: z.string().trim().max(20).optional().or(z.literal('')),
  posPrefix: z.string().trim().max(20).optional().or(z.literal('')),
  bookingPrefix: z.string().trim().max(20).optional().or(z.literal('')),
  receiptPrefix: z.string().trim().max(20).optional().or(z.literal('')),
  autoNumbering: z.boolean().optional(),
  theme: z.string().trim().max(20).optional().or(z.literal('')),
});

const auditLogBackupSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  date: z.string().optional(),
});

const backupPayloadSchema = z.object({
  version: z.literal(1),
  createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), { message: 'createdAt harus tanggal ISO yang valid.' }),
  settings: settingsSchema.extend({ id: z.string().optional() }).passthrough(),
  auditLogs: z.array(auditLogBackupSchema).optional(),
});

const restoreBackupSchema = z.object({
  content: z.string().min(1).max(10_000_000),
});

function isOwner(role?: string) {
  return role === 'OWNER';
}
function normalizeString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBoolean(value: boolean | undefined) {
  return value ?? false;
}

function normalizeNumber(value: number | string | undefined | null) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function createAuditEntry(userId: string, action: string, entity: string, description: string, entityId?: string | null) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      description,
    },
  });
}

export async function getSettingsData() {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  if (!isOwner(actorRole)) {
    return { success: false, message: 'Hanya Owner yang bisa mengakses pengaturan ini.', data: null };
  }

  const [settings, auditLogs] = await Promise.all([
    prisma.settings.findFirst(),
    prisma.auditLog.findMany({
      orderBy: { date: 'desc' },
      take: 20,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        description: true,
        date: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  return {
    success: true,
    message: 'Data pengaturan berhasil dimuat.',
    data: {
      settings,
      auditLogs,
      isOwner: isOwner(actorRole),
    },
  };
}

export async function updateSettings(input: z.infer<typeof settingsSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = settingsSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data pengaturan tidak valid.', data: null };
  }

  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  if (!isOwner(actorRole)) {
    return { success: false, message: 'Hanya Owner yang bisa mengubah pengaturan ini.', data: null };
  }

  try {
    const settings = await prisma.$transaction(async (tx) => {
      const current = await tx.settings.upsert({
        where: { id: 'default-settings' },
        create: {
          id: 'default-settings',
          clinicName: normalizeString(parsed.data.clinicName),
          logo: normalizeString(parsed.data.logo),
          address: normalizeString(parsed.data.address),
          phone: normalizeString(parsed.data.phone),
          email: normalizeString(parsed.data.email),
          website: normalizeString(parsed.data.website),
          taxNumber: normalizeString(parsed.data.taxNumber),
          operationalHours: normalizeString(parsed.data.operationalHours),
          timezone: normalizeString(parsed.data.timezone),
          currency: normalizeString(parsed.data.currency),
          language: normalizeString(parsed.data.language),
          footerInfo: normalizeString(parsed.data.footerInfo),
          receiptHeader: normalizeString(parsed.data.receiptHeader),
          receiptFooter: normalizeString(parsed.data.receiptFooter),
          appName: normalizeString(parsed.data.appName),
          appVersion: normalizeString(parsed.data.appVersion),
          dateFormat: normalizeString(parsed.data.dateFormat),
          timeFormat: normalizeString(parsed.data.timeFormat),
          numberFormat: normalizeString(parsed.data.numberFormat),
          pagination: normalizeNumber(parsed.data.pagination),
          sessionTimeout: normalizeNumber(parsed.data.sessionTimeout),
          autoLogout: normalizeBoolean(parsed.data.autoLogout),
          defaultDashboard: normalizeString(parsed.data.defaultDashboard),
          appointmentDuration: normalizeNumber(parsed.data.appointmentDuration),
          workingDays: normalizeString(parsed.data.workingDays),
          holidayRules: normalizeString(parsed.data.holidayRules),
          invoicePrefix: normalizeString(parsed.data.invoicePrefix),
          medicalRecordPrefix: normalizeString(parsed.data.medicalRecordPrefix),
          customerPrefix: normalizeString(parsed.data.customerPrefix),
          petPrefix: normalizeString(parsed.data.petPrefix),
          posPrefix: normalizeString(parsed.data.posPrefix),
          bookingPrefix: normalizeString(parsed.data.bookingPrefix),
          receiptPrefix: normalizeString(parsed.data.receiptPrefix),
          autoNumbering: normalizeBoolean(parsed.data.autoNumbering),
          theme: normalizeString(parsed.data.theme),
        },
        update: {
          clinicName: normalizeString(parsed.data.clinicName),
          logo: normalizeString(parsed.data.logo),
          address: normalizeString(parsed.data.address),
          phone: normalizeString(parsed.data.phone),
          email: normalizeString(parsed.data.email),
          website: normalizeString(parsed.data.website),
          taxNumber: normalizeString(parsed.data.taxNumber),
          operationalHours: normalizeString(parsed.data.operationalHours),
          timezone: normalizeString(parsed.data.timezone),
          currency: normalizeString(parsed.data.currency),
          language: normalizeString(parsed.data.language),
          footerInfo: normalizeString(parsed.data.footerInfo),
          receiptHeader: normalizeString(parsed.data.receiptHeader),
          receiptFooter: normalizeString(parsed.data.receiptFooter),
          appName: normalizeString(parsed.data.appName),
          appVersion: normalizeString(parsed.data.appVersion),
          dateFormat: normalizeString(parsed.data.dateFormat),
          timeFormat: normalizeString(parsed.data.timeFormat),
          numberFormat: normalizeString(parsed.data.numberFormat),
          pagination: normalizeNumber(parsed.data.pagination),
          sessionTimeout: normalizeNumber(parsed.data.sessionTimeout),
          autoLogout: normalizeBoolean(parsed.data.autoLogout),
          defaultDashboard: normalizeString(parsed.data.defaultDashboard),
          appointmentDuration: normalizeNumber(parsed.data.appointmentDuration),
          workingDays: normalizeString(parsed.data.workingDays),
          holidayRules: normalizeString(parsed.data.holidayRules),
          invoicePrefix: normalizeString(parsed.data.invoicePrefix),
          medicalRecordPrefix: normalizeString(parsed.data.medicalRecordPrefix),
          customerPrefix: normalizeString(parsed.data.customerPrefix),
          petPrefix: normalizeString(parsed.data.petPrefix),
          posPrefix: normalizeString(parsed.data.posPrefix),
          bookingPrefix: normalizeString(parsed.data.bookingPrefix),
          receiptPrefix: normalizeString(parsed.data.receiptPrefix),
          autoNumbering: normalizeBoolean(parsed.data.autoNumbering),
          theme: normalizeString(parsed.data.theme),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_SETTINGS',
          entity: 'Settings',
          entityId: current.id,
          description: 'Mengubah pengaturan klinik.',
        },
      });

      return current;
    });

    revalidatePath('/settings');
    return { success: true, message: 'Pengaturan berhasil disimpan.', data: { settings } };
  } catch (error) {
    console.error('Failed to update settings', error);
    return { success: false, message: 'Gagal menyimpan pengaturan.', data: null };
  }
}

export async function createBackup() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  if (!isOwner(actorRole)) {
    return { success: false, message: 'Hanya Owner yang dapat membuat backup.', data: null };
  }

  try {
    const [settings, auditLogs] = await Promise.all([
      prisma.settings.findFirst(),
      prisma.auditLog.findMany({ orderBy: { date: 'desc' }, take: 100 }),
    ]);

    const timestamp = new Date().toISOString();
    const payload = {
      version: 1,
      createdAt: timestamp,
      settings,
      auditLogs,
    };
    const content = JSON.stringify(payload, null, 2);
    
    // Validate backup content - ensure it's not empty and can be parsed back
    const MAX_BACKUP_SIZE = 10 * 1024 * 1024; // 10MB max
    if (content.length === 0 || content.length > MAX_BACKUP_SIZE) {
      return { success: false, message: `Ukuran backup tidak valid. Maksimal ${MAX_BACKUP_SIZE / 1024 / 1024}MB.`, data: null };
    }

    // Validate backup integrity by parsing it back
    try {
      const verified = JSON.parse(content);
      backupPayloadSchema.parse(verified);
    } catch {
      return { success: false, message: 'Backup tidak valid. Integritas data gagal diverifikasi.', data: null };
    }

    const fileName = `haland-backup-${timestamp.slice(0, 10)}-${Date.now()}.json`;

    await createAuditEntry(userId, 'BACKUP_CREATE', 'Settings', `Membuat backup konfigurasi sistem (${(content.length / 1024).toFixed(2)}KB).`, null);

    return {
      success: true,
      message: 'Backup berhasil dibuat.',
      data: { fileName, content },
    };
  } catch (error) {
    console.error('Failed to create backup', error);
    return { success: false, message: 'Gagal membuat backup.', data: null };
  }
}

export async function restoreBackup(input: z.infer<typeof restoreBackupSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const parsed = restoreBackupSchema.safeParse(input);
  const userId = session?.user?.id;

  if (!parsed.success) {
    return { success: false, message: 'Konten backup tidak valid.', data: null };
  }

  if (!userId) {
    return { success: false, message: 'Tidak terautentikasi.', data: null };
  }

  if (!isOwner(actorRole)) {
    return { success: false, message: 'Hanya Owner yang dapat melakukan restore.', data: null };
  }

  // Pre-validation: Check content size
  const MAX_BACKUP_SIZE = 10 * 1024 * 1024; // 10MB max
  if (parsed.data.content.length > MAX_BACKUP_SIZE) {
    return { success: false, message: `File backup terlalu besar. Maksimal ${MAX_BACKUP_SIZE / 1024 / 1024}MB.`, data: null };
  }

  let payload: unknown;

  try {
    payload = JSON.parse(parsed.data.content);
  } catch {
    return { success: false, message: 'Format file backup tidak valid. Pastikan file JSON well-formed.', data: null };
  }

  const backupResult = backupPayloadSchema.safeParse(payload);
  if (!backupResult.success) {
    return { 
      success: false, 
      message: `Backup tidak berisi data pengaturan yang valid. ${backupResult.error.errors[0]?.message ?? ''}`, 
      data: null 
    };
  }

  const backupData = backupResult.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const incomingSettings = backupData.settings;
        
        // Pre-check: Validate all settings fields before restore
        const settingsData = {
          clinicName: normalizeString(incomingSettings.clinicName),
          logo: normalizeString(incomingSettings.logo),
          address: normalizeString(incomingSettings.address),
          phone: normalizeString(incomingSettings.phone),
          email: normalizeString(incomingSettings.email),
          website: normalizeString(incomingSettings.website),
          taxNumber: normalizeString(incomingSettings.taxNumber),
          operationalHours: normalizeString(incomingSettings.operationalHours),
          timezone: normalizeString(incomingSettings.timezone),
          currency: normalizeString(incomingSettings.currency),
          language: normalizeString(incomingSettings.language),
          footerInfo: normalizeString(incomingSettings.footerInfo),
          receiptHeader: normalizeString(incomingSettings.receiptHeader),
          receiptFooter: normalizeString(incomingSettings.receiptFooter),
          appName: normalizeString(incomingSettings.appName),
          appVersion: normalizeString(incomingSettings.appVersion),
          dateFormat: normalizeString(incomingSettings.dateFormat),
          timeFormat: normalizeString(incomingSettings.timeFormat),
          numberFormat: normalizeString(incomingSettings.numberFormat),
          pagination: normalizeNumber(incomingSettings.pagination),
          sessionTimeout: normalizeNumber(incomingSettings.sessionTimeout),
          autoLogout: normalizeBoolean(incomingSettings.autoLogout),
          defaultDashboard: normalizeString(incomingSettings.defaultDashboard),
          appointmentDuration: normalizeNumber(incomingSettings.appointmentDuration),
          workingDays: normalizeString(incomingSettings.workingDays),
          holidayRules: normalizeString(incomingSettings.holidayRules),
          invoicePrefix: normalizeString(incomingSettings.invoicePrefix),
          medicalRecordPrefix: normalizeString(incomingSettings.medicalRecordPrefix),
          customerPrefix: normalizeString(incomingSettings.customerPrefix),
          petPrefix: normalizeString(incomingSettings.petPrefix),
          posPrefix: normalizeString(incomingSettings.posPrefix),
          bookingPrefix: normalizeString(incomingSettings.bookingPrefix),
          receiptPrefix: normalizeString(incomingSettings.receiptPrefix),
          autoNumbering: normalizeBoolean(incomingSettings.autoNumbering),
          theme: normalizeString(incomingSettings.theme),
        };

        const settingsResult = await tx.settings.upsert({
          where: { id: incomingSettings.id ?? 'default-settings' },
          create: {
            id: incomingSettings.id ?? 'default-settings',
            ...settingsData,
          },
          update: settingsData,
        });

        let auditLogsRestored = 0;
        if (Array.isArray(backupData.auditLogs)) {
          for (const record of backupData.auditLogs.slice(0, 100)) {
            await tx.auditLog.create({
              data: {
                userId,
                action: record.action ?? 'RESTORE_BACKUP_ITEM',
                entity: record.entity ?? 'Settings',
                entityId: record.entityId ?? null,
                description: record.description ?? null,
                date: record.date ? new Date(record.date) : undefined,
              },
            });
            auditLogsRestored++;
          }
        }

        await tx.auditLog.create({
          data: {
            userId,
            action: 'RESTORE_BACKUP',
            entity: 'Settings',
            description: `Melakukan restore backup manual. ${auditLogsRestored} audit log dipulihkan.`,
          },
        });

        return { settingsId: settingsResult.id, auditLogsRestored };
      },
      {
        isolationLevel: 'Serializable', // Ensure strict transaction isolation
        timeout: 30000, // 30 second timeout for restore operation
      }
    );

    revalidatePath('/settings');
    return { 
      success: true, 
      message: `Restore backup selesai. ${result.auditLogsRestored} audit log dipulihkan.`, 
      data: { restored: true, auditLogsRestored: result.auditLogsRestored } 
    };
  } catch (error) {
    console.error('Failed to restore backup', error);
    
    // Specific error messages for different failure scenarios
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint failed')) {
        return { success: false, message: 'Konflik data: Pengaturan dengan ID ini sudah ada. Restore dibatalkan.', data: null };
      }
      if (error.message.includes('timeout')) {
        return { success: false, message: 'Restore backup timeout. Coba lagi dengan file yang lebih kecil.', data: null };
      }
    }
    
    return { success: false, message: 'Restore backup gagal. Sistem kembali ke state sebelumnya (transaksi dibatalkan).', data: null };
  }
}
