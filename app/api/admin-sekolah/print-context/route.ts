import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN_SEKOLAH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.schoolNpsn) {
      return NextResponse.json(
        { error: "Admin sekolah belum terikat ke sekolah" },
        { status: 400 }
      );
    }

    // Ambil sekolah + branch + letterhead cabang
    const school = await prisma.school.findUnique({
      where: { npsn: session.schoolNpsn },
      select: {
        npsn: true,
        name: true,
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
            letterhead: {
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
            },
          },
        },
      },
    });

    if (!school) {
      return NextResponse.json({ error: "Sekolah tidak ditemukan" }, { status: 404 });
    }

    if (!school.branch?.letterhead) {
      return NextResponse.json(
        { error: "Letterhead cabang belum di-set (branch_letterheads)." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      gtk: {
        name: "Admin Sekolah",
        schoolName: school.name,
      },
      branch: {
        id: school.branch.id,
        name: school.branch.name,
        city: school.branch.city,
      },
      letterhead: school.branch.letterhead,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
