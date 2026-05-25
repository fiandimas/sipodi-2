import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { UserRole } from "@prisma/client";

type Ctx = { params: Promise<{ userId: string }> };

const DEFAULT_BRANCH_ID = "cabdin-malang";

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params; // ✅ wajib await di Next.js 15

    const row = await prisma.userAccess.findFirst({
      where: { userId, role: UserRole.SUPER_ADMIN },
      select: { id: true, createdAt: true, branchId: true },
    });

    return NextResponse.json({
      ok: true,
      enabled: !!row,
      accessId: row?.id ?? null,
      branchId: row?.branchId ?? null,
    });
  } catch (e) {
    console.error("GET /api/super-admin/users/[userId]/super-admin error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params; // ✅ wajib await di Next.js 15

    // pastikan default branch ada (biar tidak bikin FK error / data invalid)
    const branch = await prisma.branch.findUnique({
      where: { id: DEFAULT_BRANCH_ID },
      select: { id: true },
    });
    if (!branch) {
      return NextResponse.json(
        { error: `Default branch '${DEFAULT_BRANCH_ID}' tidak ditemukan. Periksa seed branches.` },
        { status: 500 }
      );
    }

    // idempotent: kalau sudah ada, jangan buat duplikat
    const existing = await prisma.userAccess.findFirst({
      where: { userId, role: UserRole.SUPER_ADMIN },
      select: { id: true, createdAt: true, branchId: true },
    });

    if (existing) {
      // optional: repair kalau legacy masih null
      if (existing.branchId !== DEFAULT_BRANCH_ID) {
        const fixed = await prisma.userAccess.update({
          where: { id: existing.id },
          data: { branchId: DEFAULT_BRANCH_ID },
          select: { id: true, createdAt: true, branchId: true },
        });
        return NextResponse.json({ ok: true, data: fixed }, { status: 200 });
      }

      return NextResponse.json({ ok: true, data: existing }, { status: 200 });
    }

    const created = await prisma.userAccess.create({
      data: {
        userId,
        role: UserRole.SUPER_ADMIN,
        branchId: DEFAULT_BRANCH_ID, // ✅ wajib terisi
        schoolNpsn: null,
      },
      select: { id: true, createdAt: true, branchId: true },
    });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/super-admin/users/[userId]/super-admin error:", e);

    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Akses SUPER_ADMIN sudah ada." }, { status: 409 });
    }

    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params; // ✅ wajib await

    // delete semua row SUPER_ADMIN milik user (bersih kalau ada duplikat lama)
    await prisma.userAccess.deleteMany({
      where: { userId, role: UserRole.SUPER_ADMIN },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/super-admin/users/[userId]/super-admin error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
