
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('GUEST', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "StoreOrderType" AS ENUM ('CARD_ONLY', 'CARD_PLUS_SAAS');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'CUSTOMER';

-- AlterTable
ALTER TABLE "NFCCard" ADD COLUMN     "editToken" TEXT;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "blankChipStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN     "billingAddress" JSONB,
ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "customerDocument" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "nfcWrittenAt" TIMESTAMP(3),
ADD COLUMN     "orderType" "StoreOrderType" NOT NULL DEFAULT 'CARD_ONLY',
ADD COLUMN     "packagedAt" TIMESTAMP(3),
ADD COLUMN     "qcPassedAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "stockConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "trackingCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NFCCard_editToken_key" ON "NFCCard"("editToken");

