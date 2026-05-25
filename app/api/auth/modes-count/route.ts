import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        role: true,
        gtkNik: true,
        branchId: true,
        schoolNpsn: true,
        talentFields: { select: { field: { select: { isActive: true } } } },
        access: { where: { role: "ADMIN_SEKOLAH" }, select: { id: true } },
      },
    });

    if (!user) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 401 });

    const hasGtk = !!user.gtkNik;
    const hasTalenta = (user.talentFields ?? []).some((x) => x.field?.isActive);
    const hasSchoolAdmin = (user.access ?? []).length > 0 || user.role === "ADMIN_SEKOLAH";
    const hasSuperAdmin = user.role === "SUPER_ADMIN";

    let count = 0;
    if (hasSuperAdmin) count++;
    if (hasGtk) count++;
    if (hasTalenta) count++;
    if (hasSchoolAdmin && (user.branchId || user.schoolNpsn || (user.access ?? []).length > 0)) count++;

    return NextResponse.json({ count });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
