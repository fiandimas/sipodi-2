/*
  Warnings:

  - You are about to drop the column `talentFieldId` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_talentFieldId_fkey";

-- DropIndex
DROP INDEX "users_talentFieldId_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "talentFieldId";

-- CreateTable
CREATE TABLE "user_talent_fields" (
    "userId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_talent_fields_pkey" PRIMARY KEY ("userId","fieldId")
);

-- CreateIndex
CREATE INDEX "user_talent_fields_fieldId_idx" ON "user_talent_fields"("fieldId");

-- AddForeignKey
ALTER TABLE "user_talent_fields" ADD CONSTRAINT "user_talent_fields_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_talent_fields" ADD CONSTRAINT "user_talent_fields_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "talent_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
