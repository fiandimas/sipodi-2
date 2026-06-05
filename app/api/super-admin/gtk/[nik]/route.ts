import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { Gender, GtkType, UserRole } from "@prisma/client";

type Ctx = { params: Promise<{ nik: string }> };

function normStr(x: unknown): string | undefined {
  if (typeof x !== "string") return undefined;
  const t = x.trim();
  return t ? t : undefined;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nik } = await params;
    const nikTrim = normStr(nik);
    if (!nikTrim) {
      return NextResponse.json({ error: "NIK tidak ditemukan di URL." }, { status: 400 });
    }

    const gtk = await prisma.gtk.findUnique({
      where: { nik: nikTrim },
      select: {
        nik: true,
        name: true,
        photoUrl: true,
        school: { select: { npsn: true, name: true } },
      },
    });

    return NextResponse.json({
      gtk: {
        nik: gtk?.nik ?? nikTrim,
        name: gtk?.name ?? "-",
        schoolName: gtk?.school?.name ?? "-",
        photoUrl: gtk?.photoUrl ?? "/avatar.png",
      },
      session: {
        role: session.role,
        branchId: session.branchId ?? null,
        schoolNpsn: gtk?.school?.npsn ?? session.schoolNpsn ?? null,
        gtkNik: session.gtkNik,
      },
    });
  } catch (e: any) {
    console.error("GET /api/super-admin/gtk/[nik] error:", e);

    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nik } = await params;
    const nikTrim = normStr(nik);
    if (!nikTrim) {
      return NextResponse.json({ error: "NIK tidak ditemukan di URL." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Body tidak valid (bukan JSON)." }, { status: 400 });
    }

    const { name, email, nuptk, nip, gender, type, mapel, schoolNpsn } = body as {
      name?: string;
      email?: string | null;
      nuptk?: string | null;
      nip?: string | null;
      gender?: Gender | null;
      type?: GtkType | null;
      mapel?: string | null;
      schoolNpsn?: string;
    };

    const existing = await prisma.gtk.findUnique({
      where: { nik: nikTrim },
      select: {
        nik: true,
        name: true,
        schoolNpsn: true,
        school: { select: { branchId: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "GTK tidak ditemukan." }, { status: 404 });
    }

    // Validasi school baru (kalau berubah)
    let nextSchoolNpsn: string | undefined = undefined;
    let nextBranchId: string | undefined = undefined;

    const schoolNpsnTrim = normStr(schoolNpsn);
    if (schoolNpsnTrim && schoolNpsnTrim !== existing.schoolNpsn) {
      const school = await prisma.school.findUnique({
        where: { npsn: schoolNpsnTrim },
        select: { npsn: true, branchId: true },
      });

      if (!school) {
        return NextResponse.json({ error: "Sekolah baru tidak ditemukan." }, { status: 400 });
      }

      nextSchoolNpsn = school.npsn;
      nextBranchId = school.branchId;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const gtk = await tx.gtk.update({
        where: { nik: nikTrim },
        data: {
          name: normStr(name) ?? undefined,

          email: email === undefined ? undefined : normStr(email) ?? null,
          nuptk: nuptk === undefined ? undefined : normStr(nuptk) ?? null,
          nip: nip === undefined ? undefined : normStr(nip) ?? null,

          gender: gender === undefined ? undefined : (gender ?? null),
          type: type === undefined ? undefined : (type ?? null),

          mapel: mapel === undefined ? undefined : normStr(mapel) ?? null,

          schoolNpsn: nextSchoolNpsn ?? undefined,
        },
        select: {
          nik: true,
          name: true,
          email: true,
          nuptk: true,
          nip: true,
          gender: true,
          type: true,
          mapel: true,
          schoolNpsn: true,
          school: { select: { npsn: true, name: true, city: true, branchId: true } },
        },
      });

      // Cari user yang terkait GTK ini
      const user = await tx.user.findFirst({
        where: { gtkNik: nikTrim },
        select: { id: true, role: true },
      });

      if (user) {
        // Sync tabel users (profil cepat)
        await tx.user.update({
          where: { id: user.id },
          data: {
            name: gtk.name,
            ...(nextSchoolNpsn
              ? {
                  schoolNpsn: gtk.schoolNpsn,
                  branchId: nextBranchId ?? gtk.school.branchId,
                }
              : {}),
          },
        });

        // =========================
        // SYNC USERACCESS (multi access + branchId wajib)
        // =========================

        // A) Backfill akses lama yang branchId-nya masih null
        //    (supaya export berbasis access tidak ketemu akses tanpa branchId)
        const accessesNeedingBranch = await tx.userAccess.findMany({
          where: {
            userId: user.id,
            role: UserRole.USER_GTK,
            schoolNpsn: { not: null },
            branchId: null,
          },
          select: { id: true, schoolNpsn: true },
        });

        // Loop ini aman karena hanya untuk akses milik 1 user
        for (const a of accessesNeedingBranch) {
          const sch = await tx.school.findUnique({
            where: { npsn: a.schoolNpsn! },
            select: { branchId: true },
          });

          if (sch?.branchId) {
            await tx.userAccess.update({
              where: { id: a.id },
              data: { branchId: sch.branchId },
            });
          }
        }

        // B) Jika pindah sekolah: tambahkan akses baru kalau belum ada (tanpa hapus akses lama)
        if (nextSchoolNpsn) {
          const newSchoolNpsn = gtk.schoolNpsn; // sudah sekolah baru
          const newBranchId = nextBranchId ?? gtk.school.branchId;

          const existingAccess = await tx.userAccess.findFirst({
            where: {
              userId: user.id,
              role: UserRole.USER_GTK,
              schoolNpsn: newSchoolNpsn,
            },
            select: { id: true },
          });

          if (!existingAccess) {
            await tx.userAccess.create({
              data: {
                userId: user.id,
                role: UserRole.USER_GTK,
                schoolNpsn: newSchoolNpsn,
                branchId: newBranchId,
              },
            });
          } else {
            // kalau sudah ada, pastikan branchId sinkron
            await tx.userAccess.updateMany({
              where: {
                userId: user.id,
                role: UserRole.USER_GTK,
                schoolNpsn: newSchoolNpsn,
              },
              data: { branchId: newBranchId },
            });
          }
        } else {
          // C) Tidak pindah sekolah: pastikan minimal ada 1 akses
          const hasAccess = await tx.userAccess.findFirst({
            where: { userId: user.id, role: UserRole.USER_GTK },
            select: { id: true },
          });

          if (!hasAccess) {
            await tx.userAccess.create({
              data: {
                userId: user.id,
                role: UserRole.USER_GTK,
                schoolNpsn: existing.schoolNpsn,
                branchId: existing.school.branchId,
              },
            });
          }
        }
      }

      return gtk;
    });

    return NextResponse.json({ data: updated });
  } catch (e: any) {
    console.error("PATCH /api/super-admin/gtk/[nik] error:", e);

    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Email sudah dipakai GTK lain." }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
