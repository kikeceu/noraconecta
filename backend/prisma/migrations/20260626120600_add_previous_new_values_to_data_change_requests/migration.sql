-- AlterTable
ALTER TABLE "ProfessionalDataChangeRequest" ADD COLUMN "previousValues" JSONB;
ALTER TABLE "ProfessionalDataChangeRequest" ADD COLUMN "newValues" JSONB;
