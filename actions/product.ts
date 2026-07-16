'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canPerformAction, isStaffRole } from '@/lib/permissions';
import { getAuthorizedRoutes } from '@/lib/permission-matrix';
import { getActorRole, getActorId, normalizeOptionalText } from '@/lib/utils';

export type ParsedProductRow = {
  name: string;
  sku?: string;
  barcode?: string;
  brand?: string;
  categoryName?: string;
  supplierName?: string;
  buyPrice?: string;
  sellPrice?: string;
  costPrice?: string;
  stock?: string;
  minStock?: string;
  maxStock?: string;
  unit?: string;
  status?: string;
  description?: string;
  imageUrl?: string;
};

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

const importProductRowSchema = productSchema.extend({
  name: z.string().trim().min(1, 'Nama produk wajib diisi.').max(200),
  categoryName: z.string().trim().optional().or(z.literal('')),
  supplierName: z.string().trim().optional().or(z.literal('')),
  buyPrice: z.string().trim().optional().or(z.literal('')),
  sellPrice: z.string().trim().optional().or(z.literal('')),
  costPrice: z.string().trim().optional().or(z.literal('')),
  stock: z.string().trim().optional().or(z.literal('')),
  minStock: z.string().trim().optional().or(z.literal('')),
  maxStock: z.string().trim().optional().or(z.literal('')),
  unit: z.string().trim().optional().or(z.literal('')),
  status: z.string().trim().optional().or(z.literal('ACTIVE')),
}).transform((row) => ({
  ...row,
  buyPrice: Number(row.buyPrice ?? 0),
  sellPrice: Number(row.sellPrice ?? 0),
  costPrice: Number(row.costPrice ?? row.buyPrice ?? 0),
  stock: Number(row.stock ?? 0),
  minStock: Number(row.minStock ?? 0),
  maxStock: row.maxStock ? Number(row.maxStock) : undefined,
  status: (row.status ?? 'ACTIVE') === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
  categoryId: row.categoryName || undefined,
  supplierId: row.supplierName || undefined,
}));

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



function ensureAccess(actorRole: string | undefined, action: 'create' | 'read' | 'update' | 'delete') {
  if (!actorRole) {
    return { allowed: false, message: 'Tidak terautentikasi.' };
  }

  if (canPerformAction(actorRole, 'petshop', action)) {
    return { allowed: true };
  }

  return { allowed: false, message: 'Anda tidak berwenang mengelola data petshop.' };
}

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

  if (!actorId || !isStaffRole(actorRole) || !getAuthorizedRoutes(actorRole).includes('petshop')) {
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

  const permission = ensureAccess(actorRole, 'create');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
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

  const permission = ensureAccess(actorRole, 'update');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
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

  const permission = ensureAccess(actorRole, 'delete');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
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

  const permission = ensureAccess(actorRole, 'read');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
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

  const permission = ensureAccess(actorRole, 'create');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
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

  const permission = ensureAccess(actorRole, 'update');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
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

  const permission = ensureAccess(actorRole, 'delete');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
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
export async function listProducts(includeArchived = false) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  const permission = ensureAccess(actorRole, 'read');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
  }

  const products = await prisma.product.findMany({
    where: includeArchived ? undefined : { isArchived: false },
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

  const permission = ensureAccess(actorRole, 'create');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
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

  const permission = ensureAccess(actorRole, 'update');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
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

export async function exportProductsToCsv() {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  const permission = ensureAccess(actorRole, 'read');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
  }

  const products = await prisma.product.findMany({
    where: { isArchived: false },
    orderBy: { name: 'asc' },
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });

  const rows = products.map((product) => ({
    name: product.name,
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    brand: product.brand ?? '',
    categoryName: product.category?.name ?? '',
    supplierName: product.supplier?.name ?? '',
    buyPrice: product.buyPrice,
    sellPrice: product.sellPrice,
    stock: product.stock,
    minStock: product.minStock,
    maxStock: product.maxStock ?? '',
    unit: product.unit ?? '',
    status: product.status,
  }));

  return { success: true, rows };
}

export async function importProductsFromCsv(rows: ParsedProductRow[]) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  const permission = ensureAccess(actorRole, 'create');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
  }

  if (actorRole === 'DOKTER') {
    return { success: false, message: 'Dokter tidak dapat mengimpor produk.' };
  }

  const normalizedRows: Array<{ row: ParsedProductRow; parsed?: z.infer<typeof importProductRowSchema>; error?: string }> = [];
  for (const row of rows) {
    const parsed = importProductRowSchema.safeParse(row);
    if (!parsed.success) {
      normalizedRows.push({ row, error: parsed.error.issues[0]?.message ?? 'Data tidak valid.' });
      continue;
    }
    normalizedRows.push({ row, parsed: parsed.data });
  }

  const results = { created: 0, updated: 0, failed: 0, failures: [] as Array<{ row: number; reason: string }> };

  for (let index = 0; index < normalizedRows.length; index += 50) {
    const batch = normalizedRows.slice(index, index + 50);
    await prisma.$transaction(async (tx) => {
      for (const [batchIndex, entry] of batch.entries()) {
        const rowNumber = index + batchIndex + 2;
        if (entry.error) {
          results.failed += 1;
          results.failures.push({ row: rowNumber, reason: entry.error });
          continue;
        }

        const payload = entry.parsed;
        if (!payload) {
          results.failed += 1;
          results.failures.push({ row: rowNumber, reason: 'Data produk tidak valid.' });
          continue;
        }

        const normalizedSku = normalizeOptionalText(payload.sku)?.toUpperCase() ?? null;
        const normalizedBarcode = normalizeOptionalText(payload.barcode) ?? null;
        const status = payload.status === 'ARCHIVED' ? 'ARCHIVED' as const : 'ACTIVE' as const;

        if (payload.sellPrice < Math.max(payload.buyPrice, payload.costPrice ?? 0)) {
          results.failed += 1;
          results.failures.push({ row: rowNumber, reason: 'Harga jual tidak boleh di bawah harga pokok atau harga beli.' });
          continue;
        }

        const category = payload.categoryName ? await tx.productCategory.findFirst({ where: { name: { equals: payload.categoryName.trim(), mode: 'insensitive' } } }) : null;
        if (payload.categoryName && !category) {
          results.failed += 1;
          results.failures.push({ row: rowNumber, reason: 'kategori tidak ditemukan' });
          continue;
        }

        const supplier = payload.supplierName ? await tx.supplier.findFirst({ where: { name: { equals: payload.supplierName.trim(), mode: 'insensitive' } } }) : null;
        if (payload.supplierName && !supplier) {
          results.failed += 1;
          results.failures.push({ row: rowNumber, reason: 'supplier tidak ditemukan' });
          continue;
        }

        const existing = await tx.product.findFirst({
          where: {
            OR: [
              ...(normalizedSku ? [{ sku: normalizedSku }] : []),
              ...(normalizedBarcode ? [{ barcode: normalizedBarcode }] : []),
            ],
          },
          select: { id: true, name: true },
        });

        if (existing) {
          await tx.product.update({
            where: { id: existing.id },
            data: {
              name: payload.name,
              sku: normalizedSku,
              barcode: normalizedBarcode,
              brand: normalizeOptionalText(payload.brand),
              description: normalizeOptionalText(payload.description),
              categoryId: category?.id ?? null,
              supplierId: supplier?.id ?? null,
              unit: normalizeOptionalText(payload.unit),
              buyPrice: payload.buyPrice,
              sellPrice: payload.sellPrice,
              costPrice: payload.costPrice ?? payload.buyPrice,
              stock: payload.stock,
              minStock: payload.minStock,
              maxStock: payload.maxStock ?? null,
              status,
              imageUrl: normalizeOptionalText(payload.imageUrl),
              isArchived: status === 'ARCHIVED',
            },
          });
          results.updated += 1;
        } else {
          await tx.product.create({
            data: {
              name: payload.name,
              sku: normalizedSku,
              barcode: normalizedBarcode,
              brand: normalizeOptionalText(payload.brand),
              description: normalizeOptionalText(payload.description),
              categoryId: category?.id ?? null,
              supplierId: supplier?.id ?? null,
              unit: normalizeOptionalText(payload.unit),
              buyPrice: payload.buyPrice,
              sellPrice: payload.sellPrice,
              costPrice: payload.costPrice ?? payload.buyPrice,
              stock: payload.stock,
              minStock: payload.minStock,
              maxStock: payload.maxStock ?? null,
              status,
              imageUrl: normalizeOptionalText(payload.imageUrl),
              isArchived: status === 'ARCHIVED',
            },
          });
          results.created += 1;
        }
      }
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action: 'IMPORT',
      entity: 'Product',
      entityId: null,
      description: `Impor produk massal: ${results.created} dibuat, ${results.updated} diperbarui, ${results.failed} gagal`,
    },
  });

  revalidatePath('/petshop/products');
  revalidatePath('/petshop/inventory');

  return { success: true, result: results };
}

export async function archiveProduct(id: string) {
  const session = await auth();
  const actorRole = getActorRole(session);
  const actorId = getActorId(session);

  const permission = ensureAccess(actorRole, 'update');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
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

  const permission = ensureAccess(actorRole, 'update');
  if (!actorId || !permission.allowed || !getAuthorizedRoutes(actorRole).includes('petshop')) {
    return { success: false, message: permission.message };
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
