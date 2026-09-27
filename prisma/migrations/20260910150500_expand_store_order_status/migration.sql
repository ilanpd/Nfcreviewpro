-- AlterEnum
BEGIN;
CREATE TYPE "StoreOrderStatus_new" AS ENUM ('PENDING_PAYMENT', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELED');
ALTER TABLE "public"."StoreOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "StoreOrder" ALTER COLUMN "status" TYPE "StoreOrderStatus_new" USING ("status"::text::"StoreOrderStatus_new");
ALTER TYPE "StoreOrderStatus" RENAME TO "StoreOrderStatus_old";
ALTER TYPE "StoreOrderStatus_new" RENAME TO "StoreOrderStatus";
DROP TYPE "public"."StoreOrderStatus_old";
ALTER TABLE "StoreOrder" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
COMMIT;

-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN     "companyId" TEXT;

-- CreateIndex
CREATE INDEX "StoreOrder_companyId_idx" ON "StoreOrder"("companyId");

