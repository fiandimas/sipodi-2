import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { UserRole } from "@prisma/client";

type PutBody = {
  fieldIds?: string[];
};

type Ctx = { params: Promise<{ userId: string }> };

function dedupe(ids: string[]) {
  return Array.from(new Set(ids));
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params; // ✅ Next.js 15

    const rows = await prisma.userTalentField.findMany({
      where: { userId },
      select: { field: { select: { id: true, name: true, isActive: true } } },
      orderBy: { field: { name: "asc" } },
    });

    return NextResponse.json({ data: rows.map((r) => r.field) });
  } catch (e) {
    console.error("GET /api/super-admin/users/[userId]/talent-fields error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;

    const body = (await req.json().catch(() => null)) as PutBody | null;

    const DEFAULT_BRANCH_ID = "cabdin-malang";

    const rawIds = Array.isArray(body?.fieldIds) ? body!.fieldIds : [];
    const fieldIds = dedupe(rawIds).filter((x) => typeof x === "string" && x.trim().length > 0);

    // validasi field ids (hanya yang valid & aktif)
    const fields = await prisma.talentField.findMany({
      where: { id: { in: fieldIds }, isActive: true },
      select: { id: true },
    });
    const validIds = fields.map((f) => f.id);

    // ambil branchId user (untuk scope ADMIN_TALENTA di user_access)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { branchId: true },
    });
    const branchId = user?.branchId ?? DEFAULT_BRANCH_ID;

    await prisma.$transaction([
      prisma.userTalentField.deleteMany({ where: { userId } }),

      ...(validIds.length
        ? [
          prisma.userTalentField.createMany({
            data: validIds.map((fieldId) => ({ userId, fieldId })),
            skipDuplicates: true,
          }),

          // ✅ pastikan role ADMIN_TALENTA muncul di tabel (user_access)
          prisma.userAccess.createMany({
            data: [
              {
                userId,
                role: UserRole.ADMIN_TALENTA,
                branchId,
              },
            ],
            skipDuplicates: true,
          }),
        ]
        : [
          // ✅ jika tidak ada bidang, cabut akses ADMIN_TALENTA
          prisma.userAccess.deleteMany({
            where: { userId, role: UserRole.ADMIN_TALENTA },
          }),
        ]),
    ]);

    return NextResponse.json({ ok: true, fieldIds: validIds });
  } catch (e) {
    console.error("PUT /api/super-admin/users/[userId]/talent-fields error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
