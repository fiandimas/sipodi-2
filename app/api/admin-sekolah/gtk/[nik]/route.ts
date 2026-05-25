// app/api/admin-sekolah/gtk/[nik]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { Gender, GtkType } from "@prisma/client";

type Ctx = { params: Promise<{ nik: string }> };

function normStr(x: unknown): string | undefined {
  if (typeof x !== "string") return undefined;
  const t = x.trim();
  return t ? t : undefined;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_SEKOLAH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nik } = await params;
    const nikTrim = normStr(nik);

    if (!nikTrim) {
      return NextResponse.json(
        { error: "NIK tidak ditemukan di URL." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Body tidak valid (bukan JSON)." },
        { status: 400 }
      );
    }

    const { name, email, nuptk, nip, gender, type, mapel, birthDate } = body;

    // ===============================
    // CEK GTK EXIST & PASTIKAN SEBELAH SEKOLAH ADMIN
    // ===============================
    const gtk = await prisma.gtk.findUnique({
      where: { nik: nikTrim },
      select: {
        nik: true,
        schoolNpsn: true,
      },
    });

    if (!gtk) {
      return NextResponse.json(
        { error: "GTK tidak ditemukan." },
        { status: 404 }
      );
    }

    // Admin sekolah hanya boleh mengedit GTK sekolahnya sendiri
    if (gtk.schoolNpsn !== session.schoolNpsn) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses untuk mengubah GTK ini." },
        { status: 403 }
      );
    }

    // ===============================
    // PATCH GTK — TANPA PINDAH SEKOLAH
    // ===============================
    const updated = await prisma.gtk.update({
      where: { nik: nikTrim },
      data: {
        name: normStr(name) ?? undefined,

        email: email === undefined ? undefined : normStr(email) ?? null,
        nuptk: nuptk === undefined ? undefined : normStr(nuptk) ?? null,
        nip: nip === undefined ? undefined : normStr(nip) ?? null,

        gender: gender === undefined ? undefined : (gender ?? null),
        type: type === undefined ? undefined : (type ?? null),

        mapel: mapel === undefined ? undefined : normStr(mapel) ?? null,

        birthDate: birthDate ? new Date(birthDate) : undefined,
      },
      select: {
        nik: true,
        name: true,
        email: true,
        nuptk: true,
        nip: true,
        gender: true,
        birthDate: true,
        type: true,
        mapel: true,
        schoolNpsn: true,
        school: {
          select: { name: true, npsn: true, city: true },
        },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (e: any) {
    console.error("PATCH /api/admin-sekolah/gtk/[nik] error:", e);

    // Duplicate email, nip, nik, dll
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "Data duplikat: email / NUPTK / NIP / lainnya sudah dipakai." },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_SEKOLAH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nik } = await params;
    const nikTrim = normStr(nik);
    if (!nikTrim) {
      return NextResponse.json(
        { error: "NIK tidak ditemukan di URL." },
        { status: 400 }
      );
    }

    // =============================
    // CEK GTK EXIST
    // =============================
    const gtk = await prisma.gtk.findUnique({
      where: { nik: nikTrim },
      select: { nik: true, schoolNpsn: true },
    });

    if (!gtk) {
      return NextResponse.json(
        { error: "GTK tidak ditemukan." },
        { status: 404 }
      );
    }

    // =============================
    // VALIDASI HANYA GTK SEKOLAH SENDIRI
    // =============================
    if (gtk.schoolNpsn !== session.schoolNpsn) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses untuk menghapus GTK ini." },
        { status: 403 }
      );
    }

    // =============================
    // CEK TALENTA — WAJIB KOSONG
    // =============================
    const hasTalenta = await prisma.talentSubmission.findFirst({
      where: { gtkNik: nikTrim },
      select: { id: true },
    });

    if (hasTalenta) {
      return NextResponse.json(
        {
          error:
            "GTK memiliki talenta yang sudah diupload. Tidak dapat dihapus.",
        },
        { status: 400 }
      );
    }

    // =============================
    // SAFE DELETE
    // =============================
    await prisma.gtk.delete({
      where: { nik: nikTrim },
    });

    return NextResponse.json({ ok: true, message: "GTK berhasil dihapus." });
  } catch (e) {
    console.error("DELETE /api/admin-sekolah/gtk/[nik] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}