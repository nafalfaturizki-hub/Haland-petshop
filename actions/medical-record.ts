'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma, createAuditLog, getCustomerForSession } from '@/lib/db';
import { parseStructuredItems, serializeStructuredItems } from '@/lib/medical-record-utils';
import { getActorRole, getActorId, normalizeOptionalText, normalizeOptionalNumber } from '@/lib/utils';
import { generateMedicalRecordNumber } from '@/lib/numbering';
import { notifyUser } from '@/lib/notifications-helper';
import { canPerformAction, enforceActionPermission, getPermissionDeniedAuditDescription } from '@/lib/permissions';
import { getAuthorizedRoutes } from '@/lib/permission-matrix';

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const medicalRecordSchema = z.object({
  appointmentId: z.string().trim().min(1, 'Appointment wajib dipilih.'),
  date: z.string().trim().min(1, 'Tanggal kunjungan wajib diisi.'),
  recordNumber: z.string().trim().max(80).optional().or(z.literal('')),
  chiefComplaint: z.string().trim().max(1000).optional().or(z.literal('')),
  history: z.string().trim().max(2000).optional().or(z.literal('')),
  physicalExam: z.string().trim().max(2000).optional().or(z.literal('')),
  vitalSigns: z.string().trim().max(1000).optional().or(z.literal('')),
  weight: z.coerce.number().refine((value) => Number.isFinite(value) && value > 0, 'Berat badan tidak valid.').optional().or(z.literal('')),
  temperature: z.coerce.number().refine((value) => Number.isFinite(value) && value > 0, 'Suhu tubuh tidak valid.').optional().or(z.literal('')),
  heartRate: z.coerce.number().int().refine((value) => value > 0, 'Detak jantung tidak valid.').optional().or(z.literal('')),
  respiratoryRate: z.coerce.number().int().refine((value) => value > 0, 'Laju napas tidak valid.').optional().or(z.literal('')),
  diagnosis: z.string().trim().max(1000).optional().or(z.literal('')),
  treatment: z.string().trim().max(2000).optional().or(z.literal('')),
  prescription: z.string().trim().max(2000).optional().or(z.literal('')),
  labResult: z.string().trim().max(2000).optional().or(z.literal('')),
  notes: z.string().trim().max(3000).optional().or(z.literal('')),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLOSED']).optional(),
  attachments: z.string().optional().or(z.literal('')),
});

const updateMedicalRecordSchema = medicalRecordSchema.extend({
  id: z.string().trim().min(1, 'ID rekam medis wajib ada.'),
});

function serializeMedicalRecordItems(value: string | undefined | null) {
  const items = parseStructuredItems(value);
  return items.length > 0 ? serializeStructuredItems(items) : null;
}

function parseAttachments(value: string | undefined | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;

    return parsed.filter((item): item is { name: string; type: string; size: number; dataUrl: string } => Boolean(item && typeof item === 'object' && typeof item.name === 'string' && typeof item.type === 'string' && typeof item.dataUrl === 'string' && typeof item.size === 'number'));
  } catch {
    return null;
  }
}

function validateAttachments(value: string | undefined | null) {
  const attachments = parseAttachments(value);
  if (!attachments || attachments.length === 0) {
    return { attachments: null, message: null };
  }

  for (const attachment of attachments) {
    if (!ALLOWED_ATTACHMENT_TYPES.includes(attachment.type)) {
      return { attachments: null, message: 'Jenis file lampiran tidak diizinkan.' };
    }

    const base64 = attachment.dataUrl.split(',')[1];
    if (!base64) {
      return { attachments: null, message: 'Konten lampiran tidak valid.' };
    }

    const size = Buffer.from(base64, 'base64').length;
    if (size > MAX_ATTACHMENT_SIZE_BYTES) {
      return { attachments: null, message: 'Ukuran lampiran melebihi batas 5 MB.' };
    }
  }

  return { attachments, message: null };
}

async function generateRecordNumber() {
  return generateMedicalRecordNumber();
}

export async function getMedicalRecordAccess() {
  const session = await auth();
  const role = getActorRole(session);

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const canManage = Boolean(role && canPerformAction(role, 'medical-records', 'create'));
  const canRead = Boolean(role && canPerformAction(role, 'medical-records', 'read'));

  return {
    success: true,
    role,
    canManage,
    canRead,
  };
}

export async function listMedicalRecordOptions() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const appointments = await prisma.appointment.findMany({
    orderBy: { date: 'asc' },
    include: {
      pet: { select: { id: true, name: true, species: true } },
      customer: { select: { id: true, name: true } },
      doctor: { select: { id: true, name: true } },
    },
    where: actorRole === 'DOKTER' ? { doctorId: actorId } : undefined,
  });

  return { success: true, appointments };
}

export async function listMedicalRecords() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  if (actorRole === 'CUSTOMER') {
    const customer = await getCustomerForSession(actorId);
    if (!customer) {
      return { success: true, records: [] };
    }

    const records = await prisma.medicalRecord.findMany({
      where: { customerId: customer.id },
      orderBy: { date: 'desc' },
      include: {
        appointment: { select: { id: true, date: true, status: true } },
        customer: { select: { id: true, name: true } },
        pet: { select: { id: true, name: true, species: true } },
        doctor: { select: { id: true, name: true } },
      },
    });

    return { success: true, records };
  }

  if (!getAuthorizedRoutes(actorRole).includes('medical-records')) {
    return { success: false, message: 'Anda tidak berwenang mengakses rekam medis.' };
  }

  const where = actorRole === 'DOKTER' ? { doctorId: actorId } : undefined;

  const records = await prisma.medicalRecord.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      appointment: { select: { id: true, date: true, status: true } },
      customer: { select: { id: true, name: true } },
      pet: { select: { id: true, name: true, species: true } },
      doctor: { select: { id: true, name: true } },
    },
  });

  return { success: true, records };
}

export async function createMedicalRecord(input: z.infer<typeof medicalRecordSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = medicalRecordSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid. Periksa kembali field yang wajib diisi.' };
  }

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const permissionCheck = await enforceActionPermission({
    role: actorRole,
    actorId,
    module: 'medical-records',
    action: 'create',
    denyMessage: 'Anda tidak berwenang membuat rekam medis.',
    logDenied: async () => {
      await createAuditLog(actorId ?? 'unknown', 'PERMISSION_DENIED', 'MedicalRecord', null, getPermissionDeniedAuditDescription(actorRole, 'medical-records', 'create'));
    },
  });

  if (!permissionCheck.allowed) {
    return { success: false, message: permissionCheck.message };
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: parsed.data.appointmentId },
    include: { pet: true, customer: true },
  });
  if (!appointment) {
    return { success: false, message: 'Jadwal pemeriksaan tidak ditemukan.' };
  }

  if (appointment.status === 'CANCELLED') {
    return { success: false, message: 'Tidak dapat membuat rekam medis untuk appointment yang dibatalkan.' };
  }

  const existingRecord = await prisma.medicalRecord.findUnique({ where: { appointmentId: parsed.data.appointmentId } });
  if (existingRecord) {
    return { success: false, message: 'Rekam medis untuk appointment ini sudah ada.' };
  }

  if (actorRole === 'DOKTER' && appointment.doctorId !== actorId) {
    return { success: false, message: 'Anda hanya bisa membuat rekam medis untuk pasien yang Anda tangani.' };
  }

  const attachmentValidation = validateAttachments(parsed.data.attachments);
  if (attachmentValidation.message) {
    return { success: false, message: attachmentValidation.message };
  }

  const recordNumber = await generateRecordNumber();
  const record = await prisma.$transaction(async (tx: any) => {
    const created = await tx.medicalRecord.create({
      data: {
        recordNumber,
        appointmentId: parsed.data.appointmentId,
        customerId: appointment.customerId,
        petId: appointment.petId,
        doctorId: actorId,
        date: new Date(parsed.data.date),
        chiefComplaint: normalizeOptionalText(parsed.data.chiefComplaint),
        history: normalizeOptionalText(parsed.data.history),
        physicalExam: normalizeOptionalText(parsed.data.physicalExam),
        vitalSigns: normalizeOptionalText(parsed.data.vitalSigns),
        weight: normalizeOptionalNumber(parsed.data.weight as string | undefined),
        temperature: normalizeOptionalNumber(parsed.data.temperature as string | undefined),
        heartRate: normalizeOptionalNumber(parsed.data.heartRate as string | undefined) ? Math.round(Number(normalizeOptionalNumber(parsed.data.heartRate as string | undefined))) : null,
        respiratoryRate: normalizeOptionalNumber(parsed.data.respiratoryRate as string | undefined) ? Math.round(Number(normalizeOptionalNumber(parsed.data.respiratoryRate as string | undefined))) : null,
        diagnosis: normalizeOptionalText(parsed.data.diagnosis),
        treatment: serializeMedicalRecordItems(parsed.data.treatment),
        prescription: serializeMedicalRecordItems(parsed.data.prescription),
        labResult: normalizeOptionalText(parsed.data.labResult),
        notes: normalizeOptionalText(parsed.data.notes),
        status: parsed.data.status ?? 'COMPLETED',
        attachments: attachmentValidation.attachments ? JSON.stringify(attachmentValidation.attachments) : null,
      },
    });

    await tx.appointment.update({
      where: { id: parsed.data.appointmentId },
      data: { status: 'DONE' },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'CREATE',
        entity: 'MedicalRecord',
        entityId: created.id,
        description: `Membuat rekam medis ${created.recordNumber}`,
      },
    });

    return created;
  });

  const customerUser = await prisma.customer.findUnique({ where: { id: appointment.customerId }, select: { userId: true } });
  await notifyUser(customerUser?.userId, 'Rekam medis dibuat', `Rekam medis untuk ${appointment.pet.name} telah dibuat.`, 'medical-record');
  revalidatePath('/medical-records');
  return { success: true, record };
}

export async function updateMedicalRecord(input: z.infer<typeof updateMedicalRecordSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = updateMedicalRecordSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid. Periksa kembali field yang wajib diisi.' };
  }

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const existing = await prisma.medicalRecord.findUnique({ where: { id: parsed.data.id } });
  if (!existing) {
    return { success: false, message: 'Rekam medis tidak ditemukan.' };
  }

  const permissionCheck = await enforceActionPermission({
    role: actorRole,
    actorId,
    module: 'medical-records',
    action: 'update',
    denyMessage: 'Anda tidak berwenang mengubah rekam medis.',
    logDenied: async () => {
      await createAuditLog(actorId ?? 'unknown', 'PERMISSION_DENIED', 'MedicalRecord', parsed.data.id, getPermissionDeniedAuditDescription(actorRole, 'medical-records', 'update'));
    },
  });

  if (!permissionCheck.allowed) {
    return { success: false, message: permissionCheck.message };
  }

  if (actorRole === 'DOKTER' && existing.doctorId !== actorId) {
    return { success: false, message: 'Anda hanya bisa mengubah rekam medis pasien yang Anda tangani.' };
  }

  const attachmentValidation = validateAttachments(parsed.data.attachments);
  if (attachmentValidation.message) {
    return { success: false, message: attachmentValidation.message };
  }

  const record = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.medicalRecord.update({
      where: { id: parsed.data.id },
      data: {
        date: new Date(parsed.data.date),
        chiefComplaint: normalizeOptionalText(parsed.data.chiefComplaint),
        history: normalizeOptionalText(parsed.data.history),
        physicalExam: normalizeOptionalText(parsed.data.physicalExam),
        vitalSigns: normalizeOptionalText(parsed.data.vitalSigns),
        weight: normalizeOptionalNumber(parsed.data.weight as string | undefined),
        temperature: normalizeOptionalNumber(parsed.data.temperature as string | undefined),
        heartRate: normalizeOptionalNumber(parsed.data.heartRate as string | undefined) ? Math.round(Number(normalizeOptionalNumber(parsed.data.heartRate as string | undefined))) : null,
        respiratoryRate: normalizeOptionalNumber(parsed.data.respiratoryRate as string | undefined) ? Math.round(Number(normalizeOptionalNumber(parsed.data.respiratoryRate as string | undefined))) : null,
        diagnosis: normalizeOptionalText(parsed.data.diagnosis),
        treatment: serializeMedicalRecordItems(parsed.data.treatment),
        prescription: serializeMedicalRecordItems(parsed.data.prescription),
        labResult: normalizeOptionalText(parsed.data.labResult),
        notes: normalizeOptionalText(parsed.data.notes),
        status: parsed.data.status ?? existing.status,
        attachments: attachmentValidation.attachments ? JSON.stringify(attachmentValidation.attachments) : null,
        version: existing.version + 1,
      },
    });

    await tx.appointment.update({
      where: { id: existing.appointmentId },
      data: { status: 'DONE' },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'UPDATE',
        entity: 'MedicalRecord',
        entityId: updated.id,
        description: `Memperbarui rekam medis ${updated.recordNumber}`,
      },
    });

    return updated;
  });

  const customerUser = await prisma.customer.findUnique({ where: { id: existing.customerId }, select: { userId: true } });
  await notifyUser(customerUser?.userId, 'Rekam medis diperbarui', `Rekam medis untuk pasien Anda telah diperbarui.`, 'medical-record');
  revalidatePath('/medical-records');
  return { success: true, record };
}

export async function deleteMedicalRecord(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const permissionCheck = await enforceActionPermission({
    role: actorRole,
    actorId,
    module: 'medical-records',
    action: 'delete',
    denyMessage: 'Anda tidak memiliki akses untuk menghapus rekam medis.',
    logDenied: async () => {
      await createAuditLog(actorId ?? 'unknown', 'PERMISSION_DENIED', 'MedicalRecord', id, getPermissionDeniedAuditDescription(actorRole, 'medical-records', 'delete'));
    },
  });

  if (!permissionCheck.allowed) {
    return { success: false, message: permissionCheck.message };
  }

  const existing = await prisma.medicalRecord.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, message: 'Rekam medis tidak ditemukan.' };
  }

  if (actorRole === 'DOKTER' && existing.doctorId !== actorId) {
    return { success: false, message: 'Anda hanya bisa menghapus rekam medis pasien yang Anda tangani.' };
  }

  const deleted = await prisma.$transaction(async (tx: any) => {
    const removed = await tx.medicalRecord.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'DELETE',
        entity: 'MedicalRecord',
        entityId: removed.id,
        description: `Menghapus rekam medis ${removed.recordNumber}`,
      },
    });
    return removed;
  });

  revalidatePath('/medical-records');
  return { success: true, record: deleted };
}
