import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

type TagOption = { id: string; name: string };
type FreeTagOption = { name: string; usedCount: number };

type TagsApiResponse = {
  priority: TagOption[]; // Juara 1/2/3
  others: Array<TagOption & { usedCount: number }>; // tag master (DB)
  free: FreeTagOption[]; // tag bebas (tagsOtherText)
};

type Ctx = { params: Promise<{ nik: string }> };

function normStr(x: unknown): string | undefined {
  if (typeof x !== "string") return undefined;
  const t = x.trim();
  return t ? t : undefined;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN_SEKOLAH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schoolNpsn = session.schoolNpsn;
    const branchId = session.branchId;

    // ✅ sekarang boleh sekolah ATAU cabang
    if (!schoolNpsn && !branchId) {
      return NextResponse.json(
        { error: "Scope admin sekolah belum dipilih (sekolah/cabang)." },
        { status: 400 }
      );
    }

    const { nik } = await params;
    const nikTrim = normStr(nik);
    if (!nikTrim) {
        return NextResponse.json({ error: "NIK tidak ditemukan di URL." }, { status: 400 });
    }

    if (!nikTrim) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const GTK = await prisma.gtk.findFirst({
      where: {
        nik: nikTrim,
        schoolNpsn: schoolNpsn ?? undefined,
      }
    })

    if (GTK === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const JUARA = ["Juara 1", "Juara 2", "Juara 3"] as const;
    const priority: TagOption[] = JUARA.map((name) => ({ id: name, name }));

    const subs = await prisma.talentSubmission.findMany({
      where: { gtkNik: nikTrim },
      select: {
        tags: { select: { id: true, name: true } },
        tagsOtherText: true,
      },
    });

    const masterMap = new Map<string, { id: string; name: string; usedCount: number }>();
    const freeMap = new Map<string, number>();

    for (const s of subs) {
      for (const t of s.tags ?? []) {
        if (JUARA.includes(t.name as any)) continue;
        const prev = masterMap.get(t.id);
        if (prev) prev.usedCount += 1;
        else masterMap.set(t.id, { id: t.id, name: t.name, usedCount: 1 });
      }

      for (const raw of (s.tagsOtherText ?? []) as any[]) {
        const name = String(raw ?? "").trim();
        if (!name) continue;
        if (JUARA.includes(name as any)) continue;
        freeMap.set(name, (freeMap.get(name) ?? 0) + 1);
      }
    }

    const others = Array.from(masterMap.values()).sort((a, b) =>
      b.usedCount !== a.usedCount ? b.usedCount - a.usedCount : a.name.localeCompare(b.name)
    );

    const free = Array.from(freeMap.entries())
      .map(([name, usedCount]) => ({ name, usedCount }))
      .sort((a, b) => (b.usedCount - a.usedCount) || a.name.localeCompare(b.name));

    const payload: TagsApiResponse = { priority, others, free };
    return NextResponse.json(payload);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}