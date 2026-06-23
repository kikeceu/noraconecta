-- AlterTable Category: add license requirement fields
ALTER TABLE "Category" ADD COLUMN "requiresLicense" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Category" ADD COLUMN "licenseLabel" TEXT;

-- AlterTable Professional: add license declaration fields
ALTER TABLE "Professional" ADD COLUMN "declaredHasLicense" BOOLEAN;
ALTER TABLE "Professional" ADD COLUMN "licenseUrl" TEXT;
