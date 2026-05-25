-- CreateTable
CREATE TABLE "user_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "fieldId" TEXT,
    "schoolNpsn" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_access_userId_idx" ON "user_access"("userId");

-- CreateIndex
CREATE INDEX "user_access_role_idx" ON "user_access"("role");

-- CreateIndex
CREATE INDEX "user_access_fieldId_idx" ON "user_access"("fieldId");

-- CreateIndex
CREATE INDEX "user_access_schoolNpsn_idx" ON "user_access"("schoolNpsn");

-- CreateIndex
CREATE INDEX "user_access_branchId_idx" ON "user_access"("branchId");

-- AddForeignKey
ALTER TABLE "user_access" ADD CONSTRAINT "user_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_access" ADD CONSTRAINT "user_access_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "talent_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_access" ADD CONSTRAINT "user_access_schoolNpsn_fkey" FOREIGN KEY ("schoolNpsn") REFERENCES "schools"("npsn") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_access" ADD CONSTRAINT "user_access_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
