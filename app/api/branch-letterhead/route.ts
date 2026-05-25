// app/api/branch-letterhead/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { UserRole } from "@prisma/client";

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    console.log("=== SESSION DEBUG ===");
console.log("session.sub =", session?.sub);
console.log("session.role =", session?.role);
console.log("session.branchId =", session?.branchId);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.sub;

    // ✅ source of truth: user_access, bukan session.branchId
    const access = await prisma.userAccess.findFirst({
      where: { userId, role: UserRole.SUPER_ADMIN },
      orderBy: { createdAt: "desc" },
      select: { branchId: true },
    });

    const branchId = access?.branchId ?? null;
    if (!branchId) {
      return NextResponse.json(
        { error: "SUPER_ADMIN belum terikat ke cabang (branchId null di user_access)." },
        { status: 400 }
      );
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, city: true, name: true },
    });
    if (!branch) {
      return NextResponse.json({ error: "Cabang tidak ditemukan." }, { status: 400 });
    }

    const letterhead = await prisma.branchLetterhead.findUnique({
      where: { branchId },
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

    if (!letterhead) {
      return NextResponse.json(
        { error: "Kop cabang belum diset. Isi data BranchLetterhead (branch_letterheads) terlebih dulu." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        branchId,
        branchCity: branch.city ?? null,
        letterhead,
      },
    });
  } catch (e) {
    console.error("GET /api/branch-letterhead error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
