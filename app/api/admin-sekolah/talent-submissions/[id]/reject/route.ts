import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_SEKOLAH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schoolNpsn = session.schoolNpsn;
    const branchId = session.branchId;

    // untuk ADMIN_SEKOLAH, minimal salah satu scope harus ada
    if (!schoolNpsn && !branchId) {
      return NextResponse.json(
        { error: "Scope admin sekolah belum dipilih (sekolah/cabang)." },
        { status: 400 }
      );
    }

    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({} as any));
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    if (!note) {
      return NextResponse.json({ error: "Alasan penolakan wajib diisi" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const admin = await tx.user.findUnique({
        where: { id: session.sub },
        select: { id: true, isActive: true },
      });

      if (!admin) {
        return {
          ok: false as const,
          status: 401 as const,
          error: "User session tidak ditemukan di database.",
        };
      }
      if (!admin.isActive) {
        return { ok: false as const, status: 403 as const, error: "Akun nonaktif." };
      }

      const accessWhere: any = { userId: admin.id, role: "ADMIN_SEKOLAH" };
      if (schoolNpsn && branchId) {
        accessWhere.schoolNpsn = schoolNpsn;
        accessWhere.branchId = branchId;
      } else if (schoolNpsn) {
        accessWhere.schoolNpsn = schoolNpsn;
      } else if (branchId) {
        accessWhere.branchId = branchId;
      }

      const access = await tx.userAccess.findFirst({
        where: accessWhere,
        select: { id: true, schoolNpsn: true, branchId: true },
      });

      if (!access) {
        return {
          ok: false as const,
          status: 403 as const,
          error: "Role/scope tidak sesuai (tidak punya akses ADMIN_SEKOLAH untuk scope ini).",
        };
      }

      // ✅ pastikan submission milik scope ini
      const submission = await tx.talentSubmission.findFirst({
        where: {
          id,
          ...(schoolNpsn ? { gtk: { schoolNpsn } } : {}),
          ...(branchId ? { gtk: { school: { branchId } } } : {}),
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!submission) {
        return { ok: false as const, status: 404 as const, error: "Data tidak ditemukan" };
      }

      // idempotent: kalau sudah rejected, anggap sukses
      if (submission.status === "REJECTED") {
        return { ok: true as const };
      }

      // aturan Anda: sekolah hanya boleh reject jika masih PENDING
      if (submission.status !== "PENDING") {
        return {
          ok: false as const,
          status: 400 as const,
          error: "Tidak bisa ditolak karena sudah diproses (tidak berstatus PENDING).",
        };
      }

      await tx.talentSubmission.update({
        where: { id },
        data: {
          status: "REJECTED",

          // ✅ scope reject sekolah
          rejectedScope: "SEKOLAH",
          rejectedById: admin.id,
          rejectedAt: new Date(),
          rejectionNote: note,

          // ✅ bersihkan approval state (kalau ada sisa data)
          approvedScope: null,
          approvedById: null,
          approvedAt: null,
          approvalNote: null,

          // ✅ reset skor final
          adminScore: null,
          computedScore: null,
        },
      });

      return { ok: true as const };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
