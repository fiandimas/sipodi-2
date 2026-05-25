import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import type { UserPrintItem } from "@/lib/print-utils";

type Body = {
  ids?: string[];
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: "ids harus berupa array dan tidak boleh kosong." },
        { status: 400 },
      );
    }

    const uniqueIds = Array.from(
      new Set(
        body.ids.filter((id) => typeof id === "string" && id.trim().length > 0),
      ),
    );

    if (uniqueIds.length === 0) {
      return NextResponse.json(
        { error: "Daftar id tidak valid." },
        { status: 400 },
      );
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: uniqueIds },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        branch: {
          select: { id: true, name: true, city: true },
        },
        school: {
          select: { npsn: true, name: true, city: true },
        },
        gtk: {
          select: { nik: true, name: true, schoolNpsn: true },
        },
      },
    });

    if (!users.length) {
      return NextResponse.json(
        { error: "Tidak ada user yang cocok dengan id yang dikirim." },
        { status: 404 },
      );
    }

    const data: UserPrintItem[] = users.map((u) => ({
      username: u.username,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      gtkName: u.gtk?.name ?? null,
      schoolName: u.school?.name ?? null,
      branchName: u.branch?.name ?? null,
    }));

    // maintain urutan sesuai ids yang dikirim
    const orderMap = new Map(uniqueIds.map((id, idx) => [id, idx]));
    data.sort((a, b) => {
      const ia = orderMap.get(users.find((u) => u.username === a.username)?.id ?? "") ?? 0;
      const ib = orderMap.get(users.find((u) => u.username === b.username)?.id ?? "") ?? 0;
      return ia - ib;
    });

    return NextResponse.json({ data }, { status: 200 });
  } catch (e) {
    console.error("POST /api/super-admin/users/print-selected error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
