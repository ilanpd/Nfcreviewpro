-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "heroVideoUrl" TEXT,
    "storeProductOverrides" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByEmail" TEXT,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

