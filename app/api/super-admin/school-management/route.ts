import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { z } from "zod";
import { GtkType, Prisma, TalentSubmissionStatus, DecisionScope } from "@prisma/client";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional().default(""),
  level: z.enum(["SMA", "SMK", "SLB"]).optional(),
  status: z.enum(["NEGERI", "SWASTA"]).optional(),
  city: z.string().optional(),
  branchId: z.string().optional(),

  minRate: z.coerce.number().min(0).max(1).optional(),
  maxRate: z.coerce.number().min(0).max(1).optional(),

  sort: z.enum(["name", "rate"]).optional().default("name"),
  dir: z.enum(["asc", "desc"]).optional().default("asc"),
});


const createSchoolSchema = z.object({
  npsn: z.string().min(3).max(32),
  name: z.string().min(2),
  level: z.enum(["SMA", "SMK", "SLB"]),
  status: z.enum(["NEGERI", "SWASTA"]),
  city: z.string().min(2),
  headName: z.string().optional().nullable(),
  headNip: z.string().optional().nullable(),
  headRank: z.string().optional().nullable(),
  branchId: z.string().min(1).optional(),
});

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return jsonError(401, "Unauthorized");
  }

  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    level: url.searchParams.get("level") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    city: url.searchParams.get("city") ?? undefined,
    branchId: url.searchParams.get("branchId") ?? undefined,
    minRate: url.searchParams.get("minRate") ?? undefined,
    maxRate: url.searchParams.get("maxRate") ?? undefined,

    sort: url.searchParams.get("sort") ?? undefined,
    dir: url.searchParams.get("dir") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid query parameters");
  }

  const { page, pageSize, q, level, status, city, branchId, minRate, maxRate, sort, dir } = parsed.data;
  const orderDir = dir === "desc" ? "desc" : "asc";

  const where: any = {};
  if (branchId?.trim()) where.branchId = branchId.trim();
  if (level) where.level = level;
  if (status) where.status = status;
  if (city) where.city = { contains: city, mode: "insensitive" };
  if (q?.trim()) {
    const qq = q.trim();
    where.OR = [
      { npsn: { contains: qq, mode: "insensitive" } },
      { name: { contains: qq, mode: "insensitive" } },
      { city: { contains: qq, mode: "insensitive" } },
    ];
  }

  if (sort === "name") {
    const skip = (page - 1) * pageSize;

    const [total, data] = await Promise.all([
      prisma.school.count({ where }),
      prisma.school.findMany({
        where,
        orderBy: { name: orderDir },
        skip,
        take: pageSize,
        select: {
          npsn: true,
          name: true,
          level: true,
          status: true,
          city: true,
          headName: true,
          headNip: true,
          headRank: true,
          branchId: true,
          createdAt: true,
          updatedAt: true,
          gtks: {
            where: { type: GtkType.KEPALA_SEKOLAH },
            select: { name: true },
            orderBy: { name: "asc" },
          },
          _count: { select: { gtks: true } },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const npsnList = data.map((s) => s.npsn);
    const dinilaiBySchool = new Map<string, number>();

    if (npsnList.length > 0) {
      const rows = await prisma.$queryRaw<Array<{ npsn: string; total_dinilai: number }>>(
        Prisma.sql`
          SELECT
            sch."npsn"::text AS npsn,
            COUNT(ts."id")::int AS total_dinilai
          FROM "talent_submissions" ts
          JOIN "gtks" g ON g."nik" = ts."gtkNik"
          JOIN "schools" sch ON sch."npsn" = g."schoolNpsn"
          WHERE sch."npsn" IN (${Prisma.join(npsnList)})
            AND ts."status" = ${TalentSubmissionStatus.APPROVED}
            AND ts."approvedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})
            AND ts."computedScore" IS NOT NULL
          GROUP BY sch."npsn"
        `
      );

      for (const r of rows) {
        dinilaiBySchool.set(String(r.npsn), Number((r as any).total_dinilai ?? 0));
      }
    }

    let mapped = data.map((s) => {
      const kepalaNames = s.gtks.map((g) => g.name).filter((n): n is string => !!n && n.trim().length > 0);
      const totalGtk = s._count?.gtks ?? 0;
      const totalTalentaDinilai = dinilaiBySchool.get(s.npsn) ?? 0;
      const rate = totalGtk > 0 ? totalTalentaDinilai / totalGtk : 0;

      return {
        npsn: s.npsn,
        name: s.name,
        level: s.level,
        status: s.status,
        city: s.city,
        branchId: s.branchId,
        headName: kepalaNames.length > 0 ? kepalaNames.join(", ") : s.headName ?? null,
        headNip: s.headNip,
        headRank: s.headRank,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        _count: s._count,
        totalTalentaDinilai,
        rate,
      };
    });

    if (typeof minRate === "number") mapped = mapped.filter((s) => s.rate >= minRate);
    if (typeof maxRate === "number") mapped = mapped.filter((s) => s.rate <= maxRate);

    return NextResponse.json({ data: mapped, page, pageSize, total, totalPages });
  }

  const allSchools = await prisma.school.findMany({
    where,
    select: {
      npsn: true,
      name: true,
      level: true,
      status: true,
      city: true,
      headName: true,
      headNip: true,
      headRank: true,
      branchId: true,
      createdAt: true,
      updatedAt: true,
      gtks: {
        where: { type: GtkType.KEPALA_SEKOLAH },
        select: { name: true },
        orderBy: { name: "asc" },
      },
      _count: { select: { gtks: true } },
    },
  });

  const npsnList = allSchools.map((s) => s.npsn);
  const dinilaiBySchool = new Map<string, number>();

  if (npsnList.length > 0) {
    const rows = await prisma.$queryRaw<Array<{ npsn: string; total_dinilai: number }>>(
      Prisma.sql`
        SELECT
          sch."npsn"::text AS npsn,
          COUNT(ts."id")::int AS total_dinilai
        FROM "talent_submissions" ts
        JOIN "gtks" g ON g."nik" = ts."gtkNik"
        JOIN "schools" sch ON sch."npsn" = g."schoolNpsn"
        WHERE sch."npsn" IN (${Prisma.join(npsnList)})
          AND ts."status" = ${TalentSubmissionStatus.APPROVED}
          AND ts."approvedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})
          AND ts."computedScore" IS NOT NULL
        GROUP BY sch."npsn"
      `
    );

    for (const r of rows) {
      dinilaiBySchool.set(String(r.npsn), Number((r as any).total_dinilai ?? 0));
    }
  }

  let mappedAll = allSchools.map((s) => {
    const kepalaNames = s.gtks.map((g) => g.name).filter((n): n is string => !!n && n.trim().length > 0);
    const totalGtk = s._count?.gtks ?? 0;
    const totalTalentaDinilai = dinilaiBySchool.get(s.npsn) ?? 0;
    const rate = totalGtk > 0 ? totalTalentaDinilai / totalGtk : 0;

    return {
      npsn: s.npsn,
      name: s.name,
      level: s.level,
      status: s.status,
      city: s.city,
      branchId: s.branchId,
      headName: kepalaNames.length > 0 ? kepalaNames.join(", ") : s.headName ?? null,
      headNip: s.headNip,
      headRank: s.headRank,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      _count: s._count,
      totalTalentaDinilai,
      rate,
    };
  });

  if (typeof minRate === "number") mappedAll = mappedAll.filter((s) => s.rate >= minRate);
  if (typeof maxRate === "number") mappedAll = mappedAll.filter((s) => s.rate <= maxRate);

  mappedAll.sort((a, b) => {
    const diff = (b.rate ?? 0) - (a.rate ?? 0);
    if (diff !== 0) return orderDir === "desc" ? diff : -diff;
    return a.name.localeCompare(b.name, "id-ID");
  });

  const total = mappedAll.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageData = mappedAll.slice(start, start + pageSize);

  return NextResponse.json({
    data: pageData,
    page,
    pageSize,
    total,
    totalPages,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return jsonError(401, "Unauthorized");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Body must be valid JSON");
  }

  const parsed = createSchoolSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid body");
  }

  const input = parsed.data;

  // ✅ untuk SUPER_ADMIN global, branchId wajib ditentukan dari input (bukan dari token)
  const branchId = input.branchId?.trim() ?? null;
  if (!branchId) {
    return jsonError(400, "branchId wajib diisi untuk membuat sekolah.");
  }

  // validasi cabang ada
  const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
  if (!b) return jsonError(400, "Cabang tidak ditemukan.");

  try {
    const created = await prisma.school.create({
      data: {
        npsn: input.npsn,
        name: input.name,
        level: input.level,
        status: input.status,
        city: input.city,
        headName: input.headName ?? null,
        headNip: input.headNip ?? null,
        headRank: input.headRank ?? null,
        branchId,
      },
      select: {
        npsn: true,
        name: true,
        level: true,
        status: true,
        city: true,
        headName: true,
        headNip: true,
        headRank: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return jsonError(409, "NPSN sudah digunakan");
    }
    console.error("POST /api/super-admin/school-management error:", e);
    return jsonError(500, "Internal error");
  }
}
