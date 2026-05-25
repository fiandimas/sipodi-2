-- AlterTable
ALTER TABLE "talent_submissions" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" TEXT,
ADD COLUMN     "rejectionNote" TEXT;

-- AddForeignKey
ALTER TABLE "talent_submissions" ADD CONSTRAINT "talent_submissions_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
