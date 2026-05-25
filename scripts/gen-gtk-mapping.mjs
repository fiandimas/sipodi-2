import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = path.join(ROOT, "data", "DAFTAR_GTK");

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else if (ent.isFile() && ent.name.toLowerCase().endsWith(".xlsx")) out.push(full);
  }
  return out;
}

function fileToNote(absPath) {
  const base = path.basename(absPath, path.extname(absPath));
  return base.replace(/\s+/g, " ").trim();
}

const filesAbs = walk(BASE).sort((a, b) => a.localeCompare(b));

const items = filesAbs.map((abs) => ({
  file: path.relative(ROOT, abs).replaceAll("\\", "/"),
  schoolNpsn: "",
  note: fileToNote(abs),
}));

const outPath = path.join(BASE, "mapping.json");
fs.writeFileSync(outPath, JSON.stringify(items, null, 2));
console.log(`✅ mapping.json dibuat: ${outPath}`);
console.log(`✅ total file GTK: ${items.length}`);