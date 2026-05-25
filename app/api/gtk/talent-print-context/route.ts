import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET() {
  try {
    const session = await getSession();
    const gtkNik = session?.gtkNik;
    if (!gtkNik)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ambil GTK + sekolah + branch + letterhead dengan email
    const gtk = await prisma.gtk.findUnique({
      where: { nik: gtkNik },
      select: {
        name: true,
        school: {
          select: {
            name: true,
            branch: {
              select: {
                id: true,
                name: true,
                city: true,
                letterhead: {
                  select: {
                    title: true,
                    address: true,
                    phone: true,
                    email: true,
                    logoPath: true,
                    signerName: true,
                    signerRank: true,
                    signerNip: true,
                    signerRole: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!gtk?.school?.branch?.letterhead) {
      return NextResponse.json(
        { error: "Letterhead cabang belum di-set (branch_letterheads)." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      gtk: { name: gtk.name, schoolName: gtk.school.name },
      branch: {
        id: gtk.school.branch.id,
        name: gtk.school.branch.name,
        city: gtk.school.branch.city,
      },
      letterhead: gtk.school.branch.letterhead,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
