import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ===== USER GTK =====
    if (session.role === "USER_GTK") {
      if (!session.gtkNik) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const gtk = await prisma.gtk.findUnique({
        where: { nik: session.gtkNik },
        select: {
          nik: true,
          name: true,
          photoUrl: true,
          school: { select: { npsn: true, name: true } },
        },
      });

      return NextResponse.json({
        gtk: {
          nik: gtk?.nik ?? session.gtkNik,
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
    }

    // ===== ADMIN SEKOLAH =====
    if (session.role === "ADMIN_SEKOLAH") {
      if (!session.schoolNpsn) {
        return NextResponse.json(
          { error: "Admin sekolah belum terikat ke schoolNpsn" },
          { status: 400 }
        );
      }

      const school = await prisma.school.findUnique({
        where: { npsn: session.schoolNpsn },
        select: {
          npsn: true,
          name: true,
          city: true,
          level: true,
          status: true,
        },
      });

      return NextResponse.json({
        adminSchool: {
          schoolNpsn: school?.npsn ?? session.schoolNpsn,
          schoolName: school?.name ?? "-",
        },
        session: {
          role: session.role,
          branchId: session.branchId ?? null,
          schoolNpsn: session.schoolNpsn,
          gtkNik: session.gtkNik ?? null,
        },
      });
    }

    // ===== OTHER ROLES (optional) =====
    return NextResponse.json({
      session: {
        role: session.role,
        branchId: session.branchId ?? null,
        schoolNpsn: session.schoolNpsn ?? null,
        gtkNik: session.gtkNik ?? null,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
