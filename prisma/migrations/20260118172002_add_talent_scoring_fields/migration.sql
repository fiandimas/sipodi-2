-- AlterTable
ALTER TABLE "talent_submissions" ADD COLUMN     "adminScore" DOUBLE PRECISION,
ADD COLUMN     "computedScore" DOUBLE PRECISION,
ADD COLUMN     "jenisScore" DOUBLE PRECISION,
ADD COLUMN     "tagScore" INTEGER,
ADD COLUMN     "userScore" INTEGER;

-- CreateIndex
CREATE INDEX "talent_submissions_computedScore_idx" ON "talent_submissions"("computedScore");
