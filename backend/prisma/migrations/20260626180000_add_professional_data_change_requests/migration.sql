-- CreateTable
CREATE TABLE "ProfessionalDataChangeRequest" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "changedFields" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "ProfessionalDataChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfessionalDataChangeRequest_professionalId_idx" ON "ProfessionalDataChangeRequest"("professionalId");

-- CreateIndex
CREATE INDEX "ProfessionalDataChangeRequest_status_idx" ON "ProfessionalDataChangeRequest"("status");

-- AddForeignKey
ALTER TABLE "ProfessionalDataChangeRequest" ADD CONSTRAINT "ProfessionalDataChangeRequest_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
