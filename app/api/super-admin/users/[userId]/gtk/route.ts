import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { UserRole } from "@prisma/client";

type Body = { gtkNik?: string | null };
type Ctx = { params: Promise<{ id: string }> };

const DEFAULT_BRANCH_ID = "cabdin-malang";

function normStr(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const v = x.trim();
  return v ? v : null;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params; // ✅ Next.js 15: await params

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) {
      return NextResponse.json({ error: "Body tidak valid (bukan JSON)." }, { status: 400 });
    }

    // harus dikirim, boleh null
    if (body.gtkNik === undefined) {
      return NextResponse.json({ error: "gtkNik wajib dikirim (boleh null)." }, { status: 400 });
    }

    const gtkNik = body.gtkNik === null ? null : normStr(body.gtkNik);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, gtkNik: true, role: true },
      });
      if (!user) {
        return { status: 404 as const, payload: { error: "User tidak ditemukan." } };
      }

      // UNLINK GTK
      if (!gtkNik) {
        const updated = await tx.user.update({
          where: { id: userId },
          data: {
            gtkNik: null,
            // optional: tetap pegang default branch agar tidak "kosong"
            branchId: user.role === UserRole.SUPER_ADMIN ? DEFAULT_BRANCH_ID : undefined,
            // schoolNpsn tidak wajib dihapus; tapi untuk konsistensi, biasanya di-null-kan
            schoolNpsn: null,
          },
          select: { id: true, gtkNik: true, branchId: true, schoolNpsn: true },
        });

        // optional: tidak hapus akses USER_GTK lama agar multi access/history tetap ada
        return { status: 200 as const, payload: { data: updated } };
      }

      // LINK GTK: cek GTK ada + ambil school + branch
      const gtk = await tx.gtk.findUnique({
        where: { nik: gtkNik },
        select: {
          nik: true,
          schoolNpsn: true,
          school: { select: { branchId: true } },
        },
      });
      if (!gtk) {
        return { status: 400 as const, payload: { error: "GTK tidak ditemukan." } };
      }

      // cek GTK belum dipakai user lain
      const otherUser = await tx.user.findFirst({
        where: { gtkNik, id: { not: userId } },
        select: { id: true },
      });
      if (otherUser) {
        return {
          status: 409 as const,
          payload: { error: "GTK ini sudah terhubung dengan akun lain (mencegah double akun)." },
        };
      }

      const resolvedBranchId = gtk.school.branchId ?? DEFAULT_BRANCH_ID;

      // Pastikan default branch valid (biar tidak FK error)
      const branch = await tx.branch.findUnique({
        where: { id: resolvedBranchId },
        select: { id: true },
      });
      if (!branch) {
        return {
          status: 500 as const,
          payload: { error: `Branch '${resolvedBranchId}' tidak ditemukan (cek seed branches).` },
        };
      }

      // Update user: set gtkNik + sync schoolNpsn + branchId
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          gtkNik,
          schoolNpsn: gtk.schoolNpsn,
          branchId: resolvedBranchId,
        },
        select: { id: true, gtkNik: true, branchId: true, schoolNpsn: true },
      });

      // Pastikan ada akses USER_GTK untuk school tsb, dan branchId terisi
      const existingAccess = await tx.userAccess.findFirst({
        where: { userId, role: UserRole.USER_GTK, schoolNpsn: gtk.schoolNpsn },
        select: { id: true, branchId: true },
      });

      if (!existingAccess) {
        await tx.userAccess.create({
          data: {
            userId,
            role: UserRole.USER_GTK,
            schoolNpsn: gtk.schoolNpsn,
            branchId: resolvedBranchId,
          },
        });
      } else if (existingAccess.branchId !== resolvedBranchId) {
        await tx.userAccess.update({
          where: { id: existingAccess.id },
          data: { branchId: resolvedBranchId },
        });
      }

      return { status: 200 as const, payload: { data: updated } };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (e: any) {
    console.error("PUT /api/super-admin/users/[id]/gtk error:", e);

    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "GTK ini sudah terhubung dengan akun lain (mencegah double akun)." },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
