-- AlterEnum
ALTER TYPE "StoreOrderStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN     "confirmationEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "deliveredEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "disputeStatus" TEXT,
ADD COLUMN     "disputedAt" TIMESTAMP(3),
ADD COLUMN     "refundAmountCents" INTEGER,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "shippedEmailSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StoreOrderNote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreOrderNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreOrderNote_orderId_createdAt_idx" ON "StoreOrderNote"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "StoreOrderNote" ADD CONSTRAINT "StoreOrderNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "StoreOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
