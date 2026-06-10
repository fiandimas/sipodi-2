import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

type Ctx = { params: Promise<{ nik: string }> };

function normStr(x: unknown): string | undefined {
  if (typeof x !== "string") return undefined;
  const t = x.trim();
  return t ? t : undefined;
}

export async function GET(req: NextRequest, { params }: Ctx) {
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

    const sp = req.nextUrl.searchParams;
    const tagIds = sp.getAll("tagId").filter(Boolean);
    const tagTexts = sp.getAll("tagText").map((x) => x.trim()).filter(Boolean);
    const juara = (sp.get("juara") ?? "").trim();

    const JUARA = new Set(["Juara 1", "Juara 2", "Juara 3"]);
    const juaraValue = JUARA.has(juara) ? juara : "";

    const and: any[] = [];

    if (tagIds.length) and.push({ tags: { some: { id: { in: tagIds } } } });
    if (juaraValue) and.push({ tags: { some: { name: juaraValue } } });

    if (tagTexts.length) {
      and.push({
        OR: [
          { tags: { some: { name: { in: tagTexts } } } },
          { tagsOtherText: { hasSome: tagTexts } },
        ],
      });
    }

    const submissions = await prisma.talentSubmission.findMany({
      where: {
        gtkNik: nikTrim,
        gtk: {
          schoolNpsn: schoolNpsn ?? undefined,
        },
        ...(and.length ? { AND: and } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,

        activityName: true,
        organizer: true,
        description: true,
        linkPendukung: true,

        approvedScope: true,
        approvedAt: true,
        approvedBy: { select: { name: true } },

        rejectedScope: true,
        rejectedAt: true,
        rejectionNote: true,
        rejectedBy: { select: { name: true } },

        userScore: true,
        tagScore: true,
        jenisScore: true,
        adminScore: true,
        computedScore: true,

        fieldOtherText: true,
        categoryOtherText: true,
        subCategoryOtherText: true,
        tagsOtherText: true,

        gtk: {
          select: {
            name: true,
            mapel: true,
            school: { select: { name: true } },
          },
        },

        type: { select: { name: true } },

        fields: { select: { field: { select: { name: true } } } },
        categories: { select: { category: { select: { name: true } } } },
        subCategories: { select: { subCategory: { select: { name: true } } } },

        tags: { select: { id: true, name: true } },

        scoreEntries: {
          select: { points: true, type: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },

        files: {
          select: { id: true, originalName: true, mimeType: true, sizeBytes: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const payload = submissions.map((s) => {
      const fieldLabels = (s.fields ?? []).map((x) => x.field.name);
      const categoryLabels = (s.categories ?? []).map((x) => x.category.name);
      const subCategoryLabels = (s.subCategories ?? []).map((x) => x.subCategory.name);

      return {
        ...s,
        createdAt: s.createdAt.toISOString(),

        approvedScope: s.approvedScope ?? null,
        approvedAt: s.approvedAt ? s.approvedAt.toISOString() : null,
        approvedBy: s.approvedBy ?? null,

        rejectedScope: s.rejectedScope ?? null,
        rejectedAt: s.rejectedAt ? s.rejectedAt.toISOString() : null,
        rejectionNote: s.rejectionNote ?? null,
        rejectedBy: s.rejectedBy ?? null,

        userScore: s.userScore ?? null,
        tagScore: s.tagScore ?? null,
        jenisScore: s.jenisScore ?? null,
        adminScore: s.adminScore ?? null,
        computedScore: s.computedScore ?? null,

        // array labels untuk multi-field
        fieldLabels,
        categoryLabels,
        subCategoryLabels,

        // kalau UI lama masih butuh single label, boleh keep fallback ini
        fieldLabel: fieldLabels[0] ?? s.fieldOtherText?.[0] ?? null,
        categoryLabel: categoryLabels[0] ?? s.categoryOtherText?.[0] ?? null,
        subCategoryLabel: subCategoryLabels[0] ?? s.subCategoryOtherText?.[0] ?? null,

        tagsLabel: [...(s.tags ?? []).map((t) => t.name), ...(s.tagsOtherText ?? [])],
      };
    });

    return NextResponse.json({ submissions: payload });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}