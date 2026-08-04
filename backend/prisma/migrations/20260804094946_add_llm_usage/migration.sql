-- CreateTable
CREATE TABLE "LLMUsage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "userId" TEXT,
    "promptKey" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LLMUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LLMUsage_createdAt_idx" ON "LLMUsage"("createdAt");

-- CreateIndex
CREATE INDEX "LLMUsage_promptKey_idx" ON "LLMUsage"("promptKey");

-- CreateIndex
CREATE INDEX "LLMUsage_model_idx" ON "LLMUsage"("model");

-- CreateIndex
CREATE INDEX "LLMUsage_requestId_idx" ON "LLMUsage"("requestId");

-- CreateIndex
CREATE INDEX "LLMUsage_userId_idx" ON "LLMUsage"("userId");

-- AddForeignKey
ALTER TABLE "LLMUsage" ADD CONSTRAINT "LLMUsage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LLMUsage" ADD CONSTRAINT "LLMUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
