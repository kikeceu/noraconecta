-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'utility',
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplateUsage" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppTemplateUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppTemplateUsage_createdAt_templateName_idx" ON "WhatsAppTemplateUsage"("createdAt", "templateName");

-- CreateIndex
CREATE INDEX "WhatsAppTemplateUsage_requestId_idx" ON "WhatsAppTemplateUsage"("requestId");

-- CreateTable
CREATE TABLE "WhatsAppServiceConversation" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "requestId" TEXT,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppServiceConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppServiceConversation_createdAt_requestId_idx" ON "WhatsAppServiceConversation"("createdAt", "requestId");
