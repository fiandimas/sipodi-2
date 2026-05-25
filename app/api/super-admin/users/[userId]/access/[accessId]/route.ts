import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { UserRole } from "@prisma/client";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ userId: string; accessId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, accessId } = await ctx.params;

    const result = await prisma.$transaction(async (tx) => {
      // pastikan access ada & milik user ini (sekalian ambil role untuk rule "minimal 1 akses")
      const access = await tx.userAccess.findFirst({
        where: { id: accessId, userId },
        select: { id: true, role: true },
      });

      if (!access) {
        return { status: 404 as const };
      }

      const u = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (u?.role === UserRole.ADMIN_SEKOLAH && access.role === UserRole.ADMIN_SEKOLAH) {
        const count = await tx.userAccess.count({
          where: { userId, role: UserRole.ADMIN_SEKOLAH },
        });
        if (count <= 1) {
          return { status: 400 as const, message: "User ini role utamanya ADMIN_SEKOLAH, minimal harus punya 1 akses." };
        }
      }

      await tx.userAccess.delete({ where: { id: accessId } });

      return { status: 200 as const };
    });

    if (result.status === 404) {
      return NextResponse.json({ error: "Access tidak ditemukan." }, { status: 404 });
    }

    if (result.status === 400) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/super-admin/users/[userId]/access/[accessId] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
