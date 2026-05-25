-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN_TALENTA', 'ADMIN_SEKOLAH', 'USER_GTK');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('L', 'P');

-- CreateEnum
CREATE TYPE "SchoolLevel" AS ENUM ('SMA', 'SMK', 'SLB');

-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('NEGERI', 'SWASTA');

-- CreateEnum
CREATE TYPE "TalentSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScoreEntryType" AS ENUM ('CREATE_BONUS', 'APPROVAL_SCORE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PasswordAlgo" AS ENUM ('SHA256', 'ARGON2ID');

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "npsn" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "SchoolLevel" NOT NULL,
    "status" "SchoolStatus" NOT NULL,
    "city" TEXT NOT NULL,
    "headName" TEXT,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("npsn")
);

-- CreateTable
CREATE TABLE "gtks" (
    "nik" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "nuptk" TEXT,
    "nip" TEXT,
    "gender" "Gender",
    "birthDate" TIMESTAMP(3),
    "type" TEXT,
    "schoolNpsn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "photoUrl" TEXT,

    CONSTRAINT "gtks_pkey" PRIMARY KEY ("nik")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "branchId" TEXT,
    "schoolNpsn" TEXT,
    "gtkNik" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passwordAlgo" "PasswordAlgo" NOT NULL DEFAULT 'SHA256',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_letterheads" (
    "branchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "logoPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "signerName" TEXT,
    "signerNip" TEXT,
    "signerRank" TEXT,
    "signerRole" TEXT,
    "email" TEXT,

    CONSTRAINT "branch_letterheads_pkey" PRIMARY KEY ("branchId")
);

-- CreateTable
CREATE TABLE "school_letterheads" (
    "schoolNpsn" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "logoPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_letterheads_pkey" PRIMARY KEY ("schoolNpsn")
);

-- CreateTable
CREATE TABLE "talent_fields" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_categories" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_subcategories" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_tags" (
    "id" TEXT NOT NULL,
    "subCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_submissions" (
    "id" TEXT NOT NULL,
    "gtkNik" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "fieldId" TEXT,
    "fieldOtherText" TEXT,
    "categoryId" TEXT,
    "categoryOtherText" TEXT,
    "subCategoryId" TEXT,
    "subCategoryOtherText" TEXT,
    "tagsOtherText" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activityName" TEXT NOT NULL,
    "description" TEXT,
    "linkPendukung" TEXT,
    "organizer" TEXT,
    "status" "TalentSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_files" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" BYTEA NOT NULL,

    CONSTRAINT "talent_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_score_entries" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "type" "ScoreEntryType" NOT NULL,
    "points" INTEGER NOT NULL,
    "createdById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_score_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_training_details" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "activityName" TEXT NOT NULL,
    "organizer" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "durationDays" INTEGER,
    "description" TEXT,

    CONSTRAINT "talent_training_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_speaker_details" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "organizer" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "durationDays" INTEGER,
    "topic" TEXT,
    "description" TEXT,

    CONSTRAINT "talent_speaker_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_competition_participant_details" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "competitionName" TEXT NOT NULL,
    "level" TEXT,
    "achievement" TEXT,
    "organizer" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "durationDays" INTEGER,

    CONSTRAINT "talent_competition_participant_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_competition_mentor_details" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "competitionName" TEXT NOT NULL,
    "level" TEXT,
    "organizer" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "durationDays" INTEGER,

    CONSTRAINT "talent_competition_mentor_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_interest_details" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "interestName" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "talent_interest_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TalentSubmissionToTalentTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TalentSubmissionToTalentTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "schools_branchId_idx" ON "schools"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "gtks_email_key" ON "gtks"("email");

-- CreateIndex
CREATE INDEX "gtks_schoolNpsn_idx" ON "gtks"("schoolNpsn");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_gtkNik_key" ON "users"("gtkNik");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_branchId_idx" ON "users"("branchId");

-- CreateIndex
CREATE INDEX "users_schoolNpsn_idx" ON "users"("schoolNpsn");

-- CreateIndex
CREATE UNIQUE INDEX "talent_fields_name_key" ON "talent_fields"("name");

-- CreateIndex
CREATE UNIQUE INDEX "talent_types_name_key" ON "talent_types"("name");

-- CreateIndex
CREATE INDEX "talent_categories_fieldId_idx" ON "talent_categories"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "talent_categories_fieldId_name_key" ON "talent_categories"("fieldId", "name");

-- CreateIndex
CREATE INDEX "talent_subcategories_categoryId_idx" ON "talent_subcategories"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "talent_subcategories_categoryId_name_key" ON "talent_subcategories"("categoryId", "name");

-- CreateIndex
CREATE INDEX "talent_tags_subCategoryId_idx" ON "talent_tags"("subCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "talent_tags_subCategoryId_name_key" ON "talent_tags"("subCategoryId", "name");

-- CreateIndex
CREATE INDEX "talent_submissions_gtkNik_idx" ON "talent_submissions"("gtkNik");

-- CreateIndex
CREATE INDEX "talent_submissions_status_idx" ON "talent_submissions"("status");

-- CreateIndex
CREATE INDEX "talent_submissions_typeId_idx" ON "talent_submissions"("typeId");

-- CreateIndex
CREATE INDEX "talent_submissions_fieldId_idx" ON "talent_submissions"("fieldId");

-- CreateIndex
CREATE INDEX "talent_submissions_categoryId_idx" ON "talent_submissions"("categoryId");

-- CreateIndex
CREATE INDEX "talent_submissions_subCategoryId_idx" ON "talent_submissions"("subCategoryId");

-- CreateIndex
CREATE INDEX "talent_files_submissionId_idx" ON "talent_files"("submissionId");

-- CreateIndex
CREATE INDEX "talent_score_entries_submissionId_idx" ON "talent_score_entries"("submissionId");

-- CreateIndex
CREATE INDEX "talent_score_entries_type_idx" ON "talent_score_entries"("type");

-- CreateIndex
CREATE UNIQUE INDEX "talent_training_details_submissionId_key" ON "talent_training_details"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "talent_speaker_details_submissionId_key" ON "talent_speaker_details"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "talent_competition_participant_details_submissionId_key" ON "talent_competition_participant_details"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "talent_competition_mentor_details_submissionId_key" ON "talent_competition_mentor_details"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "talent_interest_details_submissionId_key" ON "talent_interest_details"("submissionId");

-- CreateIndex
CREATE INDEX "_TalentSubmissionToTalentTag_B_index" ON "_TalentSubmissionToTalentTag"("B");

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtks" ADD CONSTRAINT "gtks_schoolNpsn_fkey" FOREIGN KEY ("schoolNpsn") REFERENCES "schools"("npsn") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_gtkNik_fkey" FOREIGN KEY ("gtkNik") REFERENCES "gtks"("nik") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_schoolNpsn_fkey" FOREIGN KEY ("schoolNpsn") REFERENCES "schools"("npsn") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_letterheads" ADD CONSTRAINT "branch_letterheads_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_letterheads" ADD CONSTRAINT "school_letterheads_schoolNpsn_fkey" FOREIGN KEY ("schoolNpsn") REFERENCES "schools"("npsn") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_categories" ADD CONSTRAINT "talent_categories_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "talent_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_subcategories" ADD CONSTRAINT "talent_subcategories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "talent_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_tags" ADD CONSTRAINT "talent_tags_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "talent_subcategories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_submissions" ADD CONSTRAINT "talent_submissions_gtkNik_fkey" FOREIGN KEY ("gtkNik") REFERENCES "gtks"("nik") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_submissions" ADD CONSTRAINT "talent_submissions_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "talent_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_submissions" ADD CONSTRAINT "talent_submissions_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "talent_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_submissions" ADD CONSTRAINT "talent_submissions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "talent_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_submissions" ADD CONSTRAINT "talent_submissions_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "talent_subcategories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_submissions" ADD CONSTRAINT "talent_submissions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_files" ADD CONSTRAINT "talent_files_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "talent_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_score_entries" ADD CONSTRAINT "talent_score_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_score_entries" ADD CONSTRAINT "talent_score_entries_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "talent_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_training_details" ADD CONSTRAINT "talent_training_details_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "talent_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_speaker_details" ADD CONSTRAINT "talent_speaker_details_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "talent_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_competition_participant_details" ADD CONSTRAINT "talent_competition_participant_details_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "talent_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_competition_mentor_details" ADD CONSTRAINT "talent_competition_mentor_details_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "talent_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_interest_details" ADD CONSTRAINT "talent_interest_details_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "talent_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TalentSubmissionToTalentTag" ADD CONSTRAINT "_TalentSubmissionToTalentTag_A_fkey" FOREIGN KEY ("A") REFERENCES "talent_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TalentSubmissionToTalentTag" ADD CONSTRAINT "_TalentSubmissionToTalentTag_B_fkey" FOREIGN KEY ("B") REFERENCES "talent_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
