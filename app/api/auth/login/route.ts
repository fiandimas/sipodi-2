import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/app/_lib/prisma";
import { verifyPassword, hashPasswordArgon2id } from "@/app/_lib/password";
import { UserRole } from "@prisma/client";

type Body = { username?: string; password?: string };

const COOKIE_SESSION = "sipodi_session";
const COOKIE_PENDING = "sipodi_pending_login";

const JWT_ISSUER = "sipodi";
const JWT_AUDIENCE = "sipodi-web";

function dashboardForRole(role: UserRole) {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin/dashboard";
    case "ADMIN_TALENTA":
      return "/admin-talenta/dashboard";
    case "ADMIN_SEKOLAH":
      return "/admin-sekolah/dashboard";
    case "USER_GTK":
    default:
      return "/user-gtk/dashboard";
  }
}

function stripInvisible(s: string) {
  return (s ?? "").replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").trim();
}

function normalizeNik(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

const userSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  isActive: true,
  gtkNik: true,
  branchId: true,
  schoolNpsn: true,
  password: true,
  passwordAlgo: true,

  talentFields: {
    select: { field: { select: { id: true, name: true, isActive: true } } },
  },

  access: {
    where: { role: "ADMIN_SEKOLAH" as const },
    select: {
      id: true,
      role: true,
      schoolNpsn: true,
      branchId: true,
      school: { select: { npsn: true, name: true, city: true } },
      branch: { select: { id: true, name: true, city: true } },
    },
  },
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;

  const identRaw = stripInvisible(body.username ?? "");
  const password = (body.password ?? "").trim();

  if (!identRaw || !password) {
    return NextResponse.json(
      { error: "Username dan password wajib diisi." },
      { status: 400 }
    );
  }

  const identNik = normalizeNik(identRaw);
  const inputIsNik = identNik.length >= 16;
  
  const found = inputIsNik
    ? await prisma.user.findFirst({
      where: { gtkNik: identNik },
      select: userSelect,
    })
    : await prisma.user.findUnique({
      where: { username: identRaw },
      select: userSelect,
    });

  if (!found) {
    return NextResponse.json(
      { error: "Username atau password salah." },
      { status: 401 }
    );
  }

  if (!found.isActive) {
    return NextResponse.json({ error: "Akun tidak aktif." }, { status: 403 });
  }

  // Jika akun GTK (punya gtkNik) wajib login pakai NIK
  if (found.gtkNik && !inputIsNik) {
    return NextResponse.json(
      { error: "Akun GTK wajib login menggunakan NIK." },
      { status: 403 }
    );
  }

  // Jika input NIK tapi user bukan GTK
  if (!found.gtkNik && inputIsNik) {
    return NextResponse.json(
      { error: "Login menggunakan NIK hanya untuk akun GTK." },
      { status: 403 }
    );
  }

  const ok = await verifyPassword({
    algo: found.passwordAlgo,
    password,
    hash: found.password,
  });

  if (!ok) {
    return NextResponse.json(
      { error: "Username atau password salah." },
      { status: 401 }
    );
  }

  // auto-upgrade legacy SHA256 -> ARGON2ID
  if (found.passwordAlgo === "SHA256") {
    try {
      const newHash = await hashPasswordArgon2id(password);
      await prisma.user.update({
        where: { id: found.id },
        data: { password: newHash, passwordAlgo: "ARGON2ID" },
      });
    } catch {
      // optional: biarkan silent, agar login tidak gagal hanya karena upgrade gagal
    }
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "JWT_SECRET belum diset di .env" },
      { status: 500 }
    );
  }

  const talentFieldsActive = (found.talentFields || [])
    .map((tf) => tf.field)
    .filter((f) => f.isActive)
    .map((f) => ({ id: f.id, name: f.name }));

  const schoolAccess = found.access ?? [];
  const isSuperAdmin = found.role === "SUPER_ADMIN";
  const hasGtk = !!found.gtkNik;
  const hasTalenta = talentFieldsActive.length > 0;
  const hasSchoolAdmin = schoolAccess.length > 0;

  const availableModes: any[] = [];
  if (isSuperAdmin) availableModes.push({ role: "SUPER_ADMIN" as UserRole });
  if (hasGtk) availableModes.push({ role: "USER_GTK" as UserRole, gtkNik: found.gtkNik });
  if (hasTalenta) availableModes.push({ role: "ADMIN_TALENTA" as UserRole, talentFields: talentFieldsActive });
  if (hasSchoolAdmin) {
    availableModes.push({
      role: "ADMIN_SEKOLAH" as UserRole,
      options: schoolAccess.map((a) => ({
        accessId: a.id,
        branchId: a.branchId ?? null,
        schoolNpsn: a.schoolNpsn ?? null,
        label: a.school
          ? `Sekolah: ${a.school.name} (${a.school.city})`
          : a.branch
            ? `Cabang: ${a.branch.name} (${a.branch.city})`
            : a.schoolNpsn
              ? `Sekolah: ${a.schoolNpsn}`
              : a.branchId
                ? `Cabang: ${a.branchId}`
                : "Scope tidak valid",
      })),
    });
  }

  if (availableModes.length === 0) {
    return NextResponse.json(
      { error: "Akun tidak memiliki mode akses (GTK/Talenta/Sekolah/Super Admin)." },
      { status: 403 }
    );
  }

  const secure =
    process.env.COOKIE_SECURE === "true" && process.env.NODE_ENV === "production";

  // single mode => set session
  if (availableModes.length === 1) {
    const only = availableModes[0] as { role: UserRole };

    const tokenTalentFields = only.role === "ADMIN_TALENTA" ? talentFieldsActive : [];

    let branchId: string | null = null;
    let schoolNpsn: string | null = null;

    if (only.role === "ADMIN_SEKOLAH") {
      const acc = schoolAccess[0];
      branchId = acc?.branchId ?? null;
      schoolNpsn = acc?.schoolNpsn ?? null;
    } else {
      branchId = found.branchId ?? null;
      schoolNpsn = found.schoolNpsn ?? null;
    }

    const sessionToken = jwt.sign(
      {
        sub: found.id,
        role: only.role,
        branchId,
        schoolNpsn,
        gtkNik: found.gtkNik ?? null,
        talentFields: tokenTalentFields,
      },
      secret,
      {
        algorithm: "HS256",
        expiresIn: "7d",
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }
    );

    const res = NextResponse.json({
      ok: true,
      next: dashboardForRole(only.role),
      user: { id: found.id, username: found.username, name: found.name },
      availableModes,
    });

    res.cookies.set({
      name: COOKIE_SESSION,
      value: sessionToken,
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    res.cookies.set({
      name: COOKIE_PENDING,
      value: "",
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return res;
  }

  // multi mode => pending + choose-role
  const pendingToken = jwt.sign({ sub: found.id, typ: "pending_login" }, secret, {
    algorithm: "HS256",
    expiresIn: "10m",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  const res = NextResponse.json({
    ok: true,
    next: "/auth/choose-role",
    user: { id: found.id, username: found.username, name: found.name },
    availableModes,
  });

  res.cookies.set({
    name: COOKIE_SESSION,
    value: "",
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  res.cookies.set({
    name: COOKIE_PENDING,
    value: pendingToken,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return res;
}
