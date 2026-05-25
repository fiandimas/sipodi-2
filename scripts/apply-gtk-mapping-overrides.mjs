import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const mappingPath = path.join(ROOT, "data", "DAFTAR_GTK", "mapping.json");

const overrides = {
    // KOTA BATU (berdasarkan tabel rekap Anda)
    "SMA AL IZZA": "69727602",                 // SMAS AL-IZZAH BATU
    "SMA HASYIM ASYARI": "20536831",          // SMAS ISLAM HASYIM ASY ARI BATU
    "SMA IMMANUEL BATU": "20536843",          // SMAS IMMANUEL BATU
    "SMA ISLAM BATU": "20536844",             // SMAS ISLAM BATU
    "SMA MUHAMMADIYAH 3 BATU": "20536829",    // SMAS MUHAMMADIYAH 3 BATU
    "SMA PGRI BATU": "20536816",              // SMAS PGRI BATU

    "SMK 17": "20536819",                     // SMKS 17 AGUSTUS BATU
    "SMK AMANAH HUSADA": "69774780",          // SMKS Kesehatan Amanah Husada
    "SMK BHINEKA TUNGGAL IKA": "69752269",    // SMKS BHINEKA TUNGGAL IKA INDON...
    "SMK BRAWIJAYA": "20536823",              // SMKS BRAWIJAYA BATU
    "SMK EDIT": "20536820",                   // SMKS EDITH BATU
    "SMK ISLAM": "20536821",                  // SMKS ISLAM BATU
    "SMK MA_ARIF": "20536824",                // SMKS MAARIF
    "SMK MUHAMMADIYAH 1": "20536825",         // SMKS MUHAMMADIYAH 1 BATU
    "SMK PUTIKECWARA": "20536828",            // SMKS PUTIKECWARA BATU
    "SMK WIYATA HUSADA": "69727599",          // SMKS WIYATA HUSADA

    // KOTA MALANG (berdasarkan kandidat DB Anda; yang ini umumnya jelas)
    "SMK ARDJUNA 2": "20533649",              // SMKS ARDJUNA 2
    "SMK BAITUL MAKMUR": "20577372",          // SMKS BAITUL MAKMUR
    "SMK BHAKTI LUHUR": "20533646",           // SMKS BHAKTI LUHUR
    "SMK BINA BANGSA MALANG": "20533648",     // SMKS BINA BANGSA MALANG
    "SMK BINA CENDIKA": "20539748",           // SMKS BINA CENDIKA
    "SMK COR JESU": "20533823",               // SMKS COR JESU MALANG
    "SMK EL HAYAT": "20583974",               // SMKS EL HAYAT
    "SMK FARMASI MAHARANI": "20571087",       // SMKS FARMASI MAHARANI
    "SMK GRAFIKA KARYA NASIONAL": "20533651", // SMKS GRAFIKA KARYA NASIONAL
    "SMK KESEHATAN ADI HUSADA": "69755782",   // SMKS KESEHATAN ADI HUSADA
    "SMK KESEHATAN KENDEDES": "69854821",     // SMKS KESEHATAN KENDEDES
    "SMK MUHAMMADIYAH 1 MALANG": "20533811",  // SMKS MUHAMMADIYAH 1 MALANG

    "SMK MUHAMMADIYAH 2 MALANG": "20533643",
    "SMK NASIONAL MEDIA CENTER": "69931836",
    "SMK PEKERJAAN UMUM": "20533821",
    "SMK PGRI 2": "20533809",
    "SMK PGRI 3": "20533808",
    "SMK PGRI 6": "20533795",
    "SMK PGRI 7": "20539752",
    "SMK PUTRA INDONESIA": "20533798",
    "SMK TARUNA BHAKTI": "20533802",
    "SMK TUNAS BANGSA": "20540219",
    "SMK WASKITA DHARMA": "20533644",

    // MALANG - SMK (dari hasil find-schools.mjs)
    "SMK INDOTEKNIKA": "69888531",       // SMKS INDOTEKNIKA
    "SMK PRAJNAPARAMITA": "20533797",    // SMKS PRAJNAPARAMITA
    "SMK SRIWEDARI": "20533800",         // SMKS SRIWEDARI
    "SMK WISNU WARDHANA": "20533805",    // SMKS WISNUWARDHANA MALANG
    "SMK NASIONAL": "20533812",          // SMKS NASIONAL MALANG
    "SMK PETRA": "20533822",             // SMKS PETRA YPK JATIM

    "SLB SUMBER DHARMA": "69861155",
};

function norm(s) {
    return String(s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

const items = JSON.parse(fs.readFileSync(mappingPath, "utf8"));

let applied = 0;
for (const it of items) {
    if (String(it.schoolNpsn || "").trim() !== "") continue;
    const key = norm(it.note);
    const npsn = overrides[key];
    if (npsn) {
        it.schoolNpsn = npsn;
        applied++;
    }
}

fs.writeFileSync(mappingPath, JSON.stringify(items, null, 2));
console.log(`✅ applied overrides: ${applied}`);
console.log(`✅ updated: ${mappingPath}`);
