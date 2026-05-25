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
    const withUser = searchParams.get("withUser") === "1"; // ✅ FE Anda pakai ini
    const q = searchParams.get("q")?.trim() || "";
    const includeUserId = searchParams.get("includeUserId")?.trim() || "";

    // Build OR secara aman
    const or: any[] = [];

    if (q) {
      or.push(
        { nik: { contains: q } },
        { name: { contains: q, mode: "insensitive" } }
      );
    }

    // include GTK yang dipakai user tertentu (untuk edit modal)
    if (includeUserId) {
      // untuk relation optional 1-1, gunakan `is`
      or.push({ user: { is: { id: includeUserId } } });
    }

    const where = or.length ? { OR: or } : {};

    const gtks = await prisma.gtk.findMany({
      where,
      orderBy: { name: "asc" },
      take: 300,
      select: simple
        ? {
            nik: true,
            name: true,
            schoolNpsn: true,
            school: { select: { name: true } },
            // ✅ hanya include user kalau diminta (hemat payload)
            user: withUser || includeUserId ? { select: { id: true } } : false,
          }
        : {
            nik: true,
            name: true,
            email: true,
            schoolNpsn: true,
            school: { select: { name: true, city: true } },
            user: withUser || includeUserId ? { select: { id: true } } : false,
          },
    });

    const data = gtks.map((g: any) => ({
      nik: g.nik,
      name: g.name,
      schoolName: g.school?.name ?? "-",
      hasUser: !!g.user,
      userId: g.user?.id ?? null,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    console.error("GET /api/super-admin/gtks error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
