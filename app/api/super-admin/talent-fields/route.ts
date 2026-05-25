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
    const active = searchParams.get("active");
    const simple = searchParams.get("simple");

    const where: any = {};

    if (simple === "1" && active === null) where.isActive = true;

    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;

    const rows = await prisma.talentField.findMany({
      where,
      orderBy: { name: "asc" },
      select: { id: true, name: true, isActive: true },
    });

    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error("GET /api/super-admin/talent-fields error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
