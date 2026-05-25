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

function tokenize(s) {
  return norm(s).split(" ").filter(Boolean);
}

function score(needle, hay) {
  const nTok = new Set(tokenize(needle));
  const hTok = new Set(tokenize(hay));

  let hit = 0;
  for (const t of nTok) if (hTok.has(t)) hit++;

  // bonus kuat untuk substring match
  const n = norm(needle);
  const h = norm(hay);
  if (h === n) return 1000;
  if (h.includes(n) || n.includes(h)) return 400 + hit * 10;

  return hit * 10;
}

async function main() {
  const items = JSON.parse(fs.readFileSync(mappingPath, "utf8"));
  const empty = items.filter((x) => String(x.schoolNpsn || "").trim() === "");

  const schools = await prisma.school.findMany({
    select: { npsn: true, name: true, city: true },
  });

  console.log(`kosong: ${empty.length}`);
  console.log("Format: NOTE | FILE");
  console.log("  kandidat: (score) NPSN - NAME");

  for (const it of empty.slice(0, 30)) {
    const cityNeedle = cityFromFilePath(it.file);
    const pool = schools.filter((s) => norm(s.city).includes(cityNeedle));

    const ranked = pool
      .map((s) => ({
        npsn: s.npsn,
        name: s.name,
        sc: score(it.note || "", s.name),
      }))
      .sort((a, b) => b.sc - a.sc)
      .slice(0, 5);

    console.log("\n" + `${it.note} | ${it.file}`);
    for (const r of ranked) {
      console.log(`  kandidat: (${r.sc}) ${r.npsn} - ${r.name}`);
    }
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
