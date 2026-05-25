/*
  Warnings:

  - You are about to drop the column `categoryId` on the `talent_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `fieldId` on the `talent_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `subCategoryId` on the `talent_submissions` table. All the data in the column will be lost.
  - The `fieldOtherText` column on the `talent_submissions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `categoryOtherText` column on the `talent_submissions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `subCategoryOtherText` column on the `talent_submissions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "talent_submissions" DROP CONSTRAINT "talent_submissions_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "talent_submissions" DROP CONSTRAINT "talent_submissions_fieldId_fkey";

-- DropForeignKey
ALTER TABLE "talent_submissions" DROP CONSTRAINT "talent_submissions_subCategoryId_fkey";

-- DropIndex
DROP INDEX "talent_categories_fieldId_idx";

-- DropIndex
DROP INDEX "talent_submissions_categoryId_idx";

-- DropIndex
DROP INDEX "talent_submissions_fieldId_idx";

-- DropIndex
DROP INDEX "talent_submissions_subCategoryId_idx";

-- DropIndex
DROP INDEX "talent_type_fields_fieldId_idx";

-- DropIndex
DROP INDEX "user_talent_fields_fieldId_idx";

-- AlterTable
ALTER TABLE "talent_submissions" DROP COLUMN "categoryId",
DROP COLUMN "fieldId",
DROP COLUMN "subCategoryId",
DROP COLUMN "fieldOtherText",
ADD COLUMN     "fieldOtherText" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "categoryOtherText",
ADD COLUMN     "categoryOtherText" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "subCategoryOtherText",
ADD COLUMN     "subCategoryOtherText" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "talent_submission_fields" (
    "submissionId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_submission_fields_pkey" PRIMARY KEY ("submissionId","fieldId")
);

-- CreateTable
CREATE TABLE "talent_submission_categories" (
    "submissionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_submission_categories_pkey" PRIMARY KEY ("submissionId","categoryId")
);

-- CreateTable
CREATE TABLE "talent_submission_subcategories" (
    "submissionId" TEXT NOT NULL,
    "subCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_submission_subcategories_pkey" PRIMARY KEY ("submissionId","subCategoryId")
);

-- CreateIndex
CREATE INDEX "talent_submission_fields_fieldId_idx" ON "talent_submission_fields"("fieldId");

-- CreateIndex
CREATE INDEX "talent_submission_categories_categoryId_idx" ON "talent_submission_categories"("categoryId");

-- CreateIndex
CREATE INDEX "talent_submission_subcategories_subCategoryId_idx" ON "talent_submission_subcategories"("subCategoryId");

-- AddForeignKey
ALTER TABLE "talent_submission_fields" ADD CONSTRAINT "talent_submission_fields_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "talent_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_submission_fields" ADD CONSTRAINT "talent_submission_fields_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "talent_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_submission_categories" ADD CONSTRAINT "talent_submission_categories_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "talent_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_submission_categories" ADD CONSTRAINT "talent_submission_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "talent_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_submission_subcategories" ADD CONSTRAINT "talent_submission_subcategories_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "talent_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_submission_subcategories" ADD CONSTRAINT "talent_submission_subcategories_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "talent_subcategories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
