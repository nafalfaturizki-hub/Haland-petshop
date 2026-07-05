'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createNotification } from '@/actions/notification';
import { auth } from '@/lib/auth';
import { prisma, createAuditLog, getCustomerForSession } from '@/lib/db';
import { parseStructuredItems, serializeStructuredItems } from '@/lib/medical-record-utils';
import { getActorRole, getActorId, normalizeOptionalText, normalizeOptionalNumber } from '@/lib/utils';

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

async function notifyMedicalRecordChange(userId: string | null | undefined, title: string, message: string) {
  if (!userId) {
    return;
  }

  try {
    await createNotification({ userId, title, message, type: 'medical-record' });
  } catch {
    // ignore notification failures to keep record creation resilient
  }
}



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
  const today = new Date();
  const stamp = today.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  const candidate = `MR-${stamp}-${random}`;
  const existing = await prisma.medicalRecord.findUnique({ where: { recordNumber: candidate } });
  if (!existing) {
    return candidate;
  }
  return generateRecordNumber();
}

export async function getMedicalRecordAccess() {
  const session = await auth();
  const role = getActorRole(session);

  if (!session?.user?.id) {
    return { success: false, message: 'Tidak terautentikasi.' };
  }

  const canManage = role === 'OWNER' || role === 'DOKTER';
  const canRead = Boolean(role);

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

  if (actorRole !== 'DOKTER' && actorRole !== 'OWNER') {
    return { success: false, message: 'Hanya dokter atau pemilik klinik yang dapat membuat rekam medis.' };
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
  const record = await prisma.medicalRecord.create({
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

  await prisma.appointment.update({
    where: { id: parsed.data.appointmentId },
    data: { status: 'DONE' },
  });

  const customerUser = await prisma.customer.findUnique({ where: { id: appointment.customerId }, select: { userId: true } });
  await notifyMedicalRecordChange(customerUser?.userId, 'Rekam medis dibuat', `Rekam medis untuk ${appointment.pet.name} telah dibuat.`);

  await createAuditLog(actorId, 'CREATE', 'MedicalRecord', record.id, `Membuat rekam medis ${record.recordNumber}`);
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

  if (actorRole !== 'DOKTER' && actorRole !== 'OWNER') {
    return { success: false, message: 'Hanya dokter atau pemilik klinik yang dapat mengubah rekam medis.' };
  }

  if (actorRole === 'DOKTER' && existing.doctorId !== actorId) {
    return { success: false, message: 'Anda hanya bisa mengubah rekam medis pasien yang Anda tangani.' };
  }

  const attachmentValidation = validateAttachments(parsed.data.attachments);
  if (attachmentValidation.message) {
    return { success: false, message: attachmentValidation.message };
  }

  const record = await prisma.medicalRecord.update({
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

  await prisma.appointment.update({
    where: { id: existing.appointmentId },
    data: { status: 'DONE' },
  });

  const customerUser = await prisma.customer.findUnique({ where: { id: existing.customerId }, select: { userId: true } });
  await notifyMedicalRecordChange(customerUser?.userId, 'Rekam medis diperbarui', `Rekam medis untuk pasien Anda telah diperbarui.`);

  await createAuditLog(actorId, 'UPDATE', 'MedicalRecord', record.id, `Memperbarui rekam medis ${record.recordNumber}`);
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

  if (actorRole !== 'DOKTER' && actorRole !== 'OWNER') {
    return { success: false, message: 'Anda tidak memiliki akses untuk menghapus rekam medis.' };
  }

  const existing = await prisma.medicalRecord.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, message: 'Rekam medis tidak ditemukan.' };
  }

  if (actorRole === 'DOKTER' && existing.doctorId !== actorId) {
    return { success: false, message: 'Anda hanya bisa menghapus rekam medis pasien yang Anda tangani.' };
  }

  const deleted = await prisma.medicalRecord.delete({ where: { id } });
  await createAuditLog(actorId, 'DELETE', 'MedicalRecord', deleted.id, `Menghapus rekam medis ${deleted.recordNumber}`);
  revalidatePath('/medical-records');
  return { success: true, record: deleted };
}
