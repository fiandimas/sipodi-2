import type { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

type JsonRow = {
  type: string;
  field: string;
  category: string;
  subCategory: string;
  tags?: string[];
};

// ============================================================
// WHITELIST 11 BIDANG (STRICT - SESUAI PDF)
// ============================================================
const FIELD_CANON_MAP = new Map<string, string>([
  ["Keagamaan", "Keagamaan"],
  ["Akademik", "Akademik"],
  ["Inovasi", "Inovasi"],
  ["Bahasa & Sastra", "Bahasa & Sastra"],
  ["Teknologi", "Teknologi"],
  ["Seni", "Seni"],
  ["Olahraga", "Olahraga"],
  ["Sosial", "Sosial"],
  ["Kepemimpinan", "Kepemimpinan"],
  ["Leadership", "Kepemimpinan"], // alias yg mungkin muncul di field (jaga-jaga)
  ["Kewirausahaan", "Kewirausahaan"],
  ["Lainnya", "Lainnya"],
]);

function clean(s: string) {
  return (s ?? "").trim().replace(/\s+/g, " ");
}

function uniq<T>(arr: T[]) {
  return [...new Set(arr)];
}

function fail(msg: string): never {
  throw new Error(`[seed-talenta] ${msg}`);
}

function canonicalFieldName(raw: string): string | null {
  const n = clean(raw);
  return FIELD_CANON_MAP.get(n) ?? null;
}

// ============================================================
// UPSERT HELPERS
// ============================================================
async function upsertField(prisma: PrismaClient, name: string) {
  const canon = canonicalFieldName(name);
  if (!canon) {
    console.warn(`⚠️  Field tidak valid (diskip): "${name}"`);
    return null;
  }

  return prisma.talentField.upsert({
    where: { name: canon },
    update: { isActive: true },
    create: { name: canon, isActive: true },
    select: { id: true, name: true },
  });
}

async function upsertCategory(prisma: PrismaClient, fieldId: string, name: string) {
  const n = clean(name);
  return prisma.talentCategory.upsert({
    where: { fieldId_name: { fieldId, name: n } },
    update: { isActive: true },
    create: { fieldId, name: n, isActive: true },
    select: { id: true },
  });
}

async function upsertSubCategory(prisma: PrismaClient, categoryId: string, name: string) {
  const n = clean(name);
  return prisma.talentSubCategory.upsert({
    where: { categoryId_name: { categoryId, name: n } },
    update: { isActive: true },
    create: { categoryId, name: n, isActive: true },
    select: { id: true, name: true },
  });
}

async function upsertTagGlobal(prisma: PrismaClient, name: string) {
  const n = clean(name);
  return prisma.talentTag.upsert({
    where: { name: n },
    update: { isActive: true },
    create: { name: n, isActive: true },
    select: { id: true, name: true },
  });
}

async function upsertScopedTag(
  prisma: PrismaClient,
  params: { typeId: string; subCategoryId: string; tagName: string },
) {
  const tag = await upsertTagGlobal(prisma, params.tagName);

  await prisma.talentTypeSubCategoryTag.upsert({
    where: {
      typeId_subCategoryId_tagId: {
        typeId: params.typeId,
        subCategoryId: params.subCategoryId,
        tagId: tag.id,
      },
    },
    update: { isActive: true },
    create: {
      typeId: params.typeId,
      subCategoryId: params.subCategoryId,
      tagId: tag.id,
      isActive: true,
    },
  });

  return tag;
}

// ============================================================
// LOAD JSON
// ============================================================
function loadTalentaJson(): JsonRow[] {
  const p = path.resolve("data/talenta/talenta.master.json");
  if (!fs.existsSync(p)) {
    fail(`File tidak ditemukan: ${p}\nJalankan generator: npx tsx scripts/generate-talenta-json.ts`);
  }

  const raw = fs.readFileSync(p, "utf8");
  const data = JSON.parse(raw) as any[];

  return (data as JsonRow[])
    .map((r) => ({
      type: clean((r as any).type),
      field: clean((r as any).field),
      category: clean((r as any).category),
      subCategory: clean((r as any).subCategory),
      tags: (((r as any).tags ?? []) as string[]).map(clean).filter(Boolean),
    }))
    .filter((r) => r.type && r.field && r.category && r.subCategory);
}

// ============================================================
// TYPE NORMALIZATION (konsisten dengan generator)
// ============================================================
function canonicalTypeName(raw: string) {
  const s = clean(raw).toLowerCase();

  if (
    s.includes("peserta") &&
    (s.includes("pelatihan") || s.includes("workshop") || s.includes("seminar") || s.includes("upskilling"))
  ) {
    return "Peserta (Pelatihan / Workshop / Seminar / Upskilling)";
  }

  if (
    (s.includes("narasumber") || s.includes("ahli")) &&
    (s.includes("pelatihan") || s.includes("workshop") || s.includes("seminar") || s.includes("upskilling"))
  ) {
    return "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)";
  }

  if (s.includes("pembimbing") && s.includes("lomba")) return "Pembimbing Lomba";
  if (s.includes("peserta") && s.includes("lomba")) return "Peserta Lomba";
  if (s.includes("minat") || s.includes("bakat") || s.includes("lainnya")) return "Minat / Bakat / Lainnya";

  return clean(raw);
}

// ============================================================
// TAG VALIDATION RULES
// ============================================================
function assertSpecialTagRule(
  row: { type: string; field: string; category: string; subCategory: string },
  tag: string,
) {
  const t = clean(tag);
  const type = clean(row.type);

  const isJuara = t === "Juara 1" || t === "Juara 2" || t === "Juara 3";
  const isPesertaExtra = t === "Gempita Awards" || t === "EJIES";

  if (isJuara && type !== "Peserta Lomba" && type !== "Pembimbing Lomba") {
    fail(
      `Tag "${t}" hanya untuk "Peserta Lomba"/"Pembimbing Lomba", tapi ketemu di type="${type}" (field="${row.field}", category="${row.category}", subCategory="${row.subCategory}")`,
    );
  }

  if (isPesertaExtra && type !== "Peserta Lomba") {
    fail(
      `Tag "${t}" hanya untuk "Peserta Lomba", tapi ketemu di type="${type}" (field="${row.field}", category="${row.category}", subCategory="${row.subCategory}")`,
    );
  }
}

// ============================================================
// MAIN SEEDER (FINAL)
// ============================================================
export async function seedTalentaMaster(prisma: PrismaClient) {
  console.log("\n🌱 [seed-talenta] Mulai seed master talenta...");

  const rows = loadTalentaJson();
  console.log(`   → ${rows.length} baris dari JSON`);

  const rowsCanon = rows.map((r) => ({
    ...r,
    type: canonicalTypeName(r.type),
  }));

  const CANON_TYPES = [
    "Peserta (Pelatihan / Workshop / Seminar / Upskilling)",
    "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)",
    "Pembimbing Lomba",
    "Peserta Lomba",
    "Minat / Bakat / Lainnya",
  ] as const;

  // Pastikan 5 type canonical aktif, selain itu nonaktif
  await prisma.talentType.updateMany({
    data: { isActive: false },
    where: { isActive: true, NOT: { name: { in: [...CANON_TYPES] } } },
  });

  await prisma.talentType.updateMany({
    data: { isActive: true },
    where: { name: { in: [...CANON_TYPES] } },
  });

  // Upsert semua type yang muncul di JSON (harusnya 5 canonical)
  const typeNames = uniq(rowsCanon.map((r) => r.type));
  for (const name of typeNames) {
    await prisma.talentType.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
      select: { id: true },
    });
  }

  // Cache TypeId
  const typeCache = new Map<string, string>();
  async function getTypeId(typeName: string) {
    const n = clean(typeName);
    const cached = typeCache.get(n);
    if (cached) return cached;

    const t = await prisma.talentType.findUnique({ where: { name: n }, select: { id: true } });
    if (!t) fail(`TalentType tidak ditemukan: ${n}`);
    typeCache.set(n, t.id);
    return t.id;
  }

  // Caches entity ID
  const fieldCache = new Map<string, { id: string; name: string }>();
  const categoryCache = new Map<string, string>();
  const subCache = new Map<string, string>();

  // Track subcategory per type untuk enforce tags
  const subIdsByType = new Map<string, Set<string>>();

  let skipped = 0;

  for (const row of rowsCanon) {
    const typeId = await getTypeId(row.type);

    // 1) Field (strict whitelist)
    let fieldData = fieldCache.get(row.field);
    if (!fieldData) {
      const f = await upsertField(prisma, row.field);
      if (!f) {
        skipped++;
        continue;
      }
      fieldData = { id: f.id, name: f.name };
      fieldCache.set(row.field, fieldData);
    }

    // 1b) Link Type ↔ Field (scoped)
    await prisma.talentTypeField.upsert({
      where: { typeId_fieldId: { typeId, fieldId: fieldData.id } },
      update: { isActive: true },
      create: { typeId, fieldId: fieldData.id, isActive: true },
    });

    // 2) Category (global under field)
    const catKey = `${fieldData.id}|${row.category}`;
    let categoryId = categoryCache.get(catKey);
    if (!categoryId) {
      const c = await upsertCategory(prisma, fieldData.id, row.category);
      categoryId = c.id;
      categoryCache.set(catKey, categoryId);
    }

    // 2b) Link Type ↔ Category (scoped)
    await prisma.talentTypeCategory.upsert({
      where: { typeId_categoryId: { typeId, categoryId } },
      update: { isActive: true },
      create: { typeId, categoryId, isActive: true },
    });

    // 3) SubCategory (global under category)
    const subKey = `${categoryId}|${row.subCategory}`;
    let subCategoryId = subCache.get(subKey);
    if (!subCategoryId) {
      const s = await upsertSubCategory(prisma, categoryId, row.subCategory);
      subCategoryId = s.id;
      subCache.set(subKey, subCategoryId);
    }

    // 3b) Link Type ↔ SubCategory (scoped)
    await prisma.talentTypeSubCategory.upsert({
      where: { typeId_subCategoryId: { typeId, subCategoryId } },
      update: { isActive: true },
      create: { typeId, subCategoryId, isActive: true },
    });

    // Track subCategoryId per type
    {
      const set = subIdsByType.get(row.type) ?? new Set<string>();
      set.add(subCategoryId);
      subIdsByType.set(row.type, set);
    }

    // 4) Scoped tags dari JSON (type + subCategory + tag)
    for (const tagName of row.tags ?? []) {
      assertSpecialTagRule(row, tagName);
      await upsertScopedTag(prisma, { typeId, subCategoryId, tagName });
    }
  }

  if (skipped > 0) {
    console.warn(`   ⚠️  ${skipped} baris diskip karena field tidak valid`);
  }

  // Enforce tag wajib sesuai rule lomba
  const JUARA = ["Juara 1", "Juara 2", "Juara 3"] as const;
  const PESERTA_EXTRA = ["Gempita Awards", "EJIES"] as const;

  const pesertaTypeName = "Peserta Lomba";
  const pembimbingTypeName = "Pembimbing Lomba";

  if (!subIdsByType.has(pesertaTypeName)) fail(`Type "${pesertaTypeName}" tidak ada di JSON`);
  if (!subIdsByType.has(pembimbingTypeName)) fail(`Type "${pembimbingTypeName}" tidak ada di JSON`);

  const pesertaLombaTypeId = await getTypeId(pesertaTypeName);
  const pembimbingLombaTypeId = await getTypeId(pembimbingTypeName);

  const pesertaSubIds = [...(subIdsByType.get(pesertaTypeName) ?? new Set<string>())];
  const pembimbingSubIds = [...(subIdsByType.get(pembimbingTypeName) ?? new Set<string>())];

  for (const subCategoryId of pesertaSubIds) {
    for (const tagName of [...JUARA, ...PESERTA_EXTRA]) {
      await upsertScopedTag(prisma, { typeId: pesertaLombaTypeId, subCategoryId, tagName });
    }
  }

  for (const subCategoryId of pembimbingSubIds) {
    for (const tagName of JUARA) {
      await upsertScopedTag(prisma, { typeId: pembimbingLombaTypeId, subCategoryId, tagName });
    }
  }

  // Output ringkas
  const fieldsCount = await prisma.talentField.count({ where: { isActive: true } });
  const typesCount = await prisma.talentType.count({ where: { isActive: true } });
  const typeFieldCount = await prisma.talentTypeField.count({ where: { isActive: true } });
  const typeCategoryCount = await prisma.talentTypeCategory.count({ where: { isActive: true } });
  const typeSubCount = await prisma.talentTypeSubCategory.count({ where: { isActive: true } });
  const scopedTagCount = await prisma.talentTypeSubCategoryTag.count({ where: { isActive: true } });

  console.log(`\n✅ [seed-talenta] Selesai!`);
  console.log(`   - TalentField aktif: ${fieldsCount}`);
  console.log(`   - TalentType aktif: ${typesCount}`);
  console.log(`   - Link type↔field aktif: ${typeFieldCount}`);
  console.log(`   - Link type↔category aktif: ${typeCategoryCount}`);
  console.log(`   - Link type↔subCategory aktif: ${typeSubCount}`);
  console.log(`   - Scoped tags aktif: ${scopedTagCount}`);
}
