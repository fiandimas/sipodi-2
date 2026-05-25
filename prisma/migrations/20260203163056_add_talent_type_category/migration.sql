-- CreateTable
CREATE TABLE "talent_type_categories" (
    "typeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_type_categories_pkey" PRIMARY KEY ("typeId","categoryId")
);

-- CreateIndex
CREATE INDEX "talent_type_categories_typeId_idx" ON "talent_type_categories"("typeId");

-- CreateIndex
CREATE INDEX "talent_type_categories_categoryId_idx" ON "talent_type_categories"("categoryId");

-- AddForeignKey
ALTER TABLE "talent_type_categories" ADD CONSTRAINT "talent_type_categories_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "talent_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_type_categories" ADD CONSTRAINT "talent_type_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "talent_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
