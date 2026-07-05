const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const defaultPin = '123456';

  // Create default owner user
  const ownerPinHash = await bcrypt.hash(defaultPin, 10);
  
  const owner = await prisma.user.upsert({
    where: { username: 'owner' },
    update: {},
    create: {
      username: 'owner',
      name: 'Owner HaLand',
      pinHash: ownerPinHash,
      role: 'OWNER',
      isActive: true,
      mustChangePin: true,
    },
  });

  console.log('✅ Owner user created:', owner.username);

  // Create admin user
  const adminPinHash = await bcrypt.hash(defaultPin, 10);
  
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      name: 'Admin Klinik',
      pinHash: adminPinHash,
      role: 'ADMIN_KLINIK',
      isActive: true,
      mustChangePin: true,
      createdById: owner.id,
    },
  });

  console.log('✅ Admin user created:', admin.username);

  // Create sample doctor
  const doctorPinHash = await bcrypt.hash(defaultPin, 10);
  
  const doctor = await prisma.user.upsert({
    where: { username: 'dr_budi' },
    update: {},
    create: {
      username: 'dr_budi',
      name: 'Dr. Budi Santoso',
      pinHash: doctorPinHash,
      role: 'DOKTER',
      isActive: true,
      mustChangePin: true,
      createdById: admin.id,
    },
  });

  console.log('✅ Doctor user created:', doctor.username);

  // Create a sample customer user for portal access
  const customerUserPinHash = await bcrypt.hash(defaultPin, 10);
  const customerUser = await prisma.user.upsert({
    where: { username: 'customer' },
    update: {},
    create: {
      username: 'customer',
      name: 'Customer Demo',
      pinHash: customerUserPinHash,
      role: 'CUSTOMER',
      isActive: true,
      mustChangePin: true,
      createdById: owner.id,
    },
  });

  console.log('✅ Customer user created:', customerUser.username);

  // Create sample customer
  const customer = await prisma.customer.upsert({
    where: { id: 'cust-001' },
    update: {},
    create: {
      id: 'cust-001',
      userId: customerUser.id,
      name: 'John Doe',
      phone: '081234567890',
      address: 'Jakarta, Indonesia',
      notes: 'Pelanggan setia',
    },
  });

  console.log('✅ Sample customer created:', customer.name);

  // Create sample pets
  const pet1 = await prisma.pet.upsert({
    where: { id: 'pet-001' },
    update: {},
    create: {
      id: 'pet-001',
      customerId: customer.id,
      name: 'Fluffy',
      species: 'Kucing',
      breed: 'Persia',
      gender: 'Female',
      birthDate: new Date('2022-01-15'),
    },
  });

  const pet2 = await prisma.pet.upsert({
    where: { id: 'pet-002' },
    update: {},
    create: {
      id: 'pet-002',
      customerId: customer.id,
      name: 'Max',
      species: 'Anjing',
      breed: 'Golden Retriever',
      gender: 'Male',
      birthDate: new Date('2021-06-20'),
    },
  });

  console.log('✅ Sample pets created: ', pet1.name, '&', pet2.name);

  // Create product categories
  const categoryFood = await prisma.productCategory.upsert({
    where: { id: 'cat-food' },
    update: {},
    create: {
      id: 'cat-food',
      name: 'Makanan Hewan',
    },
  });

  await prisma.productCategory.upsert({
    where: { id: 'cat-medicine' },
    update: {},
    create: {
      id: 'cat-medicine',
      name: 'Obat-obatan',
    },
  });

  console.log('✅ Product categories created');

  // Create supplier
  const supplier = await prisma.supplier.upsert({
    where: { id: 'sup-001' },
    update: {},
    create: {
      id: 'sup-001',
      name: 'PT Supplier Hewan Sehat',
      contact: '021-9999999',
    },
  });

  console.log('✅ Sample supplier created:', supplier.name);

  // Create sample products
  await prisma.product.upsert({
    where: { id: 'prod-001' },
    update: {},
    create: {
      id: 'prod-001',
      name: 'Cat Food Premium',
      sku: 'CF-001',
      barcode: '8888888888888',
      categoryId: categoryFood.id,
      supplierId: supplier.id,
      buyPrice: 50000,
      sellPrice: 75000,
      stock: 50,
      minStock: 10,
    },
  });

  await prisma.product.upsert({
    where: { id: 'prod-002' },
    update: {},
    create: {
      id: 'prod-002',
      name: 'Dog Food Premium',
      sku: 'DF-001',
      barcode: '7777777777777',
      categoryId: categoryFood.id,
      supplierId: supplier.id,
      buyPrice: 60000,
      sellPrice: 85000,
      stock: 30,
      minStock: 10,
    },
  });

  console.log('✅ Sample products created');

  // Create pet hotel rooms
  await prisma.petHotelRoom.upsert({
    where: { id: 'room-001' },
    update: {},
    create: {
      id: 'room-001',
      name: 'Deluxe Suite A',
      status: 'AVAILABLE',
    },
  });

  await prisma.petHotelRoom.upsert({
    where: { id: 'room-002' },
    update: {},
    create: {
      id: 'room-002',
      name: 'Standard Room B',
      status: 'AVAILABLE',
    },
  });

  console.log('✅ Pet hotel rooms created');

  // Create clinic settings
  const settings = await prisma.settings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      clinicName: 'HaLand PetCare Clinic',
      address: 'Jakarta, Indonesia',
      phone: '021-1234567',
    },
  });

  console.log('✅ Clinic settings created:', settings.clinicName);

  console.log('');
  console.log('✨ Seeding completed successfully!');
  console.log('');
  console.log('📝 Default User Credentials:');
  console.log(`   Owner    - Username: owner     | PIN: ${defaultPin}`);
  console.log(`   Admin    - Username: admin     | PIN: ${defaultPin}`);
  console.log(`   Doctor   - Username: dr_budi   | PIN: ${defaultPin}`);
  console.log(`   Customer - Username: customer  | PIN: ${defaultPin}`);
  console.log('');
  console.log('⚠️  GANTI PIN SETELAH PERTAMA KALI LOGIN');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
