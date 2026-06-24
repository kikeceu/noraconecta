-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN "licenseStatus" "LicenseStatus" NOT NULL DEFAULT 'PENDING';
