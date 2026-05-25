import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { PasswordAlgo, UserRole } from "@prisma/client";
import crypto from "crypto";

type UpdateUserBody = {
  username?: string; // ✅ baru
  name?: string;
  isActive?: boolean;

  role?: UserRole;
  branchId?: string | null;
  schoolNpsn?: string | null;
  gtkNik?: string | null;

  talentFieldIds?: string[];

  resetPasswordTo?: string | null;
};

type Ctx = { params: Promise<{ userId: string }> };

function normalizeNullableString(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  return s.length === 0 ? null : s;
}

function normalizeString(input: unknown): string | undefined {
  if (input === null || input === undefined) return undefined;
  const s = String(input).trim();
  return s.length === 0 ? undefined : s;
}

function dedupe(ids: string[]) {
  return Array.from(new Set(ids));
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await ctx.params;

    const body = (await req.json().catch(() => null)) as UpdateUserBody | null;
    if (!body) {
      return NextResponse.json({ error: "Body tidak valid (bukan JSON)." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, gtkNik: true, role: true, username: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    // ===== field umum =====
    const username = body.username !== undefined ? String(body.username).trim() : undefined;
    if (username !== undefined && !username) {
      return NextResponse.json({ error: "Username tidak boleh kosong." }, { status: 400 });
    }

    // ✅ cek unique username bila berubah
    if (username !== undefined && username !== existing.username) {
      const other = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (other && other.id !== existing.id) {
        return NextResponse.json({ error: "Username sudah dipakai user lain." }, { status: 400 });
      }
    }

    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    if (name !== undefined && !name) {
      return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });
    }

    const role: UserRole | undefined =
      body.role !== undefined ? (body.role as UserRole) : undefined;

    // nilai final untuk tabel users
    let finalBranchId: string | null | undefined = undefined;
    let finalSchoolNpsn: string | null | undefined = undefined;
    let finalGtkNik: string | null | undefined = undefined;

    // perintah sync grant
    let syncSuperAdmin = false;
    let syncAdminSekolahSchoolNpsn: string | null = null;
    let syncTalentaFieldIds: string[] | null = null;

    // ===== STRICT MODE (role dikirim) =====
    if (role !== undefined) {
      const payloadBranchId = normalizeNullableString(body.branchId);
      const payloadSchoolNpsn = normalizeNullableString(body.schoolNpsn);
      const payloadGtkNik = normalizeNullableString(body.gtkNik);
      const payloadTalentFieldIdsRaw = Array.isArray(body.talentFieldIds) ? body.talentFieldIds : [];
      const payloadTalentFieldIds = dedupe(payloadTalentFieldIdsRaw);

      if (payloadTalentFieldIdsRaw.length !== payloadTalentFieldIds.length) {
        return NextResponse.json({ error: "talentFieldIds tidak boleh duplikat." }, { status: 400 });
      }

      if (role === "SUPER_ADMIN") {
        if (payloadBranchId || payloadSchoolNpsn || payloadGtkNik) {
          return NextResponse.json(
            { error: "SUPER_ADMIN tidak boleh mengisi branchId/schoolNpsn/gtkNik." },
            { status: 400 }
          );
        }
        if (payloadTalentFieldIds.length > 0) {
          return NextResponse.json({ error: "SUPER_ADMIN tidak memakai talentFieldIds." }, { status: 400 });
        }

        finalBranchId = null;
        finalSchoolNpsn = null;
        finalGtkNik = null;

        syncSuperAdmin = true;
        syncAdminSekolahSchoolNpsn = null;
        syncTalentaFieldIds = [];
      }

      if (role === "ADMIN_SEKOLAH") {
        if (payloadBranchId || payloadGtkNik) {
          return NextResponse.json(
            { error: "ADMIN_SEKOLAH tidak boleh mengisi branchId/gtkNik." },
            { status: 400 }
          );
        }
        if (payloadTalentFieldIds.length > 0) {
          return NextResponse.json({ error: "ADMIN_SEKOLAH tidak memakai talentFieldIds." }, { status: 400 });
        }
        if (!payloadSchoolNpsn) {
          return NextResponse.json({ error: "schoolNpsn wajib diisi untuk ADMIN_SEKOLAH." }, { status: 400 });
        }

        const school = await prisma.school.findUnique({
          where: { npsn: payloadSchoolNpsn },
          select: { npsn: true, branchId: true },
        });
        if (!school) return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 400 });

        finalSchoolNpsn = school.npsn;
        finalBranchId = school.branchId;
        finalGtkNik = null;

        syncSuperAdmin = false;
        syncAdminSekolahSchoolNpsn = school.npsn;
        syncTalentaFieldIds = [];
      }

      if (role === "ADMIN_TALENTA") {
        if (payloadSchoolNpsn || payloadGtkNik) {
          return NextResponse.json(
            { error: "ADMIN_TALENTA tidak boleh mengisi schoolNpsn/gtkNik." },
            { status: 400 }
          );
        }
        if (!payloadBranchId) {
          return NextResponse.json({ error: "branchId wajib diisi untuk ADMIN_TALENTA." }, { status: 400 });
        }
        if (payloadTalentFieldIds.length === 0) {
          return NextResponse.json({ error: "talentFieldIds wajib diisi untuk ADMIN_TALENTA." }, { status: 400 });
        }

        const branch = await prisma.branch.findUnique({
          where: { id: payloadBranchId },
          select: { id: true },
        });
        if (!branch) return NextResponse.json({ error: "Branch tidak ditemukan." }, { status: 400 });

        const fieldsCount = await prisma.talentField.count({
          where: { id: { in: payloadTalentFieldIds }, isActive: true },
        });
        if (fieldsCount !== payloadTalentFieldIds.length) {
          return NextResponse.json({ error: "Ada bidang talenta yang tidak valid / nonaktif." }, { status: 400 });
        }

        finalBranchId = payloadBranchId;
        finalSchoolNpsn = null;
        finalGtkNik = null;

        syncSuperAdmin = false;
        syncAdminSekolahSchoolNpsn = null;
        syncTalentaFieldIds = payloadTalentFieldIds;
      }

      if (role === "USER_GTK") {
        if (payloadBranchId || payloadSchoolNpsn) {
          return NextResponse.json(
            { error: "USER_GTK tidak boleh mengisi branchId/schoolNpsn manual." },
            { status: 400 }
          );
        }
        if (payloadTalentFieldIds.length > 0) {
          return NextResponse.json({ error: "USER_GTK tidak memakai talentFieldIds." }, { status: 400 });
        }
        if (!payloadGtkNik) {
          return NextResponse.json({ error: "gtkNik wajib diisi untuk USER_GTK." }, { status: 400 });
        }

        const gtk = await prisma.gtk.findUnique({
          where: { nik: payloadGtkNik },
          select: {
            nik: true,
            schoolNpsn: true,
            school: { select: { branchId: true } },
          },
        });
        if (!gtk) return NextResponse.json({ error: "GTK tidak ditemukan." }, { status: 400 });

        const otherUser = await prisma.user.findFirst({
          where: { gtkNik: payloadGtkNik, id: { not: existing.id } },
          select: { id: true },
        });
        if (otherUser) {
          return NextResponse.json({ error: "gtkNik sudah terpakai oleh user lain." }, { status: 400 });
        }

        finalGtkNik = gtk.nik;
        finalSchoolNpsn = gtk.schoolNpsn;
        finalBranchId = gtk.school.branchId;

        syncSuperAdmin = false;
        syncAdminSekolahSchoolNpsn = null;
        syncTalentaFieldIds = [];
      }
    } else {
      // ===== LEGACY MODE (role tidak dikirim) =====
      // izinkan update username/name/isActive/resetPasswordTo (dan gtkNik kalau user memang USER_GTK)
      if (body.branchId !== undefined || body.schoolNpsn !== undefined || body.talentFieldIds !== undefined) {
        return NextResponse.json(
          { error: "Jika role tidak dikirim, tidak boleh mengubah branchId/schoolNpsn/talentFieldIds." },
          { status: 400 }
        );
      }

      if (body.gtkNik !== undefined) {
        if (existing.role !== "USER_GTK") {
          return NextResponse.json(
            { error: "gtkNik hanya boleh diubah untuk user dengan role USER_GTK." },
            { status: 400 }
          );
        }

        const gtkNik = normalizeNullableString(body.gtkNik);
        if (!gtkNik) {
          return NextResponse.json({ error: "gtkNik wajib diisi untuk USER_GTK." }, { status: 400 });
        }

        const gtk = await prisma.gtk.findUnique({
          where: { nik: gtkNik },
          select: { nik: true, schoolNpsn: true, school: { select: { branchId: true } } },
        });
        if (!gtk) return NextResponse.json({ error: "GTK tidak ditemukan." }, { status: 400 });

        if (gtkNik !== existing.gtkNik) {
          const otherUser = await prisma.user.findFirst({
            where: { gtkNik, id: { not: existing.id } },
            select: { id: true },
          });
          if (otherUser) {
            return NextResponse.json({ error: "gtkNik sudah terpakai oleh user lain." }, { status: 400 });
          }
        }

        finalGtkNik = gtk.nik;
        finalSchoolNpsn = gtk.schoolNpsn;
        finalBranchId = gtk.school.branchId;
      }
    }

    const dataUpdate: any = {
      ...(username !== undefined && { username }),
      ...(name !== undefined && { name }),
      ...(body.isActive !== undefined && { isActive: !!body.isActive }),

      ...(role !== undefined && { role }),
      ...(finalBranchId !== undefined && { branchId: finalBranchId }),
      ...(finalSchoolNpsn !== undefined && { schoolNpsn: finalSchoolNpsn }),
      ...(finalGtkNik !== undefined && { gtkNik: finalGtkNik }),
    };

    if (body.resetPasswordTo !== undefined && body.resetPasswordTo !== null) {
      const newPass = String(body.resetPasswordTo);
      if (newPass.length < 6) {
        return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });
      }
      const hashed = crypto.createHash("sha256").update(newPass).digest("hex");
      dataUpdate.password = hashed;
      dataUpdate.passwordAlgo = PasswordAlgo.SHA256;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: dataUpdate,
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          isActive: true,
          branchId: true,
          schoolNpsn: true,
          gtkNik: true,
          updatedAt: true,
        },
      });

      if (role !== undefined) {
        await tx.userAccess.deleteMany({ where: { userId, role: "SUPER_ADMIN" } });
        if (syncSuperAdmin) {
          await tx.userAccess.create({ data: { userId, role: "SUPER_ADMIN" } });
        }

        await tx.userAccess.deleteMany({ where: { userId, role: "ADMIN_SEKOLAH" } });
        if (syncAdminSekolahSchoolNpsn) {
          await tx.userAccess.create({
            data: { userId, role: "ADMIN_SEKOLAH", schoolNpsn: syncAdminSekolahSchoolNpsn, branchId: null },
          });
        }

        await tx.userTalentField.deleteMany({ where: { userId } });
        if (syncTalentaFieldIds && syncTalentaFieldIds.length > 0) {
          await tx.userTalentField.createMany({
            data: syncTalentaFieldIds.map((fieldId) => ({ userId, fieldId })),
            skipDuplicates: true,
          });
        }
      }

      return u;
    });

    return NextResponse.json({ data: updated });
  } catch (e: any) {
    console.error("PUT /api/super-admin/users/[userId] error:", e);

    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "Data unik bentrok (username atau gtkNik sudah terpakai)." },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await ctx.params;

    const result = await prisma.user.deleteMany({ where: { id: userId } });
    if (result.count === 0) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/super-admin/users/[userId] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
