/*
  Warnings:

  - You are about to drop the column `fieldId` on the `user_access` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,role,schoolNpsn]` on the table `user_access` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,role,branchId]` on the table `user_access` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "user_access" DROP CONSTRAINT "user_access_fieldId_fkey";

-- DropIndex
DROP INDEX "user_access_fieldId_idx";

-- AlterTable
ALTER TABLE "user_access" DROP COLUMN "fieldId";

-- CreateIndex
CREATE UNIQUE INDEX "user_access_userId_role_schoolNpsn_key" ON "user_access"("userId", "role", "schoolNpsn");

-- CreateIndex
CREATE UNIQUE INDEX "user_access_userId_role_branchId_key" ON "user_access"("userId", "role", "branchId");
