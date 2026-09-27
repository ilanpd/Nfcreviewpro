-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN     "provisionedAt" TIMESTAMP(3),
ADD COLUMN     "provisionedCardIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

