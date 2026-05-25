// app/api/super-admin/print-context/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { UserRole } from "@prisma/client";

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ambil branchId dari UserAccess (jika ada)
    const superAccess = await prisma.userAccess.findFirst({
      where: { userId: session.sub, role: UserRole.SUPER_ADMIN },
      orderBy: { createdAt: "desc" },
      select: { branchId: true },
    });

    const branchId = superAccess?.branchId ?? null;

    // Ambil data branch & letterhead jika ada
    let branch = null;
    if (branchId) {
      branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: {
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
      });
    }

    return NextResponse.json({
      gtk: null,
      branch: branchId ? { id: branchId, city: branch?.city ?? null } : null,
      branchCity: branch?.city ?? null,
      letterhead: branch?.letterhead ?? {
        title: null,
        address: null,
        phone: null,
        email: null,
        logoPath: null,
        signerName: null,
        signerRank: null,
        signerNip: null,
        signerRole: null,
      },
    });
  } catch (err) {
    console.error("GET /super-admin/print-context error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
