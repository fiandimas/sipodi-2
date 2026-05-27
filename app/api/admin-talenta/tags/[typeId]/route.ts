import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ typeId: string }>;
};

const PRIORITY_NAMES = ["Juara 1", "Juara 2", "Juara 3"] as const;

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_TALENTA") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { typeId } = await params;

    if (!typeId) {
      return NextResponse.json(
        { error: "typeId wajib diisi" },
        { status: 400 }
      );
    }

    const type = await prisma.talentField.findUnique({
      where: { id: typeId },
      select: { id: true },
    });

    if (!type) {
      return NextResponse.json(
        { error: "Jenis bidang tidak ditemukan" },
        { status: 404 }
      );
    }

    const talentSubmissionIds = await prisma.talentSubmissionField.findMany({
      where: { fieldId: typeId },
      select: {
        submissionId: true,
      },
    }).then((rows: any) => rows.map((r: any) => r.submissionId));

    // ✅ fix: where: { typeId } bukan where: { fieldId: typeId }
    const subs = await prisma.talentSubmission.findMany({
      where: { id: { in: talentSubmissionIds } },
      select: {
        tags: { select: { id: true, name: true } },
        tagsOtherText: true,
      },
    });

    const masterMap = new Map<string, { id: string; name: string; usedCount: number }>();
    const freeMap = new Map<string, number>();

    for (const s of subs) {
      for (const t of s.tags ?? []) {
        if (PRIORITY_NAMES.includes(t.name as any)) continue;
        const prev = masterMap.get(t.id);
        if (prev) prev.usedCount += 1;
        else masterMap.set(t.id, { id: t.id, name: t.name, usedCount: 1 });
      }

      for (const raw of s.tagsOtherText ?? []) {
        const name = String(raw).trim();
        if (!name || PRIORITY_NAMES.includes(name as any)) continue;
        freeMap.set(name, (freeMap.get(name) ?? 0) + 1);
      }
    }

    const others = Array.from(masterMap.values())
      .sort((a, b) => b.usedCount - a.usedCount || a.name.localeCompare(b.name));

    const free = Array.from(freeMap.entries())
      .map(([name, usedCount]) => ({ name, usedCount }))
      .sort((a, b) => b.usedCount - a.usedCount || a.name.localeCompare(b.name));

    return NextResponse.json({
      priority: PRIORITY_NAMES.map((name) => ({ id: name, name })),
      others,
      free,
    });

  } catch (err) {
    console.error("GET ADMIN TALENTA TAG BY TYPE ERROR:", err);
    return NextResponse.json(
      { error: "Gagal mengambil data tag" },
      { status: 500 }
    );
  }
}