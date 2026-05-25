// app/api/super-admin/talenta/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { Prisma, TalentSubmissionStatus, ScoreEntryType, DecisionScope } from "@prisma/client";

const PAGE_SIZE_DEFAULT = 20;

type StatusParam = "all" | "PENDING" | "TERVERIFIKASI" | "APPROVED" | "REJECTED" | "DINILAI";
type SortKey = "name" | "school" | "talenta" | "score" | "createdAt";
type SortDir = "asc" | "desc";

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

  const page = Math.max(Number(searchParams.get("page") || "1"), 1);
  const pageSize = Math.max(Number(searchParams.get("pageSize") || String(PAGE_SIZE_DEFAULT)), 1);

  const statusParam = parseStatusParam(searchParams.get("status"));
  const kategoriParam = searchParams.get("kategori") ?? "all";
  const jenisParam = (searchParams.get("jenis") ?? "all").trim();
  const search = (searchParams.get("q") ?? "").trim();
  const scoreQ = (searchParams.get("scoreQ") ?? "").trim();
  const tagIds = searchParams.getAll("tagId").map((x) => x.trim()).filter(Boolean);
  const juara = (searchParams.get("juara") ?? "").trim();
  const tagTexts = searchParams.getAll("tagText").map((x) => x.trim()).filter(Boolean);

  const JUARA = new Set(["Juara 1", "Juara 2", "Juara 3"]);
  const juaraValue = JUARA.has(juara) ? juara : "";
  const tagTextsFiltered = tagTexts.filter((x) => !JUARA.has(x));

  const sortKey: SortKey = "createdAt";
  const sortDir: SortDir = "desc";
  const dirSql = Prisma.sql`DESC`;

  // ================= WHERE =================
  const conds: Prisma.Sql[] = [];

  /**
   * ✅ Base dataset Super Admin:
   * TAMPILKAN hanya yang sudah masuk alur verifikasi sekolah => minimal sudah APPROVED dengan approvedScope SEKOLAH.
   * Setelah itu bisa naik level jadi TALENTA / SUPER_ADMIN, tetap tampil.
   *
   * Jadi:
   * - APPROVED + approvedScope IN (SEKOLAH, TALENTA, SUPER_ADMIN)
   * - REJECTED + (pernah verified) => approvedScope IS NOT NULL
   */
  conds.push(Prisma.sql`
(
  ts."status" IN (${TalentSubmissionStatus.APPROVED}, ${TalentSubmissionStatus.REJECTED})
  AND (
    ts."approvedScope" IN (${DecisionScope.SEKOLAH}, ${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})
    OR ts."rejectedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})
    OR EXISTS (
      SELECT 1 FROM "talent_score_entries" se 
      WHERE se."submissionId" = ts."id" AND se."type" = ${ScoreEntryType.APPROVAL_SCORE}
    )
  )
)
`);

  if (tagTextsFiltered.length) {
    conds.push(Prisma.sql`
      (
        COALESCE(ts."tagsOtherText", ARRAY[]::text[]) && ARRAY[${Prisma.join(tagTextsFiltered)}]::text[]
        OR EXISTS (
          SELECT 1
          FROM "_TalentSubmissionToTalentTag" j
          JOIN "talent_tags" tg ON tg."id" = j."B"
          WHERE j."A" = ts."id"
            AND tg."name" IN (${Prisma.join(tagTextsFiltered)})
        )
      )
    `);
  }

  // ===== Filter status (UI 5-state: Pending, Terverifikasi, Approved, Dinilai, Rejected) =====
  if (statusParam === "PENDING") {
    // pending super admin = sudah verified sekolah / approved talenta, tapi belum SUPER_ADMIN
    conds.push(Prisma.sql`ts."status" = ${TalentSubmissionStatus.APPROVED}`);
    conds.push(
      Prisma.sql`ts."approvedScope" IN (${DecisionScope.SEKOLAH}, ${DecisionScope.TALENTA})`
    );
  } else if (statusParam === "TERVERIFIKASI") {
    // verified sekolah saja
    conds.push(Prisma.sql`ts."status" = ${TalentSubmissionStatus.APPROVED}`);
    conds.push(Prisma.sql`ts."approvedScope" = ${DecisionScope.SEKOLAH}`);
  } else if (statusParam === "APPROVED") {
    // approved TALENTA/SUPER_ADMIN tapi BELUM dinilai
    conds.push(Prisma.sql`ts."status" = ${TalentSubmissionStatus.APPROVED}`);
    conds.push(
      Prisma.sql`ts."approvedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})`
    );
    conds.push(Prisma.sql`ts."computedScore" IS NULL`);
  } else if (statusParam === "DINILAI") {
    // approved TALENTA/SUPER_ADMIN dan SUDAH dinilai
    conds.push(Prisma.sql`ts."status" = ${TalentSubmissionStatus.APPROVED}`);
    conds.push(
      Prisma.sql`ts."approvedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})`
    );
    conds.push(Prisma.sql`ts."computedScore" IS NOT NULL`);
  } else if (statusParam === "REJECTED") {
    conds.push(Prisma.sql`ts."status" = ${TalentSubmissionStatus.REJECTED}`);
    conds.push(Prisma.sql`
      (
        ts."approvedAt" IS NOT NULL
        OR ts."rejectedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})
        OR EXISTS (
          SELECT 1
          FROM "talent_score_entries" se
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
    conds.push(
      Prisma.sql`
        (
          g."name" ILIKE ${like}
          OR ts."activityName" ILIKE ${like}
          OR sch."name" ILIKE ${like}
        )
      `
    );
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

  if (juaraValue) {
    conds.push(Prisma.sql`
    EXISTS (
      SELECT 1
      FROM "_TalentSubmissionToTalentTag" j
      JOIN "talent_tags" tg ON tg."id" = j."B"
      WHERE j."A" = ts."id"
        AND tg."name" = ${juaraValue}
    )
  `);
  }

  let whereClause: Prisma.Sql = Prisma.empty;
  if (conds.length > 0) {
    const combined = conds.reduce((acc, cur, idx) => {
      if (idx === 0) return cur;
      return Prisma.sql`${acc} AND ${cur}`;
    });
    whereClause = Prisma.sql`WHERE ${combined}`;
  }


  const orderBySql = Prisma.sql`ts."createdAt" ${dirSql}`;
  const offset = (page - 1) * pageSize;

  const [idRows, totalRow] = await Promise.all([
    // Line 185-200: FIXED idRows query
    prisma.$queryRaw<Array<{ id: string; jumlahTalentaGtk: number }>>(Prisma.sql`
    SELECT
      ts."id"::text AS id,
      COUNT(*) OVER (PARTITION BY ts."gtkNik")::int AS "jumlahTalentaGtk"
    FROM "talent_submissions" ts
    JOIN "gtks" g ON g."nik" = ts."gtkNik"
    JOIN "schools" sch ON sch."npsn" = g."schoolNpsn"
    LEFT JOIN "talent_submission_categories" tsc ON tsc."submissionId" = ts."id"
    LEFT JOIN "talent_categories" cat ON cat."id" = tsc."categoryId"
    LEFT JOIN "talent_types" tt ON tt."id" = ts."typeId"
    ${whereClause}
    ORDER BY ${orderBySql}
    LIMIT ${pageSize} OFFSET ${offset}
  `),

    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
  SELECT COUNT(DISTINCT ts."id")::bigint AS total
  FROM "talent_submissions" ts
  JOIN "gtks" g ON g."nik" = ts."gtkNik"
  JOIN "schools" sch ON sch."npsn" = g."schoolNpsn"
  LEFT JOIN "talent_submission_categories" tsc ON tsc."submissionId" = ts."id"
  LEFT JOIN "talent_categories" cat ON cat."id" = tsc."categoryId"
  LEFT JOIN "talent_types" tt ON tt."id" = ts."typeId"
  ${whereClause}
`),

  ]);

  const rawTotal = totalRow?.[0]?.total;
  const total = typeof rawTotal === "bigint" ? Number(rawTotal) : Number(rawTotal ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const ids = idRows.map((r) => r.id);
  const countById = new Map(idRows.map((r) => [r.id, r.jumlahTalentaGtk]));

  if (ids.length === 0) {
    return NextResponse.json({
      data: [],
      page,
      pageSize,
      total,
      totalPages,
      sort: sortKey,
      dir: sortDir,
    });
  }

  const items = await prisma.talentSubmission.findMany({
    where: { id: { in: ids } },
    include: {
      gtk: {
        select: {
          nik: true,
          name: true,
          photoUrl: true,
          school: { select: { name: true, npsn: true } },
        },
      },
      type: { select: { name: true } },
      tags: { select: { name: true } },
      files: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
        },
      },
      approvedBy: { select: { name: true, role: true } },
      rejectedBy: { select: { name: true, role: true } },
      scoreEntries: true,

      fields: {
        include: {
          field: { select: { name: true } }
        }
      },
      categories: {
        include: {
          category: { select: { name: true } }
        }
      },
    },
  });

  const byId = new Map(items.map((x) => [x.id, x]));
  const orderedItems = ids.map((id) => byId.get(id)).filter(Boolean) as typeof items;

  const data = orderedItems.map((s: any) => {
    const skorSekolah = (s.scoreEntries ?? [])
      .filter((e: any) => e.type === ScoreEntryType.APPROVAL_SCORE)
      .reduce((sum: number, e: any) => sum + (e.points ?? 0), 0);

    const tagNames: string[] = [
      ...(s.tags ?? []).map((t: any) => t.name).filter(Boolean),
      ...(Array.isArray(s.tagsOtherText) ? s.tagsOtherText : []),
    ];

    const tagCount = Math.min(tagNames.length, 20);
    const tagScoreFallback = tagCount * 5;

    // hitung flag dulu
    const isRejectedByHigher =
      s.status === "REJECTED" &&
      (s.rejectedScope === "TALENTA" || s.rejectedScope === "SUPER_ADMIN");

    const isApprovedBySchool =
      s.status === "APPROVED" &&
      (s.approvedScope === null || s.approvedScope === "SEKOLAH");

    const isApprovedByHigher =
      s.status === "APPROVED" &&
      (s.approvedScope === "TALENTA" || s.approvedScope === "SUPER_ADMIN");

    const isRated = isApprovedByHigher && s.computedScore != null;

    let reviewStatus: "PENDING" | "TERVERIFIKASI" | "APPROVED" | "DINILAI" | "REJECTED" = "PENDING";

    if (s.status === "REJECTED") {
      // kalau Anda mau semua rejected (termasuk rejected sekolah) dianggap REJECTED:
      reviewStatus = "REJECTED";
    } else if (isRated) reviewStatus = "DINILAI";
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
          bidang: s.fields?.[0]?.field?.name ?? s.fieldOtherText ?? "",
          kategori: s.categories?.[0]?.category?.name ?? s.categoryOtherText ?? "",
          subKategori: s.subCategories?.[0]?.subCategory?.name ?? s.subCategoryOtherText?.[0] ?? undefined,
          tag: tagNames,
          tagCount,
          tagScore: s.tagScore ?? tagScoreFallback,
          userScore: s.userScore ?? undefined,
          jenisScore: s.jenisScore ?? 0,
          adminScore: s.adminScore ?? 0,
          computedScore: s.computedScore ?? 0,
          files: s.files ?? [],
          linkPendukung: s.linkPendukung ?? undefined,
        },
      ],
    };
  });

  return NextResponse.json({
    data,
    page,
    pageSize,
    total,
    totalPages,
    sort: sortKey,
    dir: sortDir,
  });
}
