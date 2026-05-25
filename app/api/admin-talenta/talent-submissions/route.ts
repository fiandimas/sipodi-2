import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { Prisma, ScoreEntryType } from "@prisma/client";
import type { ReviewStatus } from "@/lib/types/talenta-super-admin";

const PAGE_SIZE_DEFAULT = 20;

type StatusParam = "all" | "PENDING" | "APPROVED" | "REJECTED";
type UiStatusParam = "all" | "TERVERIFIKASI";
type SortKey = "name" | "school" | "talenta" | "score" | "createdAt";
type SortDir = "asc" | "desc";

function parseStatusParam(v: string | null): StatusParam {
  if (v === "PENDING" || v === "APPROVED" || v === "REJECTED") return v;
  return "all";
}

function parseUiStatusParam(v: string | null): UiStatusParam {
  if (v === "TERVERIFIKASI") return "TERVERIFIKASI";
  return "all";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN_TALENTA") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const fieldId = (searchParams.get("fieldId") ?? "").trim();
  if (!fieldId) return NextResponse.json({ error: "fieldId wajib diisi" }, { status: 400 });

  const allowed = session.talentFields?.some((f) => f.id === fieldId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const page = Math.max(Number(searchParams.get("page") || "1"), 1);
  const pageSize = Math.max(Number(searchParams.get("pageSize") || String(PAGE_SIZE_DEFAULT)), 1);

  const statusParam = parseStatusParam(searchParams.get("status"));
  const uiStatusParam = parseUiStatusParam(searchParams.get("uiStatus"));

  const kategoriParam = searchParams.get("kategori") ?? "all";
  const jenisParam = (searchParams.get("jenis") ?? "all").trim();
  const search = (searchParams.get("q") ?? "").trim();
  const scoreQ = (searchParams.get("scoreQ") ?? "").trim();
  const tagIds = searchParams.getAll("tagId").filter(Boolean);
  const juara = (searchParams.get("juara") ?? "").trim();

  const JUARA = new Set(["Juara 1", "Juara 2", "Juara 3"]);
  const tagTexts = searchParams
    .getAll("tagText")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !JUARA.has(x));

  const juaraValue = JUARA.has(juara) ? juara : "";

  const sortKey: SortKey = "createdAt";
  const sortDir: SortDir = "desc";
  const dirSql = Prisma.sql`DESC`;

  // ===== SQL WHERE (single source of truth) =====
  const conds: Prisma.Sql[] = [];

  // scope field
  conds.push(Prisma.sql`EXISTS (
  SELECT 1 FROM "talent_submission_fields" tsf 
  WHERE tsf."submissionId" = ts."id" AND tsf."fieldId" = ${fieldId}
)`);


  /**
   * ✅ ELIGIBLE DATASET UNTUK ADMIN TALENTA
   *
   * - Jangan tampilkan REJECTED oleh SEKOLAH.
   * - Tampilkan:
   *   A) antrian admin talenta: APPROVED + scope SEKOLAH/NULL
   *   B) sudah diputus higher: APPROVED scope TALENTA/SUPER_ADMIN atau REJECTED scope TALENTA/SUPER_ADMIN
   */
  conds.push(
    Prisma.sql`(
      (
        ts."status" = ${"APPROVED"}
        AND (ts."approvedScope" IS NULL OR ts."approvedScope" = ${"SEKOLAH"})
      )
      OR
      (
        ts."status" = ${"APPROVED"}
        AND ts."approvedScope" IN (${"TALENTA"}, ${"SUPER_ADMIN"})
      )
      OR
      (
        ts."status" = ${"REJECTED"}
        AND ts."rejectedScope" IN (${"TALENTA"}, ${"SUPER_ADMIN"})
      )
    )`
  );

  if (tagIds.length) {
    conds.push(
      Prisma.sql`EXISTS (
        SELECT 1
        FROM "_TalentSubmissionToTalentTag" j
        WHERE j."A" = ts."id"
        AND j."B" IN (${Prisma.join(tagIds)})
      )`
    );
  }

  if (tagTexts.length) {
    conds.push(
      Prisma.sql`(
        COALESCE(ts."tagsOtherText", ARRAY[]::text[]) && ARRAY[${Prisma.join(tagTexts)}]::text[]
        OR EXISTS (
          SELECT 1
          FROM "_TalentSubmissionToTalentTag" j
          JOIN "talent_tags" tg ON tg."id" = j."B"
          WHERE j."A" = ts."id"
          AND tg."name" IN (${Prisma.join(tagTexts)})
        )
      )`
    );
  }

  // ✅ filter uiStatus (TERVERIFIKASI = approved sekolah)
  if (uiStatusParam === "TERVERIFIKASI") {
    conds.push(Prisma.sql`ts."status" = ${"APPROVED"}`);
    conds.push(Prisma.sql`(ts."approvedScope" IS NULL OR ts."approvedScope" = ${"SEKOLAH"})`);
  }

  // filter status turunan (reviewStatus)
  if (statusParam === "PENDING") {
    conds.push(Prisma.sql`ts."status" = ${"APPROVED"}`);
    // pending admin talenta = approved sekolah tapi belum talenta/super
    conds.push(Prisma.sql`(ts."approvedScope" IS NULL OR ts."approvedScope" = ${"SEKOLAH"})`);
  } else if (statusParam === "APPROVED") {
    conds.push(Prisma.sql`ts."status" = ${"APPROVED"}`);
    conds.push(Prisma.sql`ts."approvedScope" IN (${"TALENTA"}, ${"SUPER_ADMIN"})`);
  } else if (statusParam === "REJECTED") {
    conds.push(Prisma.sql`ts."status" = ${"REJECTED"}`);
    conds.push(Prisma.sql`ts."rejectedScope" IN (${"TALENTA"}, ${"SUPER_ADMIN"})`);
  }

  if (kategoriParam !== "all") conds.push(Prisma.sql`cat."name" = ${kategoriParam}`);
  if (jenisParam !== "all") conds.push(Prisma.sql`tt."name" = ${jenisParam}`);

  if (search) {
    const like = `%${search}%`;
    conds.push(
      Prisma.sql`(
        g."name" ILIKE ${like}
        OR ts."activityName" ILIKE ${like}
        OR sch."name" ILIKE ${like}
      )`
    );
  }

  if (scoreQ) {
    const likeScore = `%${scoreQ}%`;
    conds.push(Prisma.sql`COALESCE(ts."computedScore", 0)::text ILIKE ${likeScore}`);
  }

  if (juaraValue) {
    conds.push(
      Prisma.sql`EXISTS (
        SELECT 1
        FROM "_TalentSubmissionToTalentTag" j
        JOIN "talent_tags" tg ON tg."id" = j."B"
        WHERE j."A" = ts."id"
        AND tg."name" = ${juaraValue}
      )`
    );
  }

  let whereClause: Prisma.Sql = Prisma.empty;
  if (conds.length > 0) {
    const combined = conds.reduce((acc, cur, idx) => {
      if (idx === 0) return cur;
      return Prisma.sql`${acc} AND ${cur}`;
    });
    whereClause = Prisma.sql`WHERE ${combined}`;
  }

  const orderBySql: Prisma.Sql = Prisma.sql`ts."createdAt" ${dirSql}`;
  const offset = (page - 1) * pageSize;

  const [idRows, totalRow] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; jumlahTalentaGtk: number }>>(Prisma.sql`
      WITH total_per_gtk AS (
        SELECT ts2."gtkNik" AS gtk_nik, COUNT(*)::int AS total
        FROM "talent_submissions" ts2
        GROUP BY ts2."gtkNik"
      )
      SELECT
        ts."id"::text AS id,
        COALESCE(tpg.total, 0)::int AS "jumlahTalentaGtk"
      FROM "talent_submissions" ts
      JOIN "gtks" g ON g."nik" = ts."gtkNik"
      JOIN "schools" sch ON sch."npsn" = g."schoolNpsn"
      LEFT JOIN "talent_submission_categories" tsc ON tsc."submissionId" = ts."id"
      LEFT JOIN "talent_categories" cat ON cat."id" = tsc."categoryId"
      LEFT JOIN "talent_types" tt ON tt."id" = ts."typeId"
      LEFT JOIN total_per_gtk tpg ON tpg.gtk_nik = ts."gtkNik"
      ${whereClause}
      ORDER BY ${orderBySql}
      LIMIT ${pageSize} OFFSET ${offset}
    `),

    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
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
          schoolNpsn: true,
          school: { select: { name: true, npsn: true } },
        },
      },
      fields: {
        select: {
          field: { select: { name: true } }
        }
      },
      categories: {
        select: {
          category: { select: { name: true } }
        }
      },
      subCategories: {
        select: {
          subCategory: { select: { name: true } }
        }
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

      scoreEntries: { select: { points: true, type: true } },
    },
  });

  const byId = new Map(items.map((x) => [x.id, x]));
  const orderedItems = ids.map((id) => byId.get(id)).filter(Boolean) as typeof items;

  const data = orderedItems.map((s) => {
    const skorSekolah = (s.scoreEntries ?? [])
      .filter((e) => e.type === ScoreEntryType.APPROVAL_SCORE)
      .reduce((sum, e) => sum + e.points, 0);

    const bidang = s.fields?.[0]?.field.name ?? s.fieldOtherText?.[0] ?? "";
    const kategori = s.categories?.[0]?.category.name ?? s.categoryOtherText?.[0] ?? "";
    const subKategori = s.subCategories?.[0]?.subCategory.name ?? s.subCategoryOtherText?.[0] ?? "";

    const isRejectedByHigher =
      s.status === "REJECTED" &&
      (s.rejectedScope === "TALENTA" || s.rejectedScope === "SUPER_ADMIN");

    const isApprovedBySchool =
      s.status === "APPROVED" &&
      (s.approvedScope === null || s.approvedScope === "SEKOLAH");

    const isApprovedByHigher =
      s.status === "APPROVED" &&
      (s.approvedScope === "TALENTA" || s.approvedScope === "SUPER_ADMIN");

    const isRated =
      isApprovedByHigher &&
      s.computedScore !== null &&
      s.computedScore !== undefined;

    let reviewStatus: ReviewStatus;
    if (isRejectedByHigher) reviewStatus = "REJECTED";
    else if (isRated) reviewStatus = "DINILAI";
    else if (isApprovedByHigher) reviewStatus = "APPROVED";
    else if (isApprovedBySchool) reviewStatus = "TERVERIFIKASI";
    else reviewStatus = "PENDING";

    const tagNames: string[] = [
      ...(s.tags ?? []).map((t: { name: string }) => t.name).filter(Boolean),
      ...(Array.isArray(s.tagsOtherText) ? s.tagsOtherText : []),
    ];

    const tagCount = Math.min(tagNames.length, 20);
    const tagScoreFallback = tagCount * 5;

    // ✅ resolve scope untuk UI 4-state (khususnya untuk case sekolah)
    const approvedScopeResolved: "SEKOLAH" | "TALENTA" | "SUPER_ADMIN" | null =
      (s.approvedScope as any) ?? (s.status === "APPROVED" ? "SEKOLAH" : null);

    let rejectedScopeResolved: "SEKOLAH" | "TALENTA" | "SUPER_ADMIN" | null = (s.rejectedScope as any) ?? null;
    if (reviewStatus === "REJECTED" && !rejectedScopeResolved) {
      const role = s.rejectedBy?.role;
      if (role === "ADMIN_TALENTA") rejectedScopeResolved = "TALENTA";
      else if (role === "SUPER_ADMIN") rejectedScopeResolved = "SUPER_ADMIN";
      else if (!s.rejectedById) rejectedScopeResolved = "SEKOLAH";
    }

    return {
      id: s.id,
      gtk: {
        nik: s.gtk?.nik ?? "-",
        nama: s.gtk?.name ?? "-",
        sekolah: s.gtk?.school?.name ?? "-",
        npsn: s.gtk?.school?.npsn ?? s.gtk?.schoolNpsn ?? "-",
        fotoUrl: s.gtk?.photoUrl ?? null,
      },

      jumlahTalentaGtk: countById.get(s.id) ?? 0,

      status: s.status,
      reviewStatus,

      skorUser: s.userScore ?? 0,
      skorTag: s.tagScore ?? tagScoreFallback,
      skorJenis: s.jenisScore ?? 0,
      skorAdmin: s.adminScore ?? 0,
      totalSkor: s.computedScore ?? 0,

      skorSekolah,

      approvedAt: s.approvedAt ? s.approvedAt.toISOString() : null,
      approvedBy: s.approvedBy?.name ?? null,
      approvedScope: (s.approvedScope as any) ?? null,
      approvedScopeResolved,
      approvalNote: s.approvalNote ?? null,

      rejectedAt: s.rejectedAt ? s.rejectedAt.toISOString() : null,
      rejectedBy: s.rejectedBy?.name ?? null,
      rejectedScope: (s.rejectedScope as any) ?? null,
      rejectedScopeResolved,
      rejectionNote: s.rejectionNote ?? null,

      detailTalenta: [
        {
          id: s.id,
          namaKegiatan: s.activityName,
          penyelenggara: s.organizer ?? "",
          deskripsi: s.description ?? "",
          jenis: s.type?.name ?? "",
          bidang,
          kategori,
          subKategori,
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
