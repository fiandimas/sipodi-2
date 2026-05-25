import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

export async function GET(req: NextRequest) {
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

    const access = await prisma.userAccess.findFirst({
      where: {
        userId: session.sub,
        role: "ADMIN_SEKOLAH",
        ...(schoolNpsn ? { schoolNpsn } : {}),
        ...(branchId ? { branchId } : {}),
      },
      select: { id: true },
    });

    if (!access) {
      return NextResponse.json(
        { error: "Role/scope tidak sesuai (tidak punya akses ADMIN_SEKOLAH untuk scope ini)." },
        { status: 403 }
      );
    }

    if (!schoolNpsn) {
      return NextResponse.json(
        { error: "Scope admin sekolah belum punya schoolNpsn." },
        { status: 400 },
      );
    }

    const sp = req.nextUrl.searchParams;
    const sort = (sp.get("sort") ?? "").trim();
    const dirRaw = (sp.get("dir") ?? "").trim().toLowerCase();
    const dir: "asc" | "desc" = dirRaw === "asc" ? "asc" : "desc";

    const JUARA = new Set(["Juara 1", "Juara 2", "Juara 3"]);

    const tagTexts = sp
      .getAll("tagText")
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => !JUARA.has(x));

    const tagIds = sp.getAll("tagId").filter(Boolean);
    const juara = (sp.get("juara") ?? "").trim();

    const juaraValue = JUARA.has(juara) ? juara : "";

    const and: any[] = [];

    if (tagIds.length) {
      and.push({ tags: { some: { id: { in: tagIds } } } });
    }

    if (juaraValue) {
      and.push({ tags: { some: { name: juaraValue } } });
    }

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
        gtk: { schoolNpsn },
        ...(and.length ? { AND: and } : {}),
      },
      orderBy:
        sort === "score"
          ? [
            { computedScore: dir },
            { createdAt: "desc" },
          ]
          : { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        approvedScope: true,
        rejectedScope: true,
        approvedAt: true,
        approvalNote: true,
        approvedBy: {
          select: { id: true, name: true, username: true, role: true },
        },
        rejectedAt: true,
        rejectionNote: true,
        rejectedBy: {
          select: { id: true, name: true, username: true, role: true },
        },
        activityName: true,
        organizer: true,
        description: true,
        linkPendukung: true,
        fieldOtherText: true,
        categoryOtherText: true,
        subCategoryOtherText: true,
        tagsOtherText: true,
        gtk: {
          select: {
            nik: true,
            name: true,
            mapel: true,
            school: {
              select: {
                npsn: true,
                name: true,
                headName: true,
                headRank: true,
                headNip: true,
              },
            },
          },
        },
        type: { select: { id: true, name: true } },
        fields: {
          select: {
            field: {
              select: { id: true, name: true }
            }
          }
        },
        categories: {
          select: {
            category: {
              select: { id: true, name: true }
            }
          }
        },
        subCategories: {
          select: {
            subCategory: {
              select: { id: true, name: true }
            }
          }
        },
        tags: { select: { id: true, name: true } },
        scoreEntries: {
          select: {
            id: true,
            points: true,
            type: true,
            createdAt: true,
            note: true,
          },
          orderBy: { createdAt: "asc" },
        },
        files: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
          },
          orderBy: { createdAt: "asc" },
        },
        computedScore: true,
      },
    });

    const payload = submissions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),

      approvedScope: s.approvedScope ?? null,
      rejectedScope: s.rejectedScope ?? null,

      approvedAt: s.approvedAt ? s.approvedAt.toISOString() : null,
      rejectedAt: s.rejectedAt ? s.rejectedAt.toISOString() : null,

      fieldLabel: s.fields?.[0]?.field.name ?? s.fieldOtherText?.[0] ?? null,
      categoryLabel: s.categories?.[0]?.category.name ?? s.categoryOtherText?.[0] ?? null,
      subCategoryLabel: s.subCategories?.[0]?.subCategory.name ?? s.subCategoryOtherText?.[0] ?? null,

      fieldLabels: (s.fields ?? []).map(f => f.field.name),
      categoryLabels: (s.categories ?? []).map(c => c.category.name),
      subCategoryLabels: (s.subCategories ?? []).map(sc => sc.subCategory.name),

      tagsLabel: [
        ...(s.tags ?? []).map((t) => t.name),
        ...(Array.isArray(s.tagsOtherText) ? s.tagsOtherText : []),
      ],

      scoreEntries: (s.scoreEntries ?? []).map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
    }));

    return NextResponse.json({ submissions: payload, sort, dir });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
