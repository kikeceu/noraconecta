/*
  Warnings:

  - A unique constraint covering the columns `[phone,role]` on the table `BotSession` will be added. If there are existing duplicate values, this will fail.
  - Made the column `role` on table `BotSession` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "BotSession_phone_key";

-- AlterTable
ALTER TABLE "BotSession" ALTER COLUMN "role" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BotSession_phone_role_key" ON "BotSession"("phone", "role");
