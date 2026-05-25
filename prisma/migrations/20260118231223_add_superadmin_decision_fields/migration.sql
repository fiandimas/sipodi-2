-- CreateEnum
CREATE TYPE "DecisionScope" AS ENUM ('SEKOLAH', 'TALENTA', 'SUPER_ADMIN');

-- AlterTable
ALTER TABLE "talent_submissions" ADD COLUMN     "approvedScope" "DecisionScope",
ADD COLUMN     "rejectedScope" "DecisionScope",
ADD COLUMN     "superApprovalNote" TEXT,
ADD COLUMN     "superApprovedAt" TIMESTAMP(3),
ADD COLUMN     "superApprovedById" TEXT,
ADD COLUMN     "superRejectedAt" TIMESTAMP(3),
ADD COLUMN     "superRejectedById" TEXT,
ADD COLUMN     "superRejectionNote" TEXT;

-- CreateIndex
CREATE INDEX "talent_submissions_approvedScope_idx" ON "talent_submissions"("approvedScope");

-- CreateIndex
CREATE INDEX "talent_submissions_rejectedScope_idx" ON "talent_submissions"("rejectedScope");

-- CreateIndex
CREATE INDEX "talent_submissions_superApprovedById_idx" ON "talent_submissions"("superApprovedById");

-- CreateIndex
CREATE INDEX "talent_submissions_superRejectedById_idx" ON "talent_submissions"("superRejectedById");

-- AddForeignKey
ALTER TABLE "talent_submissions" ADD CONSTRAINT "talent_submissions_superApprovedById_fkey" FOREIGN KEY ("superApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_submissions" ADD CONSTRAINT "talent_submissions_superRejectedById_fkey" FOREIGN KEY ("superRejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
