-- CreateTable
CREATE TABLE "UserRequestSession" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "currentStep" TEXT,
    "tempData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRequestSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRequestSession_requestId_key" ON "UserRequestSession"("requestId");

-- CreateIndex
CREATE INDEX "UserRequestSession_phone_idx" ON "UserRequestSession"("phone");
