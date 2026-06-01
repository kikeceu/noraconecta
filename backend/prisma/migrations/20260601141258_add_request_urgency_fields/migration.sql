-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "isUrgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mentionedDate" TEXT;
