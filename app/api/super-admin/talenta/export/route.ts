// app/api/super-admin/talenta/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { Prisma, TalentSubmissionStatus, ScoreEntryType, DecisionScope } from "@prisma/client";
import type { TalentaSuperAdmin } from "@/lib/types/talenta-super-admin";

type StatusParam = "all" | "PENDING" | "TERVERIFIKASI" | "APPROVED" | "REJECTED" | "DINILAI";

function parseStatusParam(v: string | null): StatusParam {
  if (v === "PENDING" || v === "TERVERIFIKASI" || v === "APPROVED" || v === "DINILAI" || v === "REJECTED") return v;
  return "all";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const statusParam = parseStatusParam(searchParams.get("status"));
  const kategoriParam = searchParams.get("kategori") ?? "all";
  const jenisParam = (searchParams.get("jenis") ?? "all").trim();
  const search = (searchParams.get("q") ?? "").trim();
  const scoreQ = (searchParams.get("scoreQ") ?? "").trim();
  const tagIds = searchParams.getAll("tagId").map((x) => x.trim()).filter(Boolean);

  // ================= WHERE (SAMA PERSIS DENGAN ENDPOINT TABEL) =================
  const conds: Prisma.Sql[] = [];

  // base dataset super admin (copy dari /api/super-admin/talenta)
  conds.push(Prisma.sql`
    (
      (ts."status" = ${TalentSubmissionStatus.APPROVED}
        AND ts."approvedScope" IN (${DecisionScope.SEKOLAH}, ${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})
      )
      OR
      (ts."status" = ${TalentSubmissionStatus.REJECTED}
        AND ts."rejectedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})
      )
    )
  `);

  // filter status (copy dari /api/super-admin/talenta)
  if (statusParam === "PENDING") {
    conds.push(Prisma.sql`ts."status" = ${TalentSubmissionStatus.APPROVED}`);
    conds.push(Prisma.sql`ts."approvedScope" IN (${DecisionScope.SEKOLAH}, ${DecisionScope.TALENTA})`);
  } else if (statusParam === "TERVERIFIKASI") {
    conds.push(Prisma.sql`ts."status" = ${TalentSubmissionStatus.APPROVED}`);
    conds.push(Prisma.sql`ts."approvedScope" = ${DecisionScope.SEKOLAH}`);
  } else if (statusParam === "APPROVED") {
    conds.push(Prisma.sql`ts."status" = ${TalentSubmissionStatus.APPROVED}`);
    conds.push(Prisma.sql`ts."approvedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})`);
    conds.push(Prisma.sql`ts."computedScore" IS NULL`);
  } else if (statusParam === "DINILAI") {
    conds.push(Prisma.sql`ts."status" = ${TalentSubmissionStatus.APPROVED}`);
    conds.push(Prisma.sql`ts."approvedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})`);
    conds.push(Prisma.sql`ts."computedScore" IS NOT NULL`);
  } else if (statusParam === "REJECTED") {
    conds.push(Prisma.sql`ts."status" = ${TalentSubmissionStatus.REJECTED}`);
    conds.push(Prisma.sql`
      (
        ts."rejectedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})
        OR EXISTS (
          SELECT 1 FROM "talent_score_entries" se 
          WHERE se."submissionId" = ts."id" 
            AND se."type" = ${ScoreEntryType.APPROVAL_SCORE}
        )
      )
    `);
  }  

  if (kategoriParam !== "all") conds.push(Prisma.sql`cat."name" = ${kategoriParam}`);
  if (jenisParam !== "all") conds.push(Prisma.sql`tt."name" = ${jenisParam}`);

  if (search) {
    const like = `%${search}%`;
    conds.push(Prisma.sql`
      (
        g."name" ILIKE ${like}
        OR ts."activityName" ILIKE ${like}
        OR sch."name" ILIKE ${like}
      )
    `);
  }

  if (scoreQ) {
    const likeScore = `%${scoreQ}%`;
    conds.push(Prisma.sql`COALESCE(ts."computedScore",0)::text ILIKE ${likeScore}`);
  }

  if (tagIds.length > 0) {
    conds.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM "_TalentSubmissionToTalentTag" j
        WHERE j."A" = ts."id"
          AND j."B" IN (${Prisma.join(tagIds)})
      )
    `);
  }  
  let whereClause: Prisma.Sql = Prisma.empty;
  if (conds.length > 0) {
    const combined = conds.reduce((acc, cur, idx) => (idx === 0 ? cur : Prisma.sql`${acc} AND ${cur}`));
    whereClause = Prisma.sql`WHERE ${combined}`;
  }

  // export: ambil semua id sesuai filter, urut createdAt DESC (sama seperti tabel)
  const idRows = await prisma.$queryRaw<Array<{ id: string; gtkNik: string; jumlahTalentaGtk: number }>>(Prisma.sql`
  SELECT
    ts."id"::text AS id,
    ts."gtkNik"::text AS "gtkNik",
    COUNT(*) OVER (PARTITION BY ts."gtkNik")::int AS "jumlahTalentaGtk"
  FROM "talent_submissions" ts
  JOIN "gtks" g ON g."nik" = ts."gtkNik"
  JOIN "schools" sch ON sch."npsn" = g."schoolNpsn"
  LEFT JOIN "talent_submission_categories" tsc ON tsc."submissionId" = ts."id"
  LEFT JOIN "talent_categories" cat ON cat."id" = tsc."categoryId"
  LEFT JOIN "talent_types" tt ON tt."id" = ts."typeId"
  ${whereClause}
  ORDER BY ts."createdAt" DESC
`);

  const ids = idRows.map((r) => r.id);
  const countById = new Map(idRows.map((r) => [r.id, r.jumlahTalentaGtk]));

  if (ids.length === 0) {
    return NextResponse.json({ data: [], total: 0 });
  }

  const items = await prisma.talentSubmission.findMany({
    where: {
      id: { in: ids },
      gtkNik: { in: idRows.map(r => r.gtkNik) },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,

      activityName: true,
      organizer: true,
      description: true,
      linkPendukung: true,

      fieldOtherText: true,
      categoryOtherText: true,
      subCategoryOtherText: true,
      tagsOtherText: true,

      userScore: true,
      tagScore: true,
      jenisScore: true,
      adminScore: true,
      computedScore: true,

      approvedAt: true,
      approvalNote: true,
      approvedScope: true,
      approvedBy: { select: { name: true, role: true } },

      rejectedById: true,
      rejectedAt: true,
      rejectionNote: true,
      rejectedScope: true,
      rejectedBy: { select: { name: true, role: true } },

      gtk: {
        select: {
          nik: true,
          name: true,
          photoUrl: true,
          school: { select: { name: true, npsn: true } },
        },
      },
      fields: {
        include: { field: { select: { name: true } } }
      },
      categories: {
        include: { category: { select: { name: true } } }
      },
      subCategories: {
        include: { subCategory: { select: { name: true } } }
      },
      type: { select: { name: true } },
      tags: { select: { name: true } },

      scoreEntries: { select: { points: true, type: true } },
    },
  });

  const byId = new Map(items.map((x) => [x.id, x]));
  const orderedItems = ids.map((id) => byId.get(id)).filter(Boolean) as typeof items;

  const data: TalentaSuperAdmin[] = orderedItems.map((s) => {
    const skorSekolah = (s.scoreEntries ?? [])
      .filter((e) => e.type === ScoreEntryType.APPROVAL_SCORE)
      .reduce((sum, e) => sum + e.points, 0);

    const tagNames: string[] = [
      ...(s.tags ?? []).map((t) => t.name).filter(Boolean),
      ...(Array.isArray(s.tagsOtherText) ? s.tagsOtherText : []),
    ];

    const tagCount = Math.min(tagNames.length, 20);
    const tagScoreFallback = tagCount * 5;

    const isRejectedByHigher =
      s.status === "REJECTED" && (s.rejectedScope === "TALENTA" || s.rejectedScope === "SUPER_ADMIN");

    const isApprovedBySchool =
      s.status === "APPROVED" && (s.approvedScope === null || s.approvedScope === "SEKOLAH");

    const isApprovedByHigher =
      s.status === "APPROVED" && (s.approvedScope === "TALENTA" || s.approvedScope === "SUPER_ADMIN");

    const isRated = isApprovedByHigher && s.computedScore != null; // ✅ sama dengan tabel

    let reviewStatus: TalentaSuperAdmin["reviewStatus"] = "PENDING";
    if (isRejectedByHigher) reviewStatus = "REJECTED";
    else if (isRated) reviewStatus = "DINILAI";
    else if (isApprovedByHigher) reviewStatus = "APPROVED";
    else if (isApprovedBySchool) reviewStatus = "TERVERIFIKASI";
    else reviewStatus = "PENDING";

    let approvedScopeResolved: DecisionScope | null = s.approvedScope ?? null;
    if (s.status === TalentSubmissionStatus.APPROVED && !approvedScopeResolved) {
      const role = s.approvedBy?.role;
      if (role === "ADMIN_TALENTA") approvedScopeResolved = DecisionScope.TALENTA;
      else if (role === "SUPER_ADMIN") approvedScopeResolved = DecisionScope.SUPER_ADMIN;
      else approvedScopeResolved = DecisionScope.SEKOLAH;
    }

    let rejectedScopeResolved: DecisionScope | null = s.rejectedScope ?? null;
    if (s.status === TalentSubmissionStatus.REJECTED && !rejectedScopeResolved) {
      const role = s.rejectedBy?.role;
      if (role === "ADMIN_TALENTA") rejectedScopeResolved = DecisionScope.TALENTA;
      else if (role === "SUPER_ADMIN") rejectedScopeResolved = DecisionScope.SUPER_ADMIN;
      else rejectedScopeResolved = DecisionScope.SEKOLAH;
    }

    return {
      id: s.id,
      gtk: {
        nik: s.gtk?.nik ?? "-",
        nama: s.gtk?.name ?? "-",
        sekolah: s.gtk?.school?.name ?? "-",
        npsn: s.gtk?.school?.npsn ?? "-",
        fotoUrl: s.gtk?.photoUrl ?? null,
      },

      jumlahTalentaGtk: countById.get(s.id) ?? 0,

      status: s.status,
      reviewStatus,

      jenis: s.type?.name ?? "-",

      // ✅ skor sama seperti tabel (computedScore DB)
      skorTalenta: s.computedScore ?? 0,
      skorUser: s.userScore ?? 0,
      skorTag: s.tagScore ?? tagScoreFallback,
      skorJenis: s.jenisScore ?? 0,
      skorAdmin: s.adminScore ?? 0,
      totalSkor: s.computedScore ?? 0,

      skorSekolah,

      approvedAt: s.approvedAt ? s.approvedAt.toISOString() : null,
      approvedBy: s.approvedBy?.name ?? null,
      approvedScope: s.approvedScope ?? null,
      approvedScopeResolved,
      approvalNote: s.approvalNote ?? null,

      rejectedAt: s.rejectedAt ? s.rejectedAt.toISOString() : null,
      rejectedBy: s.rejectedBy?.name ?? null,
      rejectedScope: s.rejectedScope ?? null,
      rejectedScopeResolved,
      rejectionNote: s.rejectionNote ?? null,

      detailTalenta: [
        {
          id: s.id,
          namaKegiatan: s.activityName,
          penyelenggara: s.organizer ?? "",
          deskripsi: s.description ?? "",
          jenis: s.type?.name ?? "",
          bidang: s.fields?.[0]?.field?.name ?? s.fieldOtherText?.[0] ?? "",
          kategori: s.categories?.[0]?.category?.name ?? s.categoryOtherText?.[0] ?? "",
          subKategori: s.subCategories?.[0]?.subCategory?.name ?? s.subCategoryOtherText?.[0] ?? undefined,
          tag: tagNames,
          tagCount,
          tagScore: s.tagScore ?? tagScoreFallback,
          userScore: s.userScore ?? undefined,
          jenisScore: s.jenisScore ?? 0,
          adminScore: s.adminScore ?? 0,
          computedScore: s.computedScore ?? 0,
          buktiUrl: undefined,
          linkPendukung: s.linkPendukung ?? undefined,
        },
      ],
    };
  });

  return NextResponse.json({ data, total: data.length });
}
