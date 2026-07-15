-- CreateEnum
CREATE TYPE "ProfessionalEventType" AS ENUM ('PANEL_INTRO_ACCEPTANCE', 'PANEL_INTRO_COMPLETION', 'DIDI_VERIFICATION_SENT', 'DIDI_VERIFICATION_COMPLETED', 'WHATASPP_FLOW_REGISTERED', 'MERCADO_PAGO_CONNECTED', 'FIRST_PAYMENT_RECEIVED');

-- CreateTable
CREATE TABLE "ProfessionalEvent" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "type" "ProfessionalEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfessionalEvent_professionalId_type_idx" ON "ProfessionalEvent"("professionalId", "type");

-- AddForeignKey
ALTER TABLE "ProfessionalEvent" ADD CONSTRAINT "ProfessionalEvent_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
