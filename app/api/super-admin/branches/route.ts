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
    const simple = searchParams.get("simple") === "1";

    const branches = await prisma.branch.findMany({
      orderBy: { name: "asc" },
      select: simple
        ? { id: true, name: true, city: true }
        : { id: true, name: true, city: true, createdAt: true },
    });

    return NextResponse.json({ data: branches });
  } catch (e) {
    console.error("GET /api/super-admin/branches error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
