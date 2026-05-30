-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "sentimentAnalysis" JSONB;

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "abuseWarningCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "availabilityStructured" JSONB,
ADD COLUMN     "lastAbuseCheckAt" TIMESTAMP(3),
ADD COLUMN     "problemTypeStats" JSONB;

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "problemType" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "abuseWarningCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAbuseCheckAt" TIMESTAMP(3);
