import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL belum diset");

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ROOT = process.cwd();
const mappingPath = path.join(ROOT, "data", "DAFTAR_GTK", "mapping.json");

function norm(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/[`’']/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cityFromFilePath(p) {
  const u = String(p).toUpperCase();
  if (u.includes("KOTA BATU")) return "KOTA BATU";
  if (u.includes("KOTA MALANG")) return "KOTA MALANG";
  return "";
}

function schoolLevelFromPath(p) {
  const u = String(p).toUpperCase();
  if (u.includes("/SMK/")) return "SMK";
  if (u.includes("/SMA/")) return "SMA";
  if (u.includes("/SLB/")) return "SLB";
  return "";
}

// bikin beberapa kandidat nama untuk dicari
function buildGuesses(note, filePath) {
  const n = norm(note);
  const city = cityFromFilePath(filePath);

  // perbaiki beberapa penulisan umum
  const fixed =
    n
      .replace(/\bSMAN\b/g, "SMA NEGERI")
      .replace(/\bSMKN\b/g, "SMK NEGERI")
      .replace(/\bSLBN\b/g, "SLB NEGERI")
      .replace(/\bMA ARIF\b/g, "MAARIF")
      .replace(/\bMA'ARIF\b/g, "MAARIF")
      .replace(/\bPUTIKECWARA\b/g, "PUTI KECWARA")
      .replace(/\bPGRI\b/g, "PGRI")
      .replace(/\s+/g, " ")
      .trim();

  const level = schoolLevelFromPath(filePath);

  const guesses = new Set();

  // 1) base note
  guesses.add(fixed);

  // 2) kalau nama terlalu pendek, tambah level di depan
  if (level && !fixed.startsWith(level)) guesses.add(`${level} ${fixed}`);

  // 3) coba dengan kota
  if (city) guesses.add(`${fixed} ${city}`);
  if (city && level && !fixed.startsWith(level)) guesses.add(`${level} ${fixed} ${city}`);

  // 4) beberapa sekolah di data sekolah biasanya pakai “KOTA BATU”/“KOTA MALANG” bukan “BATU/MALANG”
  if (fixed.endsWith("BATU") && city === "KOTA BATU") guesses.add(fixed.replace(/\bBATU\b/g, "KOTA BATU"));
  if (fixed.endsWith("MALANG") && city === "KOTA MALANG") guesses.add(fixed.replace(/\bMALANG\b/g, "KOTA MALANG"));

  return [...guesses].filter(Boolean);
}

// scoring berbasis token overlap (lebih tahan beda ejaan)
function scoreMatch(guessNorm, schoolNorm) {
  if (!guessNorm || !schoolNorm) return 0;

  if (schoolNorm === guessNorm) return 1000;
  if (schoolNorm.includes(guessNorm) || guessNorm.includes(schoolNorm)) return 600;

  const gTokens = new Set(guessNorm.split(" ").filter(Boolean));
  const sTokens = new Set(schoolNorm.split(" ").filter(Boolean));

  let hit = 0;
  for (const t of gTokens) if (sTokens.has(t)) hit++;

  // penalti kalau guess terlalu pendek (mis. "SMK 17")
  const lengthBonus = Math.min(gTokens.size, sTokens.size);
  return hit * 10 + lengthBonus;
}

async function main() {
  const items = JSON.parse(fs.readFileSync(mappingPath, "utf8"));

  const schools = await prisma.school.findMany({
    select: { npsn: true, name: true, city: true },
  });

  const schoolIndex = schools.map((s) => ({
    npsn: String(s.npsn),
    nameRaw: s.name,
    nameNorm: norm(s.name),
    cityNorm: norm(s.city),
  }));

  let filled = 0;
  let skipped = 0;

  // hanya proses yang masih kosong
  for (const it of items) {
    if (String(it.schoolNpsn || "").trim() !== "") {
      skipped++;
      continue;
    }

    const note = it.note || path.basename(it.file, ".xlsx");
    const cityNeedle = cityFromFilePath(it.file);

    const guesses = buildGuesses(note, it.file);

    let best = { npsn: "", score: 0, name: "" };

    for (const g of guesses) {
      const gNorm = norm(g);

      for (const s of schoolIndex) {
        // filter kota biar tidak salah silang Malang/Batu
        if (cityNeedle && !s.cityNorm.includes(cityNeedle)) continue;

        const sc = scoreMatch(gNorm, s.nameNorm);
        if (sc > best.score) best = { npsn: s.npsn, score: sc, name: s.nameRaw };
      }
    }

    // threshold agar tidak asal isi
    if (best.score >= 80) {
      it.schoolNpsn = best.npsn;
      filled++;
    }
  }

  fs.writeFileSync(mappingPath, JSON.stringify(items, null, 2));
  console.log(`✅ mapping updated: ${mappingPath}`);
  console.log(`✅ filled (this run): ${filled}, skipped(already filled): ${skipped}, total: ${items.length}`);

  const stillEmpty = items.filter((x) => String(x.schoolNpsn || "").trim() === "");
  console.log(`⚠️ still empty after run: ${stillEmpty.length}`);
  if (stillEmpty.length) {
    console.log(stillEmpty.slice(0, 25).map((x) => `${x.note} | ${x.file}`).join("\n"));
  }
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
