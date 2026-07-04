-- Add productId to InvoiceItem and create foreign key relation
ALTER TABLE "InvoiceItem" ADD COLUMN "productId" TEXT NULL;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
