/*
  Warnings:

  - You are about to drop the column `subCategoryId` on the `talent_tags` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `talent_tags` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "talent_tags" DROP CONSTRAINT "talent_tags_subCategoryId_fkey";

-- DropIndex
DROP INDEX "talent_tags_subCategoryId_idx";

-- DropIndex
DROP INDEX "talent_tags_subCategoryId_name_key";

-- AlterTable
ALTER TABLE "talent_tags" DROP COLUMN "subCategoryId";

-- CreateTable
CREATE TABLE "talent_type_subcategory_tags" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "subCategoryId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_type_subcategory_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "talent_type_subcategory_tags_subCategoryId_idx" ON "talent_type_subcategory_tags"("subCategoryId");

-- CreateIndex
CREATE INDEX "talent_type_subcategory_tags_typeId_idx" ON "talent_type_subcategory_tags"("typeId");

-- CreateIndex
CREATE INDEX "talent_type_subcategory_tags_tagId_idx" ON "talent_type_subcategory_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "talent_type_subcategory_tags_typeId_subCategoryId_tagId_key" ON "talent_type_subcategory_tags"("typeId", "subCategoryId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "talent_tags_name_key" ON "talent_tags"("name");

-- AddForeignKey
ALTER TABLE "talent_type_subcategory_tags" ADD CONSTRAINT "talent_type_subcategory_tags_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "talent_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_type_subcategory_tags" ADD CONSTRAINT "talent_type_subcategory_tags_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "talent_subcategories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_type_subcategory_tags" ADD CONSTRAINT "talent_type_subcategory_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "talent_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
