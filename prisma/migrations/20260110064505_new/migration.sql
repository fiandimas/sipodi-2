/*
  Warnings:

  - The `type` column on the `gtks` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "GtkType" AS ENUM ('GURU', 'TENDIK', 'KEPALA_SEKOLAH', 'KEPALA_SEKSI', 'KEPALA_CABANG_DINAS');

-- AlterTable
ALTER TABLE "gtks" DROP COLUMN "type",
ADD COLUMN     "type" "GtkType";
