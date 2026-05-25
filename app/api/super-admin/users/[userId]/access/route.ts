import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { UserRole } from "@prisma/client";

type Body = {
  role?: "ADMIN_SEKOLAH";
  schoolNpsn?: string | null;
  branchId?: string | null; // optional input, tapi akan ditentukan dari sekolah
};

const DEFAULT_BRANCH_ID = "cabdin-malang";

function normStr(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const v = x.trim();
  return v ? v : null;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await ctx.params;

    const access = await prisma.userAccess.findMany({
      where: { userId, role: UserRole.ADMIN_SEKOLAH },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        role: true,
        createdAt: true,
        schoolNpsn: true,
        branchId: true,
        school: { select: { npsn: true, name: true, city: true } },
        branch: { select: { id: true, name: true, city: true } },
      },
    });

    return NextResponse.json({ data: access });
  } catch (e) {
    console.error("GET /api/super-admin/users/[userId]/access error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Body;

    const role = body.role ?? "ADMIN_SEKOLAH";
    if (role !== "ADMIN_SEKOLAH") {
      return NextResponse.json({ error: "Role tidak didukung." }, { status: 400 });
    }

    const schoolNpsn = normStr(body.schoolNpsn);
    if (!schoolNpsn) {
      return NextResponse.json(
        { error: "schoolNpsn wajib diisi untuk akses ADMIN_SEKOLAH." },
        { status: 400 }
      );
    }

    // Validasi user ada
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    // Ambil branchId dari sekolah (sumber kebenaran)
    const school = await prisma.school.findUnique({
      where: { npsn: schoolNpsn },
      select: { npsn: true, branchId: true },
    });
    if (!school) {
      return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 400 });
    }

    const resolvedBranchId = school.branchId ?? DEFAULT_BRANCH_ID;

    // Validasi default branch ada (untuk fallback)
    const branch = await prisma.branch.findUnique({
      where: { id: resolvedBranchId },
      select: { id: true },
    });
    if (!branch) {
      return NextResponse.json(
        { error: `Branch '${resolvedBranchId}' tidak ditemukan (cek seed branches).` },
        { status: 500 }
      );
    }

    // Idempotent: kalau sudah ada akses untuk schoolNpsn tsb, return existing
    const existing = await prisma.userAccess.findFirst({
      where: {
        userId,
        role: UserRole.ADMIN_SEKOLAH,
        schoolNpsn: school.npsn,
      },
      select: {
        id: true,
        role: true,
        createdAt: true,
        schoolNpsn: true,
        branchId: true,
        school: { select: { npsn: true, name: true, city: true } },
        branch: { select: { id: true, name: true, city: true } },
      },
    });

    if (existing) {
      // optional: repair kalau branchId lama null/salah
      if (existing.branchId !== resolvedBranchId) {
        const fixed = await prisma.userAccess.update({
          where: { id: existing.id },
          data: { branchId: resolvedBranchId },
          select: {
            id: true,
            role: true,
            createdAt: true,
            schoolNpsn: true,
            branchId: true,
            school: { select: { npsn: true, name: true, city: true } },
            branch: { select: { id: true, name: true, city: true } },
          },
        });
        return NextResponse.json({ data: fixed }, { status: 200 });
      }

      return NextResponse.json({ data: existing }, { status: 200 });
    }

    const created = await prisma.userAccess.create({
      data: {
        userId,
        role: UserRole.ADMIN_SEKOLAH,
        schoolNpsn: school.npsn,
        branchId: resolvedBranchId, // ✅ selalu set
      },
      select: {
        id: true,
        role: true,
        createdAt: true,
        schoolNpsn: true,
        branchId: true,
        school: { select: { npsn: true, name: true, city: true } },
        branch: { select: { id: true, name: true, city: true } },
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/super-admin/users/[userId]/access error:", e);

    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Akses sudah ada." }, { status: 409 });
    }

    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
