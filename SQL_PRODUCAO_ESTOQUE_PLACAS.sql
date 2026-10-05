-- ============================================================================
-- ESTOQUE DE PLACAS (ADR-092) — rode UMA vez, no SQL Editor do Supabase de PRODUCAO.
--
-- O que faz: cria 5 tabelas novas e 2 tipos (modelos de placa, versoes de arte,
-- lotes, placas e a trilha de eventos). E 100% ADITIVO: nao altera, nao apaga e
-- nao le nenhuma tabela existente.
--
-- Tudo roda dentro de uma transacao: se qualquer linha falhar, NADA e aplicado.
-- A ultima parte registra a migracao no historico do Prisma (_prisma_migrations),
-- que e o que o "npm run predeploy" confere antes de qualquer deploy.
--
-- Migracao: 20261004170000_estoque_placas
-- Checksum (sha256 do migration.sql): 66dd00ad10cba738ed18244320b0e0ca3b6157b70d5310702d48bf7032c1ba4d
-- ============================================================================

BEGIN;

-- CreateEnum
CREATE TYPE "PlateStatus" AS ENUM ('GENERATED', 'IN_PRODUCTION', 'VERIFIED', 'DEFECTIVE', 'VOIDED');

-- CreateEnum
CREATE TYPE "PlateBatchOrigin" AS ENUM ('STOCK', 'ORDERS');

-- CreateTable
CREATE TABLE "PlateModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minStock" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlateModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlateModelVersion" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "note" TEXT,
    "widthMm" DOUBLE PRECISION NOT NULL,
    "heightMm" DOUBLE PRECISION NOT NULL,
    "bleedMm" DOUBLE PRECISION NOT NULL,
    "background" BYTEA,
    "backgroundMime" TEXT,
    "backgroundName" TEXT,
    "backgroundWidthPx" INTEGER,
    "backgroundHeightPx" INTEGER,
    "qrXMm" DOUBLE PRECISION NOT NULL,
    "qrYMm" DOUBLE PRECISION NOT NULL,
    "qrSizeMm" DOUBLE PRECISION NOT NULL,
    "qrErrorCorrection" TEXT NOT NULL DEFAULT 'M',
    "qrDarkColor" TEXT NOT NULL DEFAULT '#000000',
    "qrLightColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "serialEnabled" BOOLEAN NOT NULL DEFAULT true,
    "serialXMm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serialYMm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serialFontPt" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "serialColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlateModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlateBatch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "origin" "PlateBatchOrigin" NOT NULL DEFAULT 'STOCK',
    "orderIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quantity" INTEGER NOT NULL,
    "supplier" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "PlateBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plate" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "serial" TEXT NOT NULL,
    "uniqueCode" TEXT NOT NULL,
    "status" "PlateStatus" NOT NULL DEFAULT 'GENERATED',
    "nfcChecked" BOOLEAN NOT NULL DEFAULT false,
    "qrChecked" BOOLEAN NOT NULL DEFAULT false,
    "serialChecked" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "defectReason" TEXT,
    "cardId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlateEvent" (
    "id" TEXT NOT NULL,
    "plateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" "PlateStatus",
    "toStatus" "PlateStatus",
    "note" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlateModelVersion_modelId_version_key" ON "PlateModelVersion"("modelId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PlateBatch_code_key" ON "PlateBatch"("code");

-- CreateIndex
CREATE INDEX "PlateBatch_modelId_idx" ON "PlateBatch"("modelId");

-- CreateIndex
CREATE INDEX "PlateBatch_createdAt_idx" ON "PlateBatch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Plate_serial_key" ON "Plate"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "Plate_uniqueCode_key" ON "Plate"("uniqueCode");

-- CreateIndex
CREATE UNIQUE INDEX "Plate_cardId_key" ON "Plate"("cardId");

-- CreateIndex
CREATE INDEX "Plate_batchId_status_idx" ON "Plate"("batchId", "status");

-- CreateIndex
CREATE INDEX "Plate_modelId_status_idx" ON "Plate"("modelId", "status");

-- CreateIndex
CREATE INDEX "Plate_status_idx" ON "Plate"("status");

-- CreateIndex
CREATE INDEX "PlateEvent_plateId_createdAt_idx" ON "PlateEvent"("plateId", "createdAt");

-- CreateIndex
CREATE INDEX "PlateEvent_createdAt_idx" ON "PlateEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "PlateModelVersion" ADD CONSTRAINT "PlateModelVersion_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "PlateModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlateBatch" ADD CONSTRAINT "PlateBatch_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "PlateModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlateBatch" ADD CONSTRAINT "PlateBatch_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "PlateModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plate" ADD CONSTRAINT "Plate_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PlateBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plate" ADD CONSTRAINT "Plate_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "PlateModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plate" ADD CONSTRAINT "Plate_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "NFCCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlateEvent" ADD CONSTRAINT "PlateEvent_plateId_fkey" FOREIGN KEY ("plateId") REFERENCES "Plate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Registro no historico do Prisma (evita que um "prisma migrate deploy" futuro tente reaplicar).
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text, '66dd00ad10cba738ed18244320b0e0ca3b6157b70d5310702d48bf7032c1ba4d', now(), '20261004170000_estoque_placas', NULL, now(), 1);

COMMIT;

-- Conferencia (opcional): deve devolver 5 linhas.
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public' AND table_name LIKE 'Plate%' ORDER BY table_name;
