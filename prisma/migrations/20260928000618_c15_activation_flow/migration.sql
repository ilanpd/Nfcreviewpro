-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ALTER COLUMN "whatsapp" DROP NOT NULL,
ALTER COLUMN "googleReviewUrl" DROP NOT NULL;
