import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.gtkNik || session.role !== "USER_GTK") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gtk = await prisma.gtk.findUnique({
      where: { nik: session.gtkNik },
      select: {
        nik: true,
        name: true,
        email: true,
        nuptk: true,
        nip: true,
        gender: true,
        birthDate: true,
        type: true,
        photoUrl: true,
        createdAt: true,
        updatedAt: true,
        school: {
          select: {
            npsn: true,
            name: true,
            level: true,
            status: true,
            city: true,
            headName: true,
            branch: { select: { id: true, name: true, city: true } },
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return NextResponse.json({ gtk });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
