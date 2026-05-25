import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

type Ctx = { params: Promise<{ userId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params; // ✅ Next.js 15

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        branchId: true,
        schoolNpsn: true,
        gtkNik: true,
        talentFields: { select: { fieldId: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        branchId: user.branchId,
        schoolNpsn: user.schoolNpsn,
        gtkNik: user.gtkNik,
        talentFieldIds: user.talentFields.map((x) => x.fieldId),
      },
    });
  } catch (e) {
    console.error("GET /api/super-admin/users/[userId]/detail error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
