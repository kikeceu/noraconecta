-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "userLatitude" DOUBLE PRECISION,
ADD COLUMN     "userLongitude" DOUBLE PRECISION;
