-- CreateTable
CREATE TABLE "BotSecurity" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspiciousCount" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSecurity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotSecurity_phone_key" ON "BotSecurity"("phone");

-- CreateIndex
CREATE INDEX "BotSecurity_phone_idx" ON "BotSecurity"("phone");

-- CreateIndex
CREATE INDEX "BotSecurity_blockedUntil_idx" ON "BotSecurity"("blockedUntil");
