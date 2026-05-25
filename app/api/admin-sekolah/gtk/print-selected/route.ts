// app/api/admin-sekolah/gtk/print-selected/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { UserRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    // 1) Auth untuk admin sekolah
    if (!session || session.role !== UserRole.ADMIN_SEKOLAH) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schoolNpsn = session.schoolNpsn;
    if (!schoolNpsn) {
      return NextResponse.json(
        { error: "Admin sekolah tidak memiliki NPSN." },
        { status: 400 }
      );
    }

    // 2) Parse body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Body tidak valid (bukan JSON)." },
        { status: 400 }
      );
    }

    // 3) Ambil NIK array
    const niks =
      Array.isArray((body as any)?.niks) &&
      (body as any).niks.every((x: unknown) => typeof x === "string")
        ? ((body as any).niks as string[])
        : [];

    if (niks.length === 0) {
      return NextResponse.json(
        { error: "Daftar NIK tidak boleh kosong." },
        { status: 400 }
      );
    }

    // 4) Query GTK milik sekolah ini saja
    const gtks = await prisma.gtk.findMany({
      where: {
        nik: { in: niks },
        schoolNpsn, // batasi hanya milik sekolah admin
      },
      orderBy: { name: "asc" },
      select: {
        nik: true,
        name: true,
        email: true,
        gender: true,
        type: true,
        mapel: true,
        birthDate: true,
        schoolNpsn: true,
        school: {
          select: {
            name: true,
            npsn: true,
            city: true,
          },
        },
      },
    });

    // 5) Format identik super admin
    const data = gtks.map((g) => ({
      nik: g.nik,
      name: g.name,
      email: g.email,
      gender: g.gender,
      type: g.type,
      mapel: g.mapel,
      schoolName: g.school?.name ?? null,
      schoolNpsn: g.school?.npsn ?? g.schoolNpsn ?? null,
      city: g.school?.city ?? null,
      birthDate: g.birthDate
        ? g.birthDate.toISOString().slice(0, 10)
        : null,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    console.error("POST /api/admin-sekolah/gtk/print-selected error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
