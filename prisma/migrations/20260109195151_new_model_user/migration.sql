-- AlterTable
ALTER TABLE "users" ADD COLUMN     "talentFieldId" TEXT;

-- CreateIndex
CREATE INDEX "users_talentFieldId_idx" ON "users"("talentFieldId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_talentFieldId_fkey" FOREIGN KEY ("talentFieldId") REFERENCES "talent_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;
