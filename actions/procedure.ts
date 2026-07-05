'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isStaffRole } from '@/lib/permissions';
import { getActorRole, getActorId } from '@/lib/utils';

const procedureSchema = z.object({
  code: z.string().trim().max(100).optional().or(z.literal('')),
  name: z.string().trim().min(1, 'Nama prosedur wajib diisi.').max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  price: z.coerce.number().min(0, 'Harga tidak boleh negatif.'),
});

const updateProcedureSchema = procedureSchema.extend({
  id: z.string().trim().min(1, 'Prosedur tidak valid.'),
});

export async function listProcedures() {
  const session = await auth();
  const actorRole = getActorRole(session);

  if (!actorRole || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melihat prosedur.' };
  }

  const procedures = await prisma.procedure.findMany({
    orderBy: { name: 'asc' },
  });

  return { success: true, procedures };
}

export async function createProcedure(input: z.infer<typeof procedureSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = procedureSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data prosedur tidak valid.' };
  }

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang membuat prosedur.' };
  }

  const procedure = await prisma.procedure.create({
    data: {
      code: parsed.data.code || null,
      name: parsed.data.name,
      description: parsed.data.description || null,
      price: parsed.data.price,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action: 'CREATE',
      entity: 'Procedure',
      entityId: procedure.id,
      description: `Membuat prosedur ${procedure.name}`,
    },
  });

  revalidatePath('/procedures');
  return { success: true, procedure };
}

export async function updateProcedure(input: z.infer<typeof updateProcedureSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = updateProcedureSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data prosedur tidak valid.' };
  }

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mengubah prosedur.' };
  }

  const procedure = await prisma.procedure.update({
    where: { id: parsed.data.id },
    data: {
      code: parsed.data.code || null,
      name: parsed.data.name,
      description: parsed.data.description || null,
      price: parsed.data.price,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action: 'UPDATE',
      entity: 'Procedure',
      entityId: procedure.id,
      description: `Memperbarui prosedur ${procedure.name}`,
    },
  });

  revalidatePath('/procedures');
  return { success: true, procedure };
}

export async function deleteProcedure(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang menghapus prosedur.' };
  }

  const procedure = await prisma.procedure.findUnique({ where: { id } });
  if (!procedure) {
    return { success: false, message: 'Prosedur tidak ditemukan.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.procedure.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'DELETE',
        entity: 'Procedure',
        entityId: procedure.id,
        description: `Menghapus prosedur ${procedure.name}`,
      },
    });
  });

  revalidatePath('/procedures');
  return { success: true };
}
