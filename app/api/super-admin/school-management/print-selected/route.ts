import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import {
  Prisma,
  TalentSubmissionStatus,
  DecisionScope,
  UserRole,
} from "@prisma/client";
import type { SchoolPrintItem } from "@/lib/print-utils";

type Body = { npsns?: string[] };

export async function POST(req: Request) {
  try {
    const session = await getSession();

    // 1) Auth: pakai enum role (hindari string typo SUPER_ADMIN vs SUPERADMIN)
    if (!session || session.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Source of truth branchId: ambil dari UserAccess (bukan session.branchId)
    const userId = session.sub;
    const superAccess = await prisma.userAccess.findFirst({
      where: { userId, role: UserRole.SUPER_ADMIN },
      orderBy: { createdAt: "desc" },
      select: { branchId: true },
    });

    const branchId = superAccess?.branchId ?? null;
    if (!branchId) {
      return NextResponse.json(
        { error: "SUPERADMIN belum terikat ke cabang (branchId null di UserAccess)." },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.npsns || !Array.isArray(body.npsns) || body.npsns.length === 0) {
      return NextResponse.json(
        { error: "npsns harus berupa array dan tidak boleh kosong." },
        { status: 400 }
      );
    }

    const uniqueNpsns = Array.from(
      new Set(body.npsns.filter((n) => typeof n === "string" && n.trim().length > 0))
    );

    if (uniqueNpsns.length === 0) {
      return NextResponse.json({ error: "Daftar NPSN tidak valid." }, { status: 400 });
    }

    // 3) Ambil sekolah hanya dalam cabang superadmin tsb
    const schools = await prisma.school.findMany({
      where: {
        branchId,
        npsn: { in: uniqueNpsns },
      },
      select: {
        npsn: true,
        name: true,
        level: true,
        status: true,
        city: true,
        headName: true,
        _count: { select: { gtks: true } },
      },
    });

    if (schools.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada sekolah yang cocok dengan NPSN yang dikirim." },
        { status: 404 }
      );
    }

    // 4) Agregasi skor final per sekolah (hanya keputusan TALENTA/SUPERADMIN)
    const npsnList = schools.map((s) => s.npsn);
    const scoreBySchool = new Map<string, number>();

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

    const data: SchoolPrintItem[] = schools.map((s) => {
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
        rate,
      };
    });

    // 5) Sort mengikuti urutan input FE
    const orderMap = new Map(uniqueNpsns.map((n, idx) => [n, idx]));
    data.sort((a, b) => (orderMap.get(a.npsn) ?? 0) - (orderMap.get(b.npsn) ?? 0));

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    console.error("Error /school-management/print-selected:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}
