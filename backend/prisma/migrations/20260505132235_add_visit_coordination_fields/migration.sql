-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "clientAddress" TEXT,
ADD COLUMN     "clientLatitude" DOUBLE PRECISION,
ADD COLUMN     "clientLongitude" DOUBLE PRECISION,
ADD COLUMN     "coordinationStatus" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3);
