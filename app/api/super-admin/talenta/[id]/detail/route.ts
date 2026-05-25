import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { TalentSubmissionStatus } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const submission = await prisma.talentSubmission.findUnique({
    where: { id: params.id },
    include: {
      field: true,
      category: true,
      subCategory: true,
      tags: true,
      files: true,
      scoreEntries: true,
      type: true,
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: submission.id,
    namaKegiatan: submission.activityName,
    penyelenggara: submission.organizer,
    bidang: submission.field?.name ?? submission.fieldOtherText ?? "-",
    kategori: submission.category?.name ?? submission.categoryOtherText ?? "-",
    subKategori: submission.subCategory?.name ?? submission.subCategoryOtherText,
    tag: submission.tags.map((t) => t.name),
    deskripsi: submission.description,
    tanggalMulai: submission.createdAt.toISOString(),
    durasiHari: 0,
    linkPendukung: submission.linkPendukung,
    skorOtomatis: submission.computedScore ?? 0,
    skorAdmin: submission.adminScore ?? undefined,
    status:
      submission.status === TalentSubmissionStatus.APPROVED
        ? "Terverifikasi"
        : "Pending",
  });
}
