// app/api/admin-talenta/print-context/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { UserRole } from "@prisma/client";

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== UserRole.ADMIN_TALENTA) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ambil branchId dari session atau fallback ke userAccess
    let branchId = (session as any).branchId ?? null;

    if (!branchId) {
      const adminAccess = await prisma.userAccess.findFirst({
        where: { userId: session.sub },
        orderBy: { createdAt: "desc" },
        select: { branchId: true },
      });
      branchId = adminAccess?.branchId ?? null;
    }

    // Jika tetap null, fallback ke branch pertama di DB (optional)
    if (!branchId) {
      const firstBranch = await prisma.branch.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      branchId = firstBranch?.id ?? null;
    }

    if (!branchId) {
      return NextResponse.json(
        { error: "Belum ada branch tersedia." },
        { status: 400 }
      );
    }

    // Ambil data branch & letterhead
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
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
    });

    if (!branch) {
      return NextResponse.json(
        { error: "Branch tidak ditemukan." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      gtk: null,
      branch: {
        id: branch.id,
        name: branch.name,
        city: branch.city,
      },
      letterhead: branch.letterhead ?? {
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
    console.error("GET /admin-talenta/print-context error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
