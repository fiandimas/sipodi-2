import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { UserRole, PasswordAlgo } from "@prisma/client";
import crypto from "crypto";

function normalizeNullableString(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  return s.length === 0 ? null : s;
}

function dedupe(ids: string[]) {
  return Array.from(new Set(ids));
}

// === DEFAULT BRANCH (wajib ada di DB) ===
const DEFAULT_BRANCH_ID = "cabdin-malang";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim();
    const role = (searchParams.get("role") as UserRole | null) || null;
    const branchId = searchParams.get("branchId") || undefined;
    const schoolNpsn = searchParams.get("schoolNpsn") || undefined;
    const isActive = searchParams.get("isActive");

    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");

    const where: any = {};
    if (q) {
      where.OR = [
        { username: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ];
    }
    if (role) where.access = { some: { role } };
    if (branchId) where.branchId = branchId;
    if (schoolNpsn) where.schoolNpsn = schoolNpsn;
    if (isActive === "true") where.isActive = true;
    if (isActive === "false") where.isActive = false;

    const [total, data] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          isActive: true,
          access: { select: { role: true } },
          branchId: true,
          schoolNpsn: true,
          gtkNik: true,
          createdAt: true,
          branch: { select: { id: true, name: true, city: true } },
          school: { select: { npsn: true, name: true, city: true } },
          gtk: { select: { nik: true, name: true, schoolNpsn: true, type: true } },
        },
      }),
    ]);

    return NextResponse.json({
      data,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    console.error("GET /api/super-admin/users error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

type CreateUserBody = {
  username?: string;
  password?: string;
  name?: string;
  role?: UserRole;

  branchId?: string | null;
  schoolNpsn?: string | null;
  gtkNik?: string | null;

  talentFieldIds?: string[];
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as CreateUserBody | null;
    if (!body) {
      return NextResponse.json({ error: "Body tidak valid (bukan JSON)." }, { status: 400 });
    }

    const username = normalizeNullableString(body.username);
    const password = normalizeNullableString(body.password);
    const name = normalizeNullableString(body.name);
    const role = body.role as UserRole | undefined;

    if (!username || !password || !name || !role) {
      return NextResponse.json(
        { error: "Field username, password, name, role wajib diisi." },
        { status: 400 }
      );
    }

    if (/\s/.test(username)) {
      return NextResponse.json({ error: "Username tidak boleh mengandung spasi." }, { status: 400 });
    }

    const existingUserWithSameUsername = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existingUserWithSameUsername) {
      return NextResponse.json({ error: "Username sudah terpakai." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });
    }

    // Pastikan default branch memang ada
    const defaultBranch = await prisma.branch.findUnique({
      where: { id: DEFAULT_BRANCH_ID },
      select: { id: true },
    });
    if (!defaultBranch) {
      return NextResponse.json(
        { error: `Default branch '${DEFAULT_BRANCH_ID}' tidak ditemukan. Periksa seed branches.` },
        { status: 500 }
      );
    }

    let finalBranchId: string | null = null;
    let finalSchoolNpsn: string | null = null;
    let finalGtkNik: string | null = null;

    // ===== VALIDATION per role =====
    // Catatan: Sekarang SUPER_ADMIN BOLEH punya branchId default (bukan relasi sekolah/gtk).
    if (role === "SUPER_ADMIN") {
      if (normalizeNullableString(body.schoolNpsn) || normalizeNullableString(body.gtkNik)) {
        return NextResponse.json(
          { error: "SUPER_ADMIN tidak boleh punya relasi school/gtk." },
          { status: 400 }
        );
      }
      if (Array.isArray(body.talentFieldIds) && body.talentFieldIds.length > 0) {
        return NextResponse.json(
          { error: "SUPER_ADMIN tidak memakai talentFieldIds." },
          { status: 400 }
        );
      }
      // branchId tidak perlu diinput; akan diisi default
    }

    if (role === "ADMIN_TALENTA") {
      const branchId = normalizeNullableString(body.branchId) ?? null;

      if (normalizeNullableString(body.schoolNpsn) || normalizeNullableString(body.gtkNik)) {
        return NextResponse.json(
          { error: "ADMIN_TALENTA tidak boleh mengisi schoolNpsn/gtkNik." },
          { status: 400 }
        );
      }

      const fieldIdsRaw = Array.isArray(body.talentFieldIds) ? body.talentFieldIds : [];
      const fieldIds = dedupe(fieldIdsRaw);
      if (fieldIds.length === 0) {
        return NextResponse.json(
          { error: "talentFieldIds wajib diisi untuk ADMIN_TALENTA." },
          { status: 400 }
        );
      }
      if (fieldIds.length !== fieldIdsRaw.length) {
        return NextResponse.json({ error: "talentFieldIds tidak boleh duplikat." }, { status: 400 });
      }

      // Kalau branchId tidak diisi, pakai default
      finalBranchId = branchId ?? DEFAULT_BRANCH_ID;
      body.talentFieldIds = fieldIds;

      const branch = await prisma.branch.findUnique({
        where: { id: finalBranchId },
        select: { id: true },
      });
      if (!branch) return NextResponse.json({ error: "Branch tidak ditemukan." }, { status: 400 });

      const fieldsCount = await prisma.talentField.count({
        where: { id: { in: fieldIds }, isActive: true },
      });
      if (fieldsCount !== fieldIds.length) {
        return NextResponse.json(
          { error: "Ada bidang talenta yang tidak valid / nonaktif." },
          { status: 400 }
        );
      }
    }

    if (role === "ADMIN_SEKOLAH") {
      const schoolNpsn = normalizeNullableString(body.schoolNpsn);
      if (!schoolNpsn) {
        return NextResponse.json(
          { error: "schoolNpsn wajib diisi untuk ADMIN_SEKOLAH." },
          { status: 400 }
        );
      }
      if (normalizeNullableString(body.gtkNik)) {
        return NextResponse.json({ error: "ADMIN_SEKOLAH tidak boleh mengisi gtkNik." }, { status: 400 });
      }
      if (Array.isArray(body.talentFieldIds) && body.talentFieldIds.length > 0) {
        return NextResponse.json(
          { error: "ADMIN_SEKOLAH tidak memakai talentFieldIds." },
          { status: 400 }
        );
      }

      const school = await prisma.school.findUnique({
        where: { npsn: schoolNpsn },
        select: { npsn: true, branchId: true },
      });
      if (!school) return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 400 });

      finalSchoolNpsn = school.npsn;
      finalBranchId = school.branchId ?? DEFAULT_BRANCH_ID;
    }

    if (role === "USER_GTK") {
      const gtkNik = normalizeNullableString(body.gtkNik);
      if (!gtkNik) {
        return NextResponse.json({ error: "gtkNik wajib diisi untuk USER_GTK." }, { status: 400 });
      }
      if (Array.isArray(body.talentFieldIds) && body.talentFieldIds.length > 0) {
        return NextResponse.json(
          { error: "USER_GTK tidak memakai talentFieldIds." },
          { status: 400 }
        );
      }

      const gtk = await prisma.gtk.findUnique({
        where: { nik: gtkNik },
        select: { nik: true, schoolNpsn: true, school: { select: { branchId: true } } },
      });
      if (!gtk) return NextResponse.json({ error: "GTK tidak ditemukan." }, { status: 400 });

      const otherUser = await prisma.user.findFirst({
        where: { gtkNik },
        select: { id: true },
      });
      if (otherUser) {
        return NextResponse.json({ error: "gtkNik sudah terpakai oleh user lain." }, { status: 400 });
      }

      finalGtkNik = gtk.nik;
      finalSchoolNpsn = gtk.schoolNpsn;
      finalBranchId = gtk.school.branchId ?? DEFAULT_BRANCH_ID;
    }

    // === FALLBACK GLOBAL: kalau masih null, pakai default ===
    if (!finalBranchId) finalBranchId = DEFAULT_BRANCH_ID;

    const hashed = crypto.createHash("sha256").update(password).digest("hex");

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          password: hashed,
          name,
          role,
          isActive: true,
          branchId: finalBranchId,
          schoolNpsn: finalSchoolNpsn,
          gtkNik: finalGtkNik,
          passwordAlgo: PasswordAlgo.SHA256,
        },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          isActive: true,
          branchId: true,
          schoolNpsn: true,
          gtkNik: true,
          createdAt: true,
        },
      });

      // ✅ Selalu buat access & selalu set branchId (default/final)
      if (role === "SUPER_ADMIN") {
        await tx.userAccess.create({
          data: {
            userId: user.id,
            role: UserRole.SUPER_ADMIN,
            branchId: finalBranchId,
          },
        });
      }

      if (role === "ADMIN_TALENTA") {
        await tx.userAccess.create({
          data: {
            userId: user.id,
            role: UserRole.ADMIN_TALENTA,
            branchId: finalBranchId,
          },
        });

        const fieldIds = (body.talentFieldIds ?? []) as string[];
        await tx.userTalentField.createMany({
          data: fieldIds.map((fieldId) => ({ userId: user.id, fieldId })),
          skipDuplicates: true,
        });
      }

      if (role === "ADMIN_SEKOLAH") {
        await tx.userAccess.create({
          data: {
            userId: user.id,
            role: UserRole.ADMIN_SEKOLAH,
            schoolNpsn: finalSchoolNpsn, // ada
            branchId: finalBranchId,     // ✅ wajib
          },
        });
      }

      if (role === "USER_GTK") {
        await tx.userAccess.create({
          data: {
            userId: user.id,
            role: UserRole.USER_GTK,
            schoolNpsn: finalSchoolNpsn, // ada
            branchId: finalBranchId,     // ✅ wajib
          },
        });
      }

      return user;
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/super-admin/users error:", e);

    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Username atau gtkNik sudah terpakai." }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
