import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { getSession } from "@/app/_lib/session";

function nonEmpty(s: unknown) {
  return typeof s === "string" && s.trim().length > 0;
}

function asString(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

type XorPick = { ok: true; id?: string; text?: string } | { ok: false; error: string };

function pickXorIdOrText(params: { id: string; text: string }): XorPick {
  const id = params.id.trim();
  const text = params.text.trim();

  if (id && text) {
    return {
      ok: false,
      error: "Pilih salah satu: ID atau Lainnya (text), tidak boleh dua-duanya.",
    };
  }

  if (!id && !text) return { ok: true };
  if (id) return { ok: true, id };
  return { ok: true, text };
}

function requiredByTypeName(typeName: string) {
  const name = typeName.toLowerCase();
  const req = {
    field: true,
    category: false,
    subCategory: false,
  };

  if (name.includes("peserta") && name.includes("pelatihan")) {
    req.category = true;
  } else if (name.includes("narasumber") || name.includes("ahli")) {
    req.category = true;
  } else if (name.includes("pembimbing") && name.includes("lomba")) {
    req.category = true;
    req.subCategory = true;
  } else if (name.includes("peserta") && name.includes("lomba")) {
    req.category = true;
    req.subCategory = true;
  } else if (name.includes("minat") || name.includes("bakat")) {
    req.category = true;
  }

  return req;
}

function jenisScoreByTypeName(typeName: string) {
  const name = typeName.toLowerCase();

  if (
    name.includes("peserta") &&
    (name.includes("pelatihan") ||
      name.includes("workshop") ||
      name.includes("seminar") ||
      name.includes("upskilling"))
  ) {
    return 40;
  }

  if (
    (name.includes("narasumber") || name.includes("ahli")) &&
    (name.includes("pelatihan") ||
      name.includes("workshop") ||
      name.includes("seminar") ||
      name.includes("upskilling"))
  ) {
    return 80;
  }

  if (name.includes("pembimbing") && name.includes("lomba")) return 100;
  if (name.includes("peserta") && name.includes("lomba")) return 100;

  if (name.includes("minat") || name.includes("bakat") || name.includes("lainnya")) return 40;

  return 40;
}

const MAX_TAGS = 20;

function parseIntSafe(s: string) {
  const n = Number.parseInt(String(s ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const gtkNik = session?.gtkNik;

    if (!gtkNik) {
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
        gtkNik,
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

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const gtkNik = session?.gtkNik;

    if (!gtkNik) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Content-Type harus multipart/form-data" }, { status: 400 });
    }

    const fd = await req.formData();

    // wajib
    const typeId = asString(fd.get("typeId"));
    const activityName = asString(fd.get("activityName"));

    if (!nonEmpty(typeId) || !nonEmpty(activityName)) {
      return NextResponse.json({ error: "typeId dan activityName wajib diisi" }, { status: 400 });
    }

    const selfScoreRaw = asString(fd.get("selfScore"));
    const selfScoreParsed = parseIntSafe(selfScoreRaw);

    if (selfScoreParsed === null || selfScoreParsed < 1 || selfScoreParsed > 100) {
      return NextResponse.json({ error: "selfScore wajib 1-100" }, { status: 400 });
    }

    const selfScore = clamp(selfScoreParsed, 1, 100);

    // optional
    const organizer = asString(fd.get("organizer")).trim();
    const description = asString(fd.get("description")).trim();
    const linkPendukung = asString(fd.get("linkPendukung")).trim();

    // ID atau OtherText - FIXED CASCADE
    const fieldPick = pickXorIdOrText({
      id: asString(fd.get("fieldId")),
      text: asString(fd.get("fieldOtherText")),
    });
    if (!fieldPick.ok) {
      return NextResponse.json({ error: fieldPick.error }, { status: 400 });
    }

    const categoryPick = pickXorIdOrText({
      id: asString(fd.get("categoryId")),
      text: asString(fd.get("categoryOtherText")),
    });
    if (!categoryPick.ok) {
      return NextResponse.json({ error: categoryPick.error }, { status: 400 });
    }

    const subCategoryPick = pickXorIdOrText({
      id: asString(fd.get("subCategoryId")),
      text: asString(fd.get("subCategoryOtherText")),
    });
    if (!subCategoryPick.ok) {
      return NextResponse.json({ error: subCategoryPick.error }, { status: 400 });
    }

    // tags multi - FIXED junction table
    const tagIds = Array.from(
      new Set(
        fd
          .getAll("tagIds")
          .map((x) => String(x).trim())
          .filter(Boolean)
      )
    );

    const tagsOtherText = Array.from(
      new Set(
        fd
          .getAll("tagsOtherText")
          .map((x) => String(x).trim())
          .filter(Boolean)
      )
    );

    const totalTags = tagIds.length + tagsOtherText.length;
    if (totalTags < 1) {
      return NextResponse.json({ error: "Minimal 1 tag wajib diisi" }, { status: 400 });
    }

    if (totalTags > MAX_TAGS) {
      return NextResponse.json({ error: `Maksimal ${MAX_TAGS} tag` }, { status: 400 });
    }

    // validasi per jenis (DB)
    const type = await prisma.talentType.findUnique({
      where: { id: typeId },
      select: { name: true },
    });
    if (!type) {
      return NextResponse.json({ error: "Jenis talenta tidak valid" }, { status: 400 });
    }

    const reqRules = requiredByTypeName(type.name);

    if (reqRules.field && !(fieldPick.ok && (fieldPick.id || fieldPick.text))) {
      return NextResponse.json({ error: "Bidang wajib diisi" }, { status: 400 });
    }

    // VALIDASI CASCADE - FIXED!
    if (fieldPick.ok && fieldPick.id) {
      const typeField = await prisma.talentTypeField.findUnique({
        where: { typeId_fieldId: { typeId, fieldId: fieldPick.id } },
        select: { isActive: true },
      });
      if (!typeField || !typeField.isActive) {
        return NextResponse.json({ error: "Bidang tidak sesuai dengan Jenis Talenta" }, { status: 400 });
      }
    }

    if (reqRules.category && !(categoryPick.ok && (categoryPick.id || categoryPick.text))) {
      return NextResponse.json({ error: "Kategori wajib diisi" }, { status: 400 });
    }

    if (categoryPick.ok && categoryPick.id && fieldPick.ok && fieldPick.id) {
      const category = await prisma.talentCategory.findFirst({
        where: {
          id: categoryPick.id,
          fieldId: fieldPick.id,
          isActive: true,
        },
      });
      if (!category) {
        return NextResponse.json({ error: "Kategori tidak sesuai dengan Bidang" }, { status: 400 });
      }
    }

    if (reqRules.subCategory && !(subCategoryPick.ok && (subCategoryPick.id || subCategoryPick.text))) {
      return NextResponse.json({ error: "Sub Kategori wajib diisi" }, { status: 400 });
    }

    if (subCategoryPick.ok && subCategoryPick.id && categoryPick.ok && categoryPick.id) {
      const subCategory = await prisma.talentSubCategory.findFirst({
        where: {
          id: subCategoryPick.id,
          categoryId: categoryPick.id,
          isActive: true,
        },
      });
      if (!subCategory) {
        return NextResponse.json({ error: "Sub Kategori tidak sesuai dengan Kategori" }, { status: 400 });
      }
    }

    // TAG VALIDATION - FIXED junction table!
    if (tagIds.length > 0 && !(subCategoryPick.ok && subCategoryPick.id)) {
      return NextResponse.json(
        { error: "Untuk memilih Tag dari daftar, pilih Sub Kategori terlebih dahulu." },
        { status: 400 }
      );
    }

    if (tagIds.length > 0 && subCategoryPick.ok && subCategoryPick.id) {
      const validTags = await prisma.talentTypeSubCategoryTag.count({
        where: {
          typeId,
          subCategoryId: subCategoryPick.id!,
          tagId: { in: tagIds },
          isActive: true,
          tag: { isActive: true },
        },
      });
      if (validTags !== tagIds.length) {
        return NextResponse.json({ error: "Ada tag yang tidak sesuai dengan sub kategori/jenis." }, { status: 400 });
      }
    }

    // upload file (optional)
    const file = fd.get("file");
    let fileCreate:
      | {
        data: Uint8Array;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
      }
      | undefined;

    if (file && file instanceof File) {
      const sizeBytes = file.size;
      const mimeType = file.type || "application/octet-stream";
      const originalName = file.name || "upload";

      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "application/pdf",
      ];

      if (!allowedTypes.includes(mimeType)) {
        return NextResponse.json(
          { error: "File harus berupa JPG, PNG, atau PDF" },
          { status: 400 }
        );
      }

      const MAX = 2 * 1024 * 1024;
      if (sizeBytes > MAX) {
        return NextResponse.json(
          { error: "Ukuran file terlalu besar (maks 2MB)" },
          { status: 400 }
        );
      }

      const arrBuf = await file.arrayBuffer();

      fileCreate = {
        data: new Uint8Array(arrBuf),
        originalName,
        mimeType,
        sizeBytes,
      };
    }
    
    const tagScore = clamp(totalTags, 0, MAX_TAGS) * 5;
    const userScore = selfScore;
    const jenisScore = jenisScoreByTypeName(type.name);
    const adminScore = 0;
    const computedScore = round1(0.2 * userScore + 0.25 * jenisScore + 0.25 * tagScore + 0.3 * adminScore);

    // ✅ CREATE - FIXED SCHEMA RELATIONS!
    const created = await prisma.talentSubmission.create({
      data: {
        gtkNik,
        typeId,
        userScore,
        tagScore,
        jenisScore,
        adminScore,
        computedScore,

        // Junction tables - OK
        ...(fieldPick.ok && fieldPick.id ? { fields: { create: [{ fieldId: fieldPick.id }] } } : {}),
        ...(categoryPick.ok && categoryPick.id ? { categories: { create: [{ categoryId: categoryPick.id }] } } : {}),
        ...(subCategoryPick.ok && subCategoryPick.id ? { subCategories: { create: [{ subCategoryId: subCategoryPick.id }] } } : {}),

        // Other texts - OK
        ...(fieldPick.ok && fieldPick.text ? { fieldOtherText: [fieldPick.text] } : {}),
        ...(categoryPick.ok && categoryPick.text ? { categoryOtherText: [categoryPick.text] } : {}),
        ...(subCategoryPick.ok && subCategoryPick.text ? { subCategoryOtherText: [subCategoryPick.text] } : {}),

        activityName: activityName.trim(),
        organizer: organizer || null,
        description: description || null,
        linkPendukung: linkPendukung || null,
        tagsOtherText,

        // ✅ FIXED: direct tags connect (bukan junction table)
        ...(tagIds.length > 0
          ? {
            tags: {
              connect: tagIds.map((tagId) => ({ id: tagId })),
            },
          }
          : {}),

        ...(fileCreate ? { files: { create: [fileCreate] } } : {}),
      },
      select: { id: true },
    });

    return NextResponse.json({
      submissionId: created.id,
      fileUrl: null,
    });
  } catch (e) {
    console.error("[talent-submissions POST]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}