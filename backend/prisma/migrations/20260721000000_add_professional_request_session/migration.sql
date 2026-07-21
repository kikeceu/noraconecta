-- CreateTable
CREATE TABLE "ProfessionalRequestSession" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "currentStep" TEXT NOT NULL,
    "tempData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalRequestSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalRequestSession_requestId_key" ON "ProfessionalRequestSession"("requestId");

-- CreateIndex
CREATE INDEX "ProfessionalRequestSession_phone_idx" ON "ProfessionalRequestSession"("phone");
