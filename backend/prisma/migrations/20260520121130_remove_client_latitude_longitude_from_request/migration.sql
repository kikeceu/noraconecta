/*
  Warnings:

  - You are about to drop the column `clientLatitude` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `clientLongitude` on the `Request` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Request" DROP COLUMN "clientLatitude",
DROP COLUMN "clientLongitude";
