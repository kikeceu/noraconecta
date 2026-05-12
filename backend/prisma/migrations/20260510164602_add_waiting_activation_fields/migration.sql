-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "waitingActivationSince" TIMESTAMP(3),
ADD COLUMN     "waitingUserConsent" BOOLEAN DEFAULT false;
