-- AlterTable
ALTER TABLE "MedicalRecord" ADD COLUMN "recordNumber" TEXT;
ALTER TABLE "MedicalRecord" ADD COLUMN "customerId" TEXT;
ALTER TABLE "MedicalRecord" ADD COLUMN "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MedicalRecord" ADD COLUMN "chiefComplaint" TEXT;
ALTER TABLE "MedicalRecord" ADD COLUMN "history" TEXT;
ALTER TABLE "MedicalRecord" ADD COLUMN "physicalExam" TEXT;
ALTER TABLE "MedicalRecord" ADD COLUMN "vitalSigns" TEXT;
ALTER TABLE "MedicalRecord" ADD COLUMN "weight" DOUBLE PRECISION;
ALTER TABLE "MedicalRecord" ADD COLUMN "temperature" DOUBLE PRECISION;
ALTER TABLE "MedicalRecord" ADD COLUMN "heartRate" INTEGER;
ALTER TABLE "MedicalRecord" ADD COLUMN "respiratoryRate" INTEGER;
ALTER TABLE "MedicalRecord" ADD COLUMN "notes" TEXT;
ALTER TABLE "MedicalRecord" ADD COLUMN "attachments" TEXT;
ALTER TABLE "MedicalRecord" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "MedicalRecord" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MedicalRecord" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MedicalRecord" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "MedicalRecord"
SET "customerId" = COALESCE(
  (SELECT "customerId" FROM "Appointment" WHERE "Appointment"."id" = "MedicalRecord"."appointmentId"),
  ''
);

UPDATE "MedicalRecord"
SET "recordNumber" = CONCAT('MR-', TO_CHAR("date", 'YYYYMMDD'), '-', FLOOR(RANDOM() * 9000 + 1000));

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "MedicalRecord_recordNumber_key" ON "MedicalRecord"("recordNumber");
CREATE INDEX "MedicalRecord_customerId_date_idx" ON "MedicalRecord"("customerId", "date");
CREATE INDEX "MedicalRecord_petId_date_idx" ON "MedicalRecord"("petId", "date");
CREATE INDEX "MedicalRecord_doctorId_date_idx" ON "MedicalRecord"("doctorId", "date");
