import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      niks?: string[];
    } | null;

    const niks = body?.niks ?? [];
    if (!Array.isArray(niks) || niks.length === 0) {
      return NextResponse.json(
        { error: "niks array is required" },
        { status: 400 }
      );
    }

    const branchId = (session as any).branchId as string | null;

    const gtkData = await prisma.gtk.findMany({
      where: {
        nik: { in: niks },
        ...(branchId ? { school: { branchId } } : {}),
      },
      include: {
        school: {
          select: { name: true, city: true, npsn: true, branchId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: gtkData });
  } catch (error) {
    console.error("Selected GTK fetch error:", error);
    return NextResponse.json(
      { error: "Failed to get data" },
      { status: 500 }
    );
  }
}
