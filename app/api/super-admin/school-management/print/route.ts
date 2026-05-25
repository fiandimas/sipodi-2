import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import {
  Prisma,
  TalentSubmissionStatus,
  DecisionScope,
  UserRole,
  SchoolLevel,
  SchoolStatus,
} from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    // 1) Auth pakai enum role
    if (!session || session.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Ambil branchId dari UserAccess (bukan session)
    const userId = session.sub;
    const superAccess = await prisma.userAccess.findFirst({
      where: { userId, role: UserRole.SUPER_ADMIN },
      orderBy: { createdAt: "desc" },
      select: { branchId: true },
    });
    const branchId = superAccess?.branchId ?? null;

    if (!branchId) {
      return NextResponse.json(
        { error: "SUPER_ADMIN belum terikat ke cabang (branchId null di UserAccess)." },
        { status: 400 }
      );
    }

    // 3) Ambil filter dari query params
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const city = searchParams.get("city") || "all";

    const levelParam = searchParams.get("level");
    const level: SchoolLevel | undefined =
      levelParam && levelParam !== "all" ? (levelParam as SchoolLevel) : undefined;

    const statusParam = searchParams.get("status");
    const status: SchoolStatus | undefined =
      statusParam && statusParam !== "all" ? (statusParam as SchoolStatus) : undefined;

    // 4) Query sekolah di branch tersebut
    const schools = await prisma.school.findMany({
      where: {
        branchId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { npsn: { contains: q } },
                { city: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(level ? { level } : {}),
        ...(status ? { status } : {}),
        ...(city !== "all" ? { city } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        npsn: true,
        name: true,
        level: true,
        status: true,
        city: true,
        headName: true,
        _count: { select: { gtks: true } },
      },
    }) as Array<{
      npsn: string;
      name: string;
      level: SchoolLevel;
      status: SchoolStatus;
      city: string;
      headName: string | null;
      _count: { gtks: number };
    }>;

    // 5) Hitung skor per sekolah
    const npsnList = schools.map((s) => s.npsn);
    const scoreBySchool = new Map<string, number>();

    if (npsnList.length > 0) {
      const scoreRows =
        await prisma.$queryRaw<Array<{ npsn: string; total_score: number }>>(
          Prisma.sql`
          SELECT
            sch."npsn"::text AS npsn,
            COALESCE(SUM(ts."computedScore"), 0)::float8 AS total_score
          FROM "talent_submissions" ts
          JOIN "gtks" g ON g."nik" = ts."gtkNik"
          JOIN "schools" sch ON sch."npsn" = g."schoolNpsn"
          WHERE sch."npsn" IN (${Prisma.join(npsnList)})
            AND (
              (ts."status" = ${TalentSubmissionStatus.APPROVED}
                AND ts."approvedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN}))
              OR
              (ts."status" = ${TalentSubmissionStatus.REJECTED}
                AND ts."rejectedScope" IN (${DecisionScope.TALENTA}, ${DecisionScope.SUPER_ADMIN}))
            )
          GROUP BY sch."npsn"
        `
        );

      for (const r of scoreRows) {
        scoreBySchool.set(String(r.npsn), Number(r.total_score ?? 0));
      }
    }

    // 6) Bentuk data akhir
    const data = schools.map((s) => {
      const jumlahGtk = s._count.gtks ?? 0;
      const totalScoreFinal = scoreBySchool.get(s.npsn) ?? 0;
      const rate = jumlahGtk > 0 ? totalScoreFinal / jumlahGtk : 0;

      return {
        npsn: s.npsn,
        name: s.name,
        level: s.level,
        status: s.status,
        city: s.city,
        headName: s.headName ?? null,
        jumlahGtk,
        totalScoreFinal,
        rate,
      };
    });

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    console.error("GET /super-admin/school-management/print error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}
