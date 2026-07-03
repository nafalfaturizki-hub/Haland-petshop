#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Verifikasi koneksi database dan Prisma setup
 */

const path = require('path');
const fs = require('fs');

// Check if .env.local exists
if (!fs.existsSync(path.join(process.cwd(), '.env.local'))) {
  console.error('❌ .env.local tidak ditemukan');
  console.error('📝 Buat .env.local dari .env.example terlebih dahulu');
  process.exit(1);
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

async function testDatabase() {
  console.log('🧪 Database Connection Test');
  console.log('==========================\n');

  const prisma = new PrismaClient({
    log: ['error'],
  });

  try {
    // Test connection
    console.log('1️⃣  Testing database connection...');
    await prisma.$executeRaw`SELECT 1`;
    console.log('✅ Database connection successful\n');

    // Check Prisma schema
    console.log('2️⃣  Checking Prisma setup...');
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables 
      WHERE schemaname='public'
      ORDER BY tablename
    `;
    console.log(`✅ Found ${tables.length} tables\n`);

    // Count records
    console.log('3️⃣  Checking data...');
    
    const userCount = await prisma.user.count();
    console.log(`   Users: ${userCount}`);
    
    const customerCount = await prisma.customer.count();
    console.log(`   Customers: ${customerCount}`);
    
    const petCount = await prisma.pet.count();
    console.log(`   Pets: ${petCount}`);
    
    console.log('');

    // Environment info
    console.log('4️⃣  Environment Configuration:');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Database: ${process.env.DATABASE_URL ? 'Configured ✅' : 'Missing ❌'}`);
    console.log(`   NextAuth Secret: ${process.env.NEXTAUTH_SECRET ? 'Configured ✅' : 'Missing ❌'}`);
    console.log(`   NextAuth URL: ${process.env.NEXTAUTH_URL || 'Not set (will use default)'}`);
    console.log('');

    // Summary
    console.log('✨ All tests passed! Database is ready.\n');
    console.log('📝 Next steps:');
    console.log('   1. npm run dev          - Start development server');
    console.log('   2. npm run prisma:seed  - Load sample data');
    console.log('   3. npm run db:studio    - Open Prisma Studio\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Database test failed\n');
    console.error('Error:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Check DATABASE_URL in .env.local');
    console.error('2. Verify Neon project is active');
    console.error('3. Check network connectivity');
    console.error('4. Run: npm run prisma:generate\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
