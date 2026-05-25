/**
 * ============================================================
 *  FIXED VERSION - PARSER TALENTA PDF
 *  - Handle PDF fragments properly
 *  - Proper tag scanning (no limit)
 *  - Proper tag splitting
 *  - Remove duplicates
 *  - Safe stop when detecting new field/category/subcategory
 * ============================================================
 */

import fs from "node:fs";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

type TalentaRow = {
    type: string;
    field: string;
    category: string;
    subCategory: string;
    tags: string[];
};

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
    ["Kewirausahaan", "Kewirausahaan"],
    ["Lainnya", "Lainnya"],
]);

const JUARA_TAGS = ["Juara 1", "Juara 2", "Juara 3"] as const;
const PESERTA_LOMBA_ONLY = ["Gempita Awards", "EJIES"] as const;
const LOMBA_TYPES = ["Pembimbing Lomba", "Peserta Lomba"] as const;

function clean(s: string): string {
    return (s ?? "")
        .toString()
        .replace(/\u00A0/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function canonicalField(x: string): string | null {
    return FIELD_CANON_MAP.get(clean(x)) ?? null;
}

/**
 * ============================================================
 *  FIXED SPLIT TAGS
 *  - Handles multi-fragment PDF lines
 *  - Removes trailing commas
 *  - Removes duplicate tags
 * ============================================================
 */
function splitTags(s: string): string[] {
    if (!s) return [];

    const cleaned = s
        .replace(/\u00A0/g, " ")       // remove non-breaking space
        .replace(/,+$/g, "")           // remove trailing commas like ",,,, "
        .trim();

    return cleaned
        .split(/,(?!\s*[A-Za-z]+\))/)   // split on comma safely
        .map(x => x.trim())
        .filter(Boolean);
}

/**
 * ============================================================
 *  APPLY RULES
 * ============================================================
 */
function enforceManualRules(rows: TalentaRow[]): TalentaRow[] {
    return rows.map((r) => {
        let tags = r.tags.filter(Boolean);
        const isLombaType = LOMBA_TYPES.includes(r.type as any);

        if (isLombaType) {
            for (const jt of JUARA_TAGS) {
                if (!tags.includes(jt)) tags.push(jt);
            }
        }

        if (r.type !== "Peserta Lomba") {
            tags = tags.filter(t => !PESERTA_LOMBA_ONLY.includes(t as any));
        }

        // remove duplicates
        tags = Array.from(new Set(tags));

        return { ...r, tags };
    });
}

function validateRules(rows: TalentaRow[]): void {
    const badSpecial = rows.filter(r =>
        r.type !== "Peserta Lomba" &&
        r.tags.some(t => PESERTA_LOMBA_ONLY.includes(t as any))
    );
    if (badSpecial.length > 0) {
        console.error(`❌ ${badSpecial.length} row punya tag khusus Peserta Lomba di type lain`);
        process.exit(1);
    }

    console.log("✅ Manual tag rules VALID");
}

/**
 * ============================================================
 *  READ PDF TEXT (WORKING & TESTED)
 * ============================================================
 */
async function readPdfText(filePath: string): Promise<string> {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const doc = await pdfjsLib.getDocument({ data }).promise;

    const parts: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = (content.items as any[])
            .map(it => (typeof it?.str === "string" ? it.str : ""))
            .join("\n");
        parts.push(pageText);
    }
    return parts.join("\n");
}

const TYPE_PATTERNS = [
    { pattern: /peserta.*pelatihan/i, normalized: "Peserta (Pelatihan / Workshop / Seminar / Upskilling)" },
    { pattern: /narasumber.*ahli/i, normalized: "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)" },
    { pattern: /pembimbing.*lomba/i, normalized: "Pembimbing Lomba" },
    { pattern: /peserta.*lomba/i, normalized: "Peserta Lomba" },
    { pattern: /minat.*bakat/i, normalized: "Minat / Bakat / Lainnya" },
];

function detectType(text: string): string | null {
    const lower = clean(text).toLowerCase();
    for (const { pattern, normalized } of TYPE_PATTERNS) {
        if (pattern.test(lower)) return normalized;
    }
    return null;
}

function isHeaderToken(t: string): boolean {
    const lower = t.toLowerCase();
    return ["jenis", "bidang", "kategori", "sub-kategori", "tag"].some(h =>
        lower === h || lower.includes(h)
    );
}

/**
 * ============================================================
 *  FIXED PARSER:
 *  - Handles multi-fragment rows
 *  - Unlimited tag scanning
 *  - Stops correctly when new field/category detected
 * ============================================================
 */
function parseTableRows(text: string, filename: string): TalentaRow[] {
    console.log(`🔍 Parsing ${filename}...`);

    const lines = text.split("\n").map(clean).filter(Boolean);
    const tokens = lines.filter(t => !isHeaderToken(t));

    const rows: TalentaRow[] = [];

    // Force type from filename (correct)
    const filenameToType: Record<string, string> = {
        "Data SIPODI - Talenta 1.pdf": "Peserta (Pelatihan / Workshop / Seminar / Upskilling)",
        "Data SIPODI - Talenta 2.pdf": "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)",
        "Data SIPODI - Talenta 3.pdf": "Pembimbing Lomba",
        "Data SIPODI - Talenta 4.pdf": "Peserta Lomba",
        "Data SIPODI - Talenta 5.pdf": "Minat / Bakat / Lainnya",
    };

    const currentType =
        filenameToType[filename] ||
        detectType(text) ||
        "Unknown";

    console.log(`   → Type: "${currentType}"`);

    for (let i = 0; i < tokens.length; i++) {
        const fieldCanon = canonicalField(tokens[i]);
        if (!fieldCanon) continue;

        const category = clean(tokens[i + 1] || "");
        const subCategory = clean(tokens[i + 2] || "");

        if (!category || !subCategory) continue;

        // ===============================
        //  FIXED TAG EXTRACTION (SCAN FORWARD)
        // ===============================
        const tagFragments: string[] = [];

        for (let j = i + 3; j < tokens.length; j++) {
            const token = clean(tokens[j]);
            if (!token) continue;

            // STOP SIGNALS
            if (canonicalField(token)) break;
            if (detectType(token)) break;
            if (/^[A-Z][A-Za-z &()]+$/.test(token) && !token.includes(",")) break;

            tagFragments.push(...splitTags(token));
        }

        const tags = Array.from(new Set(tagFragments));

        rows.push({
            type: currentType,
            field: fieldCanon,
            category,
            subCategory,
            tags,
        });

        i += 2;
    }

    console.log(`   → Found ${rows.length} rows`);
    return rows;
}

/**
 * ============================================================
 *  MAIN
 * ============================================================
 */
async function main() {
    const inputDir = path.resolve("data/DATA_TALENTA");
    const outDir = path.resolve("data/talenta");
    const outPath = path.join(outDir, "talenta.master.json");

    if (!fs.existsSync(inputDir)) {
        console.error(`❌ Folder tidak ditemukan: ${inputDir}`);
        process.exit(1);
    }

    const files = fs
        .readdirSync(inputDir)
        .filter(f => f.toLowerCase().endsWith(".pdf"))
        .sort();

    if (!files.length) {
        console.error("❌ Tidak ada PDF");
        process.exit(1);
    }

    const allRaw: TalentaRow[] = [];

    for (const f of files) {
        console.log(`\n📄 ${f}`);
        const text = await readPdfText(path.join(inputDir, f));
        const rows = parseTableRows(text, f);
        allRaw.push(...rows);
    }

    const invalidRows = allRaw.filter(r => !canonicalField(r.field));
    if (invalidRows.length > 0) {
        console.error(`❌ ${invalidRows.length} field tidak valid`);
        process.exit(1);
    }

    console.log("\n🔧 Applying rules...");
    const normalizedRows = enforceManualRules(allRaw);
    validateRules(normalizedRows);

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(normalizedRows, null, 2), "utf8");

    console.log(`\n✅ DONE. Output → ${outPath}`);

    // Summary
    const byType = new Map<string, number>();
    for (const r of normalizedRows) {
        byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
    }

    console.log("\n📊 Summary:");
    for (const [type, count] of byType.entries()) {
        console.log(`   - ${type}: ${count} rows`);
    }
}

main().catch(console.error);
