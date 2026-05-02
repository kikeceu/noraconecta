-- CreateTable
CREATE TABLE "GeoLevel" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "levelId" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeoLevel_countryId_level_key" ON "GeoLevel"("countryId", "level");

-- CreateIndex
CREATE INDEX "GeoNode_parentId_idx" ON "GeoNode"("parentId");

-- CreateIndex
CREATE INDEX "GeoNode_levelId_idx" ON "GeoNode"("levelId");

-- AddForeignKey
ALTER TABLE "GeoLevel" ADD CONSTRAINT "GeoLevel_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "GeoNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoNode" ADD CONSTRAINT "GeoNode_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "GeoLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoNode" ADD CONSTRAINT "GeoNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GeoNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
