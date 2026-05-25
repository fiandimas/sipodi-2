import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import type { UserRole } from "@prisma/client";
import type { UserPrintItem } from "@/lib/print-utils";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const role = searchParams.get("role") as UserRole | null;
    const branchId = searchParams.get("branchId") || undefined;
    const schoolNpsn = searchParams.get("schoolNpsn") || undefined;
    const isActive = searchParams.get("isActive");

    const where: any = {};
    if (q) {
      where.OR = [
        { username: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ];
    }
    if (role) where.role = role;
    if (branchId) where.branchId = branchId;
    if (schoolNpsn) where.schoolNpsn = schoolNpsn;
    if (isActive === "true") where.isActive = true;
    if (isActive === "false") where.isActive = false;

    // ambil semua user yang match filter (tanpa pagination)
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        branch: {
          select: { id: true, name: true, city: true },
        },
        school: {
          select: { npsn: true, name: true, city: true },
        },
        gtk: {
          select: { nik: true, name: true, schoolNpsn: true },
        },
      },
    });

    const data: UserPrintItem[] = users.map((u) => ({
      username: u.username,
      name: u.name,
      role: u.role, // string enum
      isActive: u.isActive,
      gtkName: u.gtk?.name ?? null,
      schoolName: u.school?.name ?? null,
      branchName: u.branch?.name ?? null,
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch (e) {
    console.error("GET /api/super-admin/users/print error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
