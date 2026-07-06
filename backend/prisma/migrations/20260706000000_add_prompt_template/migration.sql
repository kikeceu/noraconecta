-- CreateTable
CREATE TABLE "PromptTemplate" (
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "defaultContent" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "variables" TEXT[] NOT NULL DEFAULT '{}',
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("key")
);
