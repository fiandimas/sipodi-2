-- CreateTable
CREATE TABLE "talent_type_subcategories" (
    "typeId" TEXT NOT NULL,
    "subCategoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_type_subcategories_pkey" PRIMARY KEY ("typeId","subCategoryId")
);

-- CreateIndex
CREATE INDEX "talent_type_subcategories_typeId_idx" ON "talent_type_subcategories"("typeId");

-- CreateIndex
CREATE INDEX "talent_type_subcategories_subCategoryId_idx" ON "talent_type_subcategories"("subCategoryId");

-- AddForeignKey
ALTER TABLE "talent_type_subcategories" ADD CONSTRAINT "talent_type_subcategories_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "talent_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_type_subcategories" ADD CONSTRAINT "talent_type_subcategories_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "talent_subcategories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
