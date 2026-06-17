-- CreateIndex
CREATE INDEX "Professional_categoryId_status_idx" ON "Professional"("categoryId", "status");

-- CreateIndex
CREATE INDEX "ProfessionalZone_geoNodeId_idx" ON "ProfessionalZone"("geoNodeId");

-- CreateIndex
CREATE INDEX "Request_userId_status_idx" ON "Request"("userId", "status");

-- CreateIndex
CREATE INDEX "Request_categoryId_geoNodeId_status_idx" ON "Request"("categoryId", "geoNodeId", "status");

-- CreateIndex
CREATE INDEX "Request_assignedProfessionalId_status_idx" ON "Request"("assignedProfessionalId", "status");

-- CreateIndex
CREATE INDEX "Request_assignmentTimeoutAt_status_idx" ON "Request"("assignmentTimeoutAt", "status");

-- CreateIndex
CREATE INDEX "RequestEvent_requestId_idx" ON "RequestEvent"("requestId");

-- CreateIndex
CREATE INDEX "RequestEvent_professionalId_idx" ON "RequestEvent"("professionalId");
