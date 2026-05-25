import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/app/_lib/prisma";
import { TalentSubmissionStatus, Prisma, DecisionScope } from "@prisma/client";

const COOKIE_NAME = "sipodi_session";

type Role = "SUPER_ADMIN" | "ADMIN_TALENTA" | "ADMIN_SEKOLAH" | "USER_GTK";

type SessionPayload = {
  sub: string;
  role: Role;
  branchId: string | null;
  schoolNpsn: string | null;
  gtkNik: string | null;
};

async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, {
      issuer: "sipodi",
      audience: "sipodi-web",
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const branchId = session.branchId;

    const whereSchool: any = {};
    const whereGtk: any = {};
    const whereSubmission: any = {};

    if (branchId) {
      whereSchool.branchId = branchId;
      whereGtk.school = { branchId };
      whereSubmission.gtk = { school: { branchId } };
    }

    // ✅ hanya talenta yang SUDAH DINILAI (talenta / super admin)
    const whereDinilai: any = {
      ...whereSubmission,
      status: TalentSubmissionStatus.APPROVED,
      computedScore: { not: null },
      approvedScope: { in: [DecisionScope.TALENTA, DecisionScope.SUPER_ADMIN] },
    };

    // ✅ hanya talenta yang SUDAH TERVERIFIKASI sekolah
    const whereTerverifikasi: any = {
      ...whereSubmission,
      status: TalentSubmissionStatus.APPROVED,
      approvedScope: DecisionScope.SEKOLAH,
    };

    const [
      totalSchools,
      totalGtks,
      totalTalents,
      totalVerifiedTalents,
      totalScoredTalents,

      talentByTypeRaw,
      fieldStatsRaw,

      recentGtksRaw,
      recentTalentsRaw,
      gtkAgg,

      gtkTopScoreAgg,
      gtkTopTalentaAgg,
      sekolahTopRateRaw,
    ] = await Promise.all([
      prisma.school.count({ where: whereSchool }),
      prisma.gtk.count({ where: whereGtk }),
      prisma.talentSubmission.count({ where: whereSubmission }),

      prisma.talentSubmission.count({ where: whereTerverifikasi }),

      prisma.talentSubmission.count({ where: whereDinilai }),

      prisma.talentSubmission.groupBy({
        where: whereSubmission,
        by: ["typeId"],
        _count: { _all: true },
      }),

      prisma.talentSubmissionField.groupBy({
        by: ['fieldId'],
        _count: { fieldId: true },
        where: branchId ? { 
          submission: { 
            gtk: { school: { branchId } } 
          } 
        } : {},
      }),

      prisma.gtk.findMany({
        where: whereGtk,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          nik: true,
          name: true,
          type: true,
          school: { select: { name: true, city: true, level: true } },
        },
      }),

      prisma.talentSubmission.findMany({
        where: {
          OR: [
            whereTerverifikasi,
            whereDinilai
          ]
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          activityName: true,
          gtk: { select: { name: true, type: true } },
          type: { select: { name: true } },
        },
      }),

      prisma.gtk.groupBy({
        where: whereGtk,
        by: ["schoolNpsn"],
        _count: { _all: true },
      }),

      prisma.talentSubmission.groupBy({
        where: whereDinilai,
        by: ["gtkNik"],
        _avg: { computedScore: true },
        _count: { id: true },
        orderBy: [{ _avg: { computedScore: "desc" } }],
        take: 10,
      }),

      prisma.talentSubmission.groupBy({
        where: whereDinilai,
        by: ["gtkNik"],
        _count: { id: true },
        orderBy: [{ _count: { id: "desc" } }],
        take: 10,
      }),

      prisma.$queryRaw<
        Array<{
          npsn: string;
          name: string;
          city: string;
          total_gtk: number;
          total_dinilai: number;
          rate: number;
        }>
      >(Prisma.sql`
        SELECT
          sch."npsn"::text AS npsn,
          sch."name"::text AS name,
          sch."city"::text AS city,
          COUNT(DISTINCT g."nik")::int AS total_gtk,
          COUNT(ts."id")::int AS total_dinilai,
          CASE
            WHEN COUNT(DISTINCT g."nik") = 0 THEN 0
            ELSE (COUNT(ts."id")::float8 / COUNT(DISTINCT g."nik")::float8)
          END AS rate
        FROM "schools" sch
        LEFT JOIN "gtks" g ON g."schoolNpsn" = sch."npsn"
        LEFT JOIN "talent_submissions" ts
          ON ts."gtkNik" = g."nik"
         AND ts."status" = ${TalentSubmissionStatus.APPROVED}
         AND ts."computedScore" IS NOT NULL
         AND ts."approvedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN})
        ${branchId ? Prisma.sql`WHERE sch."branchId" = ${branchId}` : Prisma.empty}
        GROUP BY sch."npsn", sch."name", sch."city"
        ORDER BY rate DESC
        LIMIT 10
      `),
    ]);

    // ===== PIE CHART GTK per jenjang/kota =====
    const schools = await prisma.school.findMany({
      where: { npsn: { in: gtkAgg.map((g) => g.schoolNpsn) } },
      select: { npsn: true, level: true, city: true },
    });

    const levelCounts: Record<string, number> = { SMA: 0, SMK: 0, SLB: 0 };
    const cityCounts: Record<string, number> = {};

    gtkAgg.forEach((g) => {
      const s = schools.find((x) => x.npsn === g.schoolNpsn);
      if (!s) return;
      levelCounts[s.level] = (levelCounts[s.level] || 0) + g._count._all;
      cityCounts[s.city] = (cityCounts[s.city] || 0) + g._count._all;
    });

    const gtkByLevel = Object.entries(levelCounts).map(([level, total]) => ({ level, total }));
    const gtkByCity = Object.entries(cityCounts).map(([city, total]) => ({ city, total }));

    // ===== BAR CHARTS =====
    const talentTypes = await prisma.talentType.findMany({
      where: { id: { in: talentByTypeRaw.map((t) => t.typeId) } },
      select: { id: true, name: true },
    });

    const talentByType = talentByTypeRaw.map((t) => ({
      name: talentTypes.find((x) => x.id === t.typeId)?.name ?? "Tidak diketahui",
      total: t._count._all,
    }));

    const talentFields = await prisma.talentField.findMany({
      where: { id: { in: fieldStatsRaw.map((f) => f.fieldId) } },
      select: { id: true, name: true },
    });

    const talentByField = fieldStatsRaw.map((f) => ({
      name: talentFields.find((x) => x.id === f.fieldId)?.name ?? f.fieldId ?? "Tidak diketahui",
      total: f._count.fieldId,
    }));

    // ===== GTK TERBARU =====
    const recentGtks = recentGtksRaw.map((g) => ({
      nik: g.nik,
      name: g.name,
      type: g.type ?? null,
      schoolName: g.school?.name ?? "-",
      schoolCity: g.school?.city ?? "-",
    }));

    const recentTalents = recentTalentsRaw.map((t) => ({
      id: t.id,
      typeName: t.type?.name ?? "-",
      activityName: t.activityName ?? "-",
      gtkName: t.gtk?.name ?? "-",
      gtkType: t.gtk?.type ?? null,
    }));

    // ===== TOP 10 GTK (butuh detail GTK) =====
    const topGtkNiks = Array.from(
      new Set([...gtkTopScoreAgg.map((x) => x.gtkNik), ...gtkTopTalentaAgg.map((x) => x.gtkNik)])
    );

    const topGtks = await prisma.gtk.findMany({
      where: { nik: { in: topGtkNiks } },
      select: { nik: true, name: true, school: { select: { name: true, city: true } } },
    });

    const gtkMap = new Map(topGtks.map((g) => [g.nik, g]));

    const gtkTopScore = gtkTopScoreAgg.map((x) => {
      const g = gtkMap.get(x.gtkNik);
      const total =
        typeof x._count === "object" && x._count && "id" in x._count
          ? Number((x._count as any).id ?? 0)
          : 0;

      return {
        nik: x.gtkNik,
        name: g?.name ?? x.gtkNik,
        schoolName: g?.school?.name ?? "-",
        schoolCity: g?.school?.city ?? "-",
        avgScore: Number(x._avg?.computedScore ?? 0),
        totalTalentaDinilai: total,
      };
    });

    const gtkTopTalenta = gtkTopTalentaAgg.map((x) => {
      const g = gtkMap.get(x.gtkNik);
      const total =
        typeof x._count === "object" && x._count && "id" in x._count
          ? Number((x._count as any).id ?? 0)
          : 0;

      return {
        nik: x.gtkNik,
        name: g?.name ?? x.gtkNik,
        schoolName: g?.school?.name ?? "-",
        schoolCity: g?.school?.city ?? "-",
        totalTalentaDinilai: total,
      };
    });

    const sekolahTopRate = sekolahTopRateRaw.map((s) => ({
      npsn: s.npsn,
      name: s.name,
      city: s.city,
      totalGtk: Number(s.total_gtk ?? 0),
      totalTalentaDinilai: Number(s.total_dinilai ?? 0),
      rate: Number(s.rate ?? 0),
    }));

    return NextResponse.json({
      totalSchools,
      totalGtks,
      totalTalents,

      totalVerifiedTalents,
      totalScoredTalents,

      gtkByLevel,
      gtkByCity,
      talentByType,
      talentByField,
      recentGtks,
      recentTalents,

      sekolahTopRate,
      gtkTopScore,
      gtkTopTalenta,
    });
  } catch (e) {
    console.error("GET /api/super-admin/dashboard error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
