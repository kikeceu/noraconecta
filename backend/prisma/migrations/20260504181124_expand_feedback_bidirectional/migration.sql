/*
  Warnings:

  - You are about to drop the column `comment` on the `Feedback` table. All the data in the column will be lost.
  - You are about to drop the column `workCompleted` on the `Feedback` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Feedback` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Feedback" DROP COLUMN "comment",
DROP COLUMN "workCompleted",
ADD COLUMN     "communicationRating" INTEGER,
ADD COLUMN     "priceFairnessRating" INTEGER,
ADD COLUMN     "professionalComment" TEXT,
ADD COLUMN     "punctualityRating" INTEGER,
ADD COLUMN     "qualityRating" INTEGER,
ADD COLUMN     "ratedByProfessionalAt" TIMESTAMP(3),
ADD COLUMN     "ratedByUserAt" TIMESTAMP(3),
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "requestClarityRating" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userAvailabilityRating" INTEGER,
ADD COLUMN     "userComment" TEXT,
ADD COLUMN     "userTreatmentRating" INTEGER,
ADD COLUMN     "wouldServeAgain" BOOLEAN,
ALTER COLUMN "wouldRecommend" DROP NOT NULL;
