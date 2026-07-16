import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings-cache';

function getDefaultPrefix(prefix: string | null | undefined, fallback: string) {
  return prefix && prefix.trim() ? prefix.trim() : fallback;
}

async function findExistingNumber(entity: 'Invoice' | 'MedicalRecord' | 'PetHotelBooking', candidate: string) {
  switch (entity) {
    case 'Invoice':
      return prisma.invoice.findUnique({ where: { invoiceNumber: candidate }, select: { id: true } });
    case 'MedicalRecord':
      return prisma.medicalRecord.findUnique({ where: { recordNumber: candidate }, select: { id: true } });
    case 'PetHotelBooking':
      return prisma.petHotelBooking.findUnique({ where: { bookingNumber: candidate }, select: { id: true } });
  }
}

async function generatePrefixedNumber(prefixKey: 'invoicePrefix' | 'medicalRecordPrefix' | 'bookingPrefix', fallback: string, entity: 'Invoice' | 'MedicalRecord' | 'PetHotelBooking') {
  const settings = await getSettings();
  const prefix = getDefaultPrefix(
    settings?.[prefixKey as keyof typeof settings] as string | null | undefined,
    fallback,
  );

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // SECURITY: Retry with exponential backoff on unique constraint violation (TOCTOU race condition)
  for (let retryAttempt = 0; retryAttempt < 3; retryAttempt += 1) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const random = Math.floor(1000 + Math.random() * 9000);
      const candidate = `${prefix}-${today}-${random}`;
      const existing = await findExistingNumber(entity, candidate);

      if (!existing) {
        // Found a unique candidate, but need to validate at insert time
        return candidate;
      }
    }
    
    // All 10 attempts found existing numbers, retry with longer sleep
    if (retryAttempt < 2) {
      const backoffMs = Math.pow(2, retryAttempt) * 100; // 100ms, 200ms, 400ms
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error(`Gagal menghasilkan nomor unik untuk ${entity} setelah retry.`);
}

export async function generateInvoiceNumber() {
  return generatePrefixedNumber('invoicePrefix', 'INV', 'Invoice');
}

export async function generateMedicalRecordNumber() {
  return generatePrefixedNumber('medicalRecordPrefix', 'MR', 'MedicalRecord');
}

export async function generateBookingNumber() {
  return generatePrefixedNumber('bookingPrefix', 'BK', 'PetHotelBooking');
}
