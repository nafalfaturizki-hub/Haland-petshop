#!/bin/bash

# Setup Script untuk HaLand PetCare
# Gunakan: bash scripts/setup.sh

set -e

echo "🚀 HaLand PetCare - Setup Script"
echo "================================"

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local tidak ditemukan"
    echo "📝 Copy .env.example ke .env.local"
    cp .env.example .env.local
    echo "✅ .env.local sudah dibuat. Silakan edit dengan credentials database Anda"
    exit 1
fi

echo ""
echo "📦 Step 1: Install dependencies"
npm install

echo ""
echo "🔧 Step 2: Generate Prisma Client"
npm run prisma:generate

echo ""
echo "🗄️  Step 3: Push database schema"
read -p "Lanjutkan dengan push schema ke database? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx prisma db push
    echo "✅ Database schema pushed"
else
    echo "⏭️  Skip database push"
fi

echo ""
echo "✨ Setup selesai!"
echo ""
echo "Langkah selanjutnya:"
echo "1. npm run dev       - Jalankan development server"
echo "2. Buka http://localhost:3000"
echo "3. Login dengan credentials dari database"
echo ""
echo "📚 Untuk informasi lebih lanjut, baca DEPLOYMENT.md"
