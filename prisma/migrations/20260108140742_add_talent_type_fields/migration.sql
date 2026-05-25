-- CreateTable
CREATE TABLE "talent_type_fields" (
    "typeId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_type_fields_pkey" PRIMARY KEY ("typeId","fieldId")
);

-- CreateIndex
CREATE INDEX "talent_type_fields_fieldId_idx" ON "talent_type_fields"("fieldId");

-- AddForeignKey
ALTER TABLE "talent_type_fields" ADD CONSTRAINT "talent_type_fields_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "talent_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_type_fields" ADD CONSTRAINT "talent_type_fields_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "talent_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
