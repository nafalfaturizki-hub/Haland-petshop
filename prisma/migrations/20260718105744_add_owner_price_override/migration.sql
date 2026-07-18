/*
  Warnings:

  - The `status` column on the `MedicalRecord` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "MedicalRecordStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');

-- DropForeignKey
ALTER TABLE "PetHotelBooking" DROP CONSTRAINT "PetHotelBooking_petId_fkey";

-- DropIndex
DROP INDEX "InvoiceItem_petHotelBookingId_idx";

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MedicalRecord" DROP COLUMN "status",
ADD COLUMN     "status" "MedicalRecordStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "PetHotelBooking" ADD COLUMN     "actualCheckInAt" TIMESTAMP(3),
ADD COLUMN     "actualCheckOutAt" TIMESTAMP(3),
ALTER COLUMN "petId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PetHotelRoom" ADD COLUMN     "pricePerNight" DOUBLE PRECISION NOT NULL DEFAULT 100000;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ownerPriceOverride" DOUBLE PRECISION,
ADD COLUMN     "ownerPriceOverrideReason" TEXT,
ADD COLUMN     "ownerPriceUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PetHotelBookingPet" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetHotelBookingPet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceChangeLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "changedById" TEXT,
    "previousPrice" DOUBLE PRECISION NOT NULL,
    "newPrice" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PetHotelBookingPet_petId_idx" ON "PetHotelBookingPet"("petId");

-- CreateIndex
CREATE UNIQUE INDEX "PetHotelBookingPet_bookingId_petId_key" ON "PetHotelBookingPet"("bookingId", "petId");

-- CreateIndex
CREATE INDEX "PriceChangeLog_productId_createdAt_idx" ON "PriceChangeLog"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "Appointment_customerId_date_idx" ON "Appointment"("customerId", "date");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_status_date_idx" ON "Appointment"("doctorId", "status", "date");

-- CreateIndex
CREATE INDEX "Appointment_status_date_idx" ON "Appointment"("status", "date");

-- CreateIndex
CREATE INDEX "AuditLog_userId_date_idx" ON "AuditLog"("userId", "date");

-- CreateIndex
CREATE INDEX "Invoice_customerId_status_idx" ON "Invoice"("customerId", "status");

-- CreateIndex
CREATE INDEX "Invoice_date_idx" ON "Invoice"("date");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Pet_customerId_idx" ON "Pet"("customerId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");

-- CreateIndex
CREATE INDEX "Product_isArchived_idx" ON "Product"("isArchived");

-- AddForeignKey
ALTER TABLE "PetHotelBooking" ADD CONSTRAINT "PetHotelBooking_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetHotelBookingPet" ADD CONSTRAINT "PetHotelBookingPet_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "PetHotelBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetHotelBookingPet" ADD CONSTRAINT "PetHotelBookingPet_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceChangeLog" ADD CONSTRAINT "PriceChangeLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceChangeLog" ADD CONSTRAINT "PriceChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
