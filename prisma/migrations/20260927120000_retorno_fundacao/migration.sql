-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('ISSUED', 'REDEEMED', 'EXPIRED', 'VOIDED');

-- CreateEnum
CREATE TYPE "CampaignOrigin" AS ENUM ('USER', 'SYSTEM_DIRECT', 'SYSTEM_RETURN');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "origin" "CampaignOrigin" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "returnPilotEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscriptionStatusChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PrivateFeedback" ADD COLUMN     "visitId" TEXT,
ALTER COLUMN "ratingEventId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "returnOfferEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "visitorId" TEXT;

-- CreateTable
CREATE TABLE "RewardOffer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "windowDays" INTEGER NOT NULL DEFAULT 14,
    "cooldownDays" INTEGER NOT NULL DEFAULT 30,
    "pinHash" TEXT,
    "pinUpdatedAt" TIMESTAMP(3),
    "primaryUrl" TEXT,
    "dailyCap" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "cardId" TEXT,
    "visitId" TEXT,
    "visitorId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidedReason" TEXT,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardOffer_companyId_key" ON "RewardOffer"("companyId");

-- CreateIndex
CREATE INDEX "Voucher_companyId_status_expiresAt_idx" ON "Voucher"("companyId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "Voucher_companyId_visitorId_issuedAt_idx" ON "Voucher"("companyId", "visitorId", "issuedAt");

-- CreateIndex
CREATE INDEX "Voucher_companyId_issuedAt_idx" ON "Voucher"("companyId", "issuedAt");

-- CreateIndex
CREATE INDEX "Voucher_companyId_redeemedAt_idx" ON "Voucher"("companyId", "redeemedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_companyId_code_key" ON "Voucher"("companyId", "code");

-- CreateIndex
CREATE INDEX "PrivateFeedback_visitId_idx" ON "PrivateFeedback"("visitId");

-- CreateIndex
CREATE INDEX "Visit_companyId_visitorId_idx" ON "Visit"("companyId", "visitorId");

-- AddForeignKey
ALTER TABLE "PrivateFeedback" ADD CONSTRAINT "PrivateFeedback_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardOffer" ADD CONSTRAINT "RewardOffer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "RewardOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "NFCCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Limites que o serviço já valida (Zod), repetidos no banco como última defesa:
-- nenhum caminho de código, script ou edição manual deixa uma janela de 0 dias,
-- uma carência negativa ou um teto diário zerado.
ALTER TABLE "RewardOffer" ADD CONSTRAINT "RewardOffer_windowDays_range" CHECK ("windowDays" BETWEEN 1 AND 90);
ALTER TABLE "RewardOffer" ADD CONSTRAINT "RewardOffer_cooldownDays_range" CHECK ("cooldownDays" BETWEEN 0 AND 365);
ALTER TABLE "RewardOffer" ADD CONSTRAINT "RewardOffer_dailyCap_positive" CHECK ("dailyCap" IS NULL OR "dailyCap" > 0);

-- Preenchimento: o redirecionamento inicial que a compra do cartão avulso já
-- criou passa a ser reconhecido como campanha do sistema. Idempotente e só
-- toca linhas criadas automaticamente pelo provisionamento da loja.
UPDATE "Campaign"
SET "origin" = 'SYSTEM_DIRECT'
WHERE "origin" = 'USER'
  AND "name" LIKE 'Direcionamento inicial%'
  AND "description" LIKE 'Criada automaticamente ao provisionar o pedido da loja%';
