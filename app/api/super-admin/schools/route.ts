import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId")?.trim() || null;

    const where: any = {};
    if (branchId) where.branchId = branchId;

    const schools = await prisma.school.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        npsn: true,
        name: true,
        city: true,
        level: true,
        status: true,
        branchId: true,
        branch: { select: { id: true, name: true, city: true } },
      },
    });

    return NextResponse.json({ data: schools });
  } catch (e) {
    console.error("GET /api/super-admin/schools error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
