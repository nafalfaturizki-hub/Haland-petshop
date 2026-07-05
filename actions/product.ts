'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isStaffRole } from '@/lib/permissions';
import { getActorRole, getActorId, normalizeOptionalText } from '@/lib/utils';

const productSchema = z.object({
  name: z.string().trim().min(1, 'Nama produk wajib diisi.').max(200),
  sku: z.string().trim().max(100).optional().or(z.literal('')),
  barcode: z.string().trim().max(100).optional().or(z.literal('')),
  brand: z.string().trim().max(100).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  categoryId: z.string().trim().optional().or(z.literal('')),
  supplierId: z.string().trim().optional().or(z.literal('')),
  unit: z.string().trim().max(50).optional().or(z.literal('')),
  buyPrice: z.coerce.number().min(0, 'Harga beli tidak boleh negatif.'),
  sellPrice: z.coerce.number().min(0, 'Harga jual tidak boleh negatif.'),
  costPrice: z.coerce.number().min(0, 'Harga pokok tidak boleh negatif.').optional(),
  stock: z.coerce.number().int().min(0, 'Stok tidak boleh negatif.'),
  minStock: z.coerce.number().int().min(0, 'Stok minimum tidak boleh negatif.'),
  maxStock: z.coerce.number().int().min(0, 'Stok maksimum tidak boleh negatif.').optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  imageUrl: z.string().trim().max(500).optional().or(z.literal('')),
});

const updateProductSchema = productSchema.extend({
  id: z.string().min(1),
});

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Nama kategori wajib diisi.').max(100),
});

const updateCategorySchema = categorySchema.extend({
  id: z.string().min(1),
});

const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Nama supplier wajib diisi.').max(200),
  contact: z.string().trim().max(200).optional().or(z.literal('')),
});

const updateSupplierSchema = supplierSchema.extend({
  id: z.string().min(1),
});



async function validateProductUniqueness(sku: string | null, barcode: string | null, excludeId?: string) {
  if (!sku && !barcode) return null;

  const existing = await prisma.product.findFirst({
    where: {
      AND: [
        {
          OR: [
            ...(sku ? [{ sku }] : []),
            ...(barcode ? [{ barcode }] : []),
          ],
        },
        ...(excludeId ? [{ id: { not: excludeId } }] : []),
      ],
    },
    select: { id: true, name: true },
  });

  return existing;
}

// CATEGORIES
export async function listProductCategories() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melihat data ini.' };
  }

  const categories = await prisma.productCategory.findMany({
    orderBy: { name: 'asc' },
  });

  return { success: true, categories };
}

export async function createProductCategory(input: z.infer<typeof categorySchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = categorySchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang membuat kategori.' };
  }

  const category = await prisma.productCategory.create({
    data: { name: parsed.data.name },
  });

  revalidatePath('/petshop/products');
  return { success: true, category };
}

export async function updateProductCategory(input: z.infer<typeof updateCategorySchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = updateCategorySchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mengubah kategori.' };
  }

  const category = await prisma.productCategory.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });

  revalidatePath('/petshop/products');
  return { success: true, category };
}

export async function deleteProductCategory(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || actorRole !== 'OWNER') {
    return { success: false, message: 'Hanya Owner yang dapat menghapus kategori.' };
  }

  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    return { success: false, message: `Tidak dapat menghapus kategori karena masih ada ${productCount} produk yang terhubung.` };
  }

  await prisma.productCategory.delete({ where: { id } });

  revalidatePath('/petshop/products');
  return { success: true };
}

// SUPPLIERS
export async function listSuppliers() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melihat data ini.' };
  }

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: 'asc' },
  });

  return { success: true, suppliers };
}

export async function createSupplier(input: z.infer<typeof supplierSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = supplierSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang membuat supplier.' };
  }

  const supplier = await prisma.supplier.create({
    data: { name: parsed.data.name, contact: normalizeOptionalText(parsed.data.contact) },
  });

  revalidatePath('/petshop/products');
  return { success: true, supplier };
}

export async function updateSupplier(input: z.infer<typeof updateSupplierSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = updateSupplierSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mengubah supplier.' };
  }

  const supplier = await prisma.supplier.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name, contact: normalizeOptionalText(parsed.data.contact) },
  });

  revalidatePath('/petshop/products');
  return { success: true, supplier };
}

export async function deleteSupplier(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || actorRole !== 'OWNER') {
    return { success: false, message: 'Hanya Owner yang dapat menghapus supplier.' };
  }

  const productCount = await prisma.product.count({ where: { supplierId: id } });
  if (productCount > 0) {
    return { success: false, message: `Tidak dapat menghapus supplier karena masih ada ${productCount} produk yang terhubung.` };
  }

  await prisma.supplier.delete({ where: { id } });

  revalidatePath('/petshop/products');
  return { success: true };
}

// PRODUCTS
export async function listProducts() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang melihat data ini.' };
  }

  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    include: { category: { select: { name: true } }, supplier: { select: { name: true } } },
  });

  return { success: true, products };
}

export async function createProduct(input: z.infer<typeof productSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = productSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang membuat produk.' };
  }

  if (parsed.data.sellPrice < Math.max(parsed.data.buyPrice, parsed.data.costPrice ?? 0)) {
    return { success: false, message: 'Harga jual tidak boleh di bawah harga pokok atau harga beli.' };
  }

  const normalizedSku = normalizeOptionalText(parsed.data.sku)?.toUpperCase() ?? null;
  const normalizedBarcode = normalizeOptionalText(parsed.data.barcode) ?? null;
  const conflict = await validateProductUniqueness(normalizedSku, normalizedBarcode);
  if (conflict) {
    return { success: false, message: `SKU atau barcode sudah digunakan oleh ${conflict.name}.` };
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: parsed.data.name,
        sku: normalizedSku,
        barcode: normalizedBarcode,
        brand: normalizeOptionalText(parsed.data.brand),
        description: normalizeOptionalText(parsed.data.description),
        categoryId: normalizeOptionalText(parsed.data.categoryId),
        supplierId: normalizeOptionalText(parsed.data.supplierId),
        unit: normalizeOptionalText(parsed.data.unit),
        buyPrice: parsed.data.buyPrice,
        sellPrice: parsed.data.sellPrice,
        costPrice: parsed.data.costPrice ?? parsed.data.buyPrice,
        stock: parsed.data.stock,
        minStock: parsed.data.minStock,
        maxStock: parsed.data.maxStock ?? null,
        status: parsed.data.status ?? 'ACTIVE',
        imageUrl: normalizeOptionalText(parsed.data.imageUrl),
        isArchived: (parsed.data.status ?? 'ACTIVE') === 'ARCHIVED',
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'CREATE',
        entity: 'Product',
        entityId: created.id,
        description: `Membuat produk ${created.name}`,
      },
    });

    return created;
  });

  revalidatePath('/petshop/products');
  revalidatePath('/petshop/inventory');
  return { success: true, product };
}

export async function updateProduct(input: z.infer<typeof updateProductSchema>) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);
  const parsed = updateProductSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: 'Data tidak valid.' };
  }

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mengubah produk.' };
  }

  if (parsed.data.sellPrice < Math.max(parsed.data.buyPrice, parsed.data.costPrice ?? 0)) {
    return { success: false, message: 'Harga jual tidak boleh di bawah harga pokok atau harga beli.' };
  }

  const normalizedSku = normalizeOptionalText(parsed.data.sku)?.toUpperCase() ?? null;
  const normalizedBarcode = normalizeOptionalText(parsed.data.barcode) ?? null;
  const conflict = await validateProductUniqueness(normalizedSku, normalizedBarcode, parsed.data.id);
  if (conflict) {
    return { success: false, message: `SKU atau barcode sudah digunakan oleh ${conflict.name}.` };
  }

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        sku: normalizedSku,
        barcode: normalizedBarcode,
        brand: normalizeOptionalText(parsed.data.brand),
        description: normalizeOptionalText(parsed.data.description),
        categoryId: normalizeOptionalText(parsed.data.categoryId),
        supplierId: normalizeOptionalText(parsed.data.supplierId),
        unit: normalizeOptionalText(parsed.data.unit),
        buyPrice: parsed.data.buyPrice,
        sellPrice: parsed.data.sellPrice,
        costPrice: parsed.data.costPrice ?? parsed.data.buyPrice,
        minStock: parsed.data.minStock,
        maxStock: parsed.data.maxStock ?? null,
        status: parsed.data.status ?? 'ACTIVE',
        imageUrl: normalizeOptionalText(parsed.data.imageUrl),
        isArchived: (parsed.data.status ?? 'ACTIVE') === 'ARCHIVED',
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'UPDATE',
        entity: 'Product',
        entityId: updated.id,
        description: `Memperbarui produk ${updated.name}`,
      },
    });

    return updated;
  });

  revalidatePath('/petshop/products');
  revalidatePath('/petshop/inventory');
  return { success: true, product };
}

export async function archiveProduct(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mengarsipkan produk.' };
  }

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: { status: 'ARCHIVED', isArchived: true },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'ARCHIVE',
        entity: 'Product',
        entityId: updated.id,
        description: `Mengarsipkan produk ${updated.name}`,
      },
    });

    return updated;
  });

  revalidatePath('/petshop/products');
  revalidatePath('/petshop/inventory');
  return { success: true, product };
}

export async function restoreProduct(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  if (!actorId || !isStaffRole(actorRole)) {
    return { success: false, message: 'Anda tidak berwenang mengembalikan produk.' };
  }

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: { status: 'ACTIVE', isArchived: false },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'RESTORE',
        entity: 'Product',
        entityId: updated.id,
        description: `Mengembalikan produk ${updated.name}`,
      },
    });

    return updated;
  });

  revalidatePath('/petshop/products');
  revalidatePath('/petshop/inventory');
  return { success: true, product };
}

export async function deleteProduct(id: string) {
  return archiveProduct(id);
}
