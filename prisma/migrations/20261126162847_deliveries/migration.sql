-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('HAND', 'WHATSAPP', 'EMAIL', 'COURIER', 'PLATFORM', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocType" ADD VALUE 'CERTIFICATE';
ALTER TYPE "DocType" ADD VALUE 'LETTER';
ALTER TYPE "DocType" ADD VALUE 'PAYMENT_RECEIPT';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "transactionId" TEXT;

-- AlterTable
ALTER TABLE "Stage" ADD COLUMN     "readyForDelivery" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "transactionId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientIdNo" TEXT,
    "recipientPhone" TEXT,
    "items" TEXT,
    "note" TEXT,
    "deliveredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DeliveryDocuments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DeliveryDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_number_key" ON "Delivery"("number");

-- CreateIndex
CREATE INDEX "Delivery_transactionId_idx" ON "Delivery"("transactionId");

-- CreateIndex
CREATE INDEX "Delivery_deliveredAt_idx" ON "Delivery"("deliveredAt");

-- CreateIndex
CREATE INDEX "_DeliveryDocuments_B_index" ON "_DeliveryDocuments"("B");

-- CreateIndex
CREATE INDEX "Document_transactionId_idx" ON "Document"("transactionId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeliveryDocuments" ADD CONSTRAINT "_DeliveryDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeliveryDocuments" ADD CONSTRAINT "_DeliveryDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

