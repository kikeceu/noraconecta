-- AddForeignKey
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
