-- CreateTable
CREATE TABLE "RequestPricing" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "amountPaid" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "reportedAt" TIMESTAMP(3),
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequestPricing_requestId_key" ON "RequestPricing"("requestId");

-- CreateIndex
CREATE INDEX "RequestPricing_requestId_idx" ON "RequestPricing"("requestId");

-- AddForeignKey
ALTER TABLE "RequestPricing" ADD CONSTRAINT "RequestPricing_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
