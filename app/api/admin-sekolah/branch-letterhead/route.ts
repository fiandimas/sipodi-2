// app/api/admin-sekolah/branch-letterhead/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { UserRole } from "@prisma/client";

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();

    // Auth
    if (!session || session.role !== UserRole.ADMIN_SEKOLAH) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schoolNpsn = session.schoolNpsn;
    if (!schoolNpsn) {
      return NextResponse.json(
        { error: "Admin sekolah tidak memiliki schoolNpsn." },
        { status: 400 }
      );
    }

    // Ambil sekolah → untuk branchId dan city
    const school = await prisma.school.findUnique({
      where: { npsn: schoolNpsn },
      select: {
        npsn: true,
        name: true,
        city: true,
        branchId: true,
      },
    });

    if (!school) {
      return NextResponse.json(
        { error: "Data sekolah tidak ditemukan." },
        { status: 404 }
      );
    }

    if (!school.branchId) {
      return NextResponse.json(
        { error: "Sekolah tidak memiliki branchId." },
        { status: 400 }
      );
    }

    // Ambil kop CABANG DINAS (branch letterhead)
    const branchLetterhead = await prisma.branchLetterhead.findUnique({
      where: { branchId: school.branchId },
      select: {
        title: true,
        address: true,
        phone: true,
        email: true,
        logoPath: true,
        signerName: true,
        signerRank: true,
        signerNip: true,
        signerRole: true,
      },
    });

    if (!branchLetterhead) {
      return NextResponse.json(
        {
          error:
            "Kop cabang tidak ditemukan. Isi tabel branch_letterheads terlebih dulu.",
        },
        { status: 400 }
      );
    }

    // FORMAT 100% SAMA DENGAN SUPER ADMIN!
    return NextResponse.json({
      ok: true,
      data: {
        branchId: school.branchId, // identik dengan super admin
        branchCity: school.city ?? null,
        letterhead: branchLetterhead,
      },
    });
  } catch (e) {
    console.error("GET /api/admin-sekolah/branch-letterhead error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
