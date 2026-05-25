/* ===================== PRINT/PDF FUNCTIONS ===================== */

export const openPrintWindow = () => {
  const w = window.open("", "_blank", "width=950,height=700");
  if (!w) {
    alert("Popup diblokir browser. Izinkan popup untuk situs ini.");
    return null;
  }
  w.document.open();
  w.document.write(`<html><head><title></title></head><body>Memuat...</body></html>`);
  w.document.close();
  return w;
};

export type PrintLetterhead = {
  title: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  logoPath?: string | null;
  signerName?: string | null;
  signerRank?: string | null;
  signerNip?: string | null;
  signerRole?: string | null;
};

export type PrintGtk = {
  name: string;
  schoolName: string;
};

export type SubmissionItem = {
  jenisTalenta?: string | null;
  fieldLabel?: string | null;
  activityName?: string | null;
  description?: string | null;
  subject?: string | null;
  gtk?: {
    name?: string | null;
    school?: {
      name?: string | null;
      npsn?: string | null;
    } | null;
    nik?: string | null;
  } | null;
};

export const printCtx: {
  gtk: PrintGtk | null;
  letterhead: PrintLetterhead | null;
  branchCity: string | null;
} = {
  gtk: null,
  letterhead: null,
  branchCity: null,
};

export type TtdInput = {
  name: string;
  nip: string;
};

/* ===================== LETTERHEAD LOADER ===================== */

type LetterheadApiResponse =
  | {
    ok: true;
    data: {
      branchId: string;
      branchCity: string | null;
      letterhead: PrintLetterhead;
    };
  }
  | { ok?: false; error: string };

// anti double-fetch paralel (mis. user klik print berkali-kali cepat)
let letterheadPromise: Promise<{ ok: true } | { ok: false; error: string }> | null = null;

async function ensureLetterheadLoaded(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (printCtx.letterhead) return { ok: true };

  if (letterheadPromise) return letterheadPromise;

  letterheadPromise = (async () => {
    try {
      const res = await fetch("/api/branch-letterhead", {
        cache: "no-store",
        credentials: "include",
      });

      const text = await res.text();

      let json: LetterheadApiResponse;
      try {
        json = JSON.parse(text) as LetterheadApiResponse;
      } catch {
        return { ok: false as const, error: "Respon server kop tidak valid (bukan JSON)." };
      }

      if (!res.ok || !("data" in json)) {
        return {
          ok: false as const,
          error: (json as any)?.error ?? "Gagal mengambil kop cabang dari server.",
        };
      }

      printCtx.letterhead = json.data.letterhead;
      printCtx.branchCity = json.data.branchCity ?? null;

      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: "Gagal mengambil kop cabang (network/server error)." };
    } finally {
      // kalau gagal, biar bisa retry pada klik berikutnya
      letterheadPromise = null;
    }
  })();

  return letterheadPromise;
}

/* ===================== UTIL ===================== */

const esc = (v: string | null | undefined) =>
  (v ?? "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const loadImageAsBase64 = async (imagePath: string): Promise<string> => {
  try {
    const response = await fetch(imagePath, { cache: "no-store" });
    if (!response.ok) {
      console.warn(`Image fetch failed: ${imagePath} (${response.status})`);
      return "";
    }
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`FileReader error: ${imagePath}`));
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn(`Gagal load image ${imagePath}:`, err);
    return "";
  }
};

const fmtPrintedAt = () =>
  new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

/**
 * CSS utama:
 * - Kop rapat (logo mepet teks)
 * - Tabel anti melebar: table-layout fixed + overflow-wrap
 */
const buildBaseCss = (page: { size: string; margin: string }, baseFontPt: string) => `
  @page { size: ${page.size}; margin: ${page.margin}; }

  body {
    font-family: "Times New Roman", Times, serif;
    font-size: ${baseFontPt};
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    margin: 0;
    padding: 0;
  }

  .page { width: 100%; max-width: 100%; }

  .kop { margin:0; padding:0; }
.kop-table { width:100%; border-collapse:collapse; border:none !important; margin:0 !important; }
.kop-table td { border:none !important; padding:0 !important; vertical-align:middle; }

.kop-logo { width:140px; padding-right:10px !important; }
.kop-logo img { height:96px; width:auto; display:block; }

.kop-text { text-align:center; }
.kop-title { font-size:18pt; font-weight:700; line-height:1.05; }
.kop-sub1 { font-size:10.5pt; font-weight:700; line-height:1.1; }
.kop-sub2 { font-size:10.5pt; font-weight:700; line-height:1.1; }
.kop-address { margin-top:3px; font-size:10pt; line-height:1.2; }

.divider {
  border-top:4px solid #000;
  border-bottom:1px solid #000;
  height:0;
  margin:8px 0 12px;
}

  /* ===== TITLE ===== */
  .doc-title { text-align: center; margin: 0; font-weight: 700; }
  .doc-subtitle { text-align: center; margin: 3px 0 10px; font-weight: 700; }
  .printed-at { margin: 2px 0 6px; font-size: 10.5pt; text-align: left; }

  /* ===== TABLE (ANTI MELEBAR) ===== */
  table.print-table {
    width: 100% !important;
    max-width: 100% !important;
    border-collapse: collapse;
    margin-top: 6px;
    table-layout: fixed; /* [web:132] */
  }
  table.print-table th,
  table.print-table td {
    border: 1px solid #000;
    padding: 4px 4px;
    vertical-align: top;
    overflow-wrap: anywhere; /* [web:143] */
    word-break: break-word;
  }
  table.print-table th { text-align: center; font-weight: 700; background: #fff; }
  .c { text-align: center; }

  /* ===== SIGNATURE ===== */
  .ttd-wrap { margin-top: 18px; break-inside: avoid; page-break-inside: avoid; }
  .ttd-right {
    width: 280px;
    margin-left: auto;
    transform: translateX(20mm);
  }  
  .ttd-block { font-size: 12pt; }
  .ttd-spacer { height: 82px; }
  .ttd-name { margin-top:6px; font-weight:400; }

  .ttd-wrap,
  .ttd-right,
  .ttd-block {
  break-inside: avoid;
  page-break-inside: avoid;
}
  .content { break-inside: auto; }

  @media print {
    thead { display: table-row-group !important; }
  }  
`;

const buildTtdHtml = (p: { signerName: string; signerNip: string }) => `
  <div class="ttd-wrap">
    <div class="ttd-right">
      <div class="ttd-block">
        <div>Mengetahui,</div>
        <div class="ttd-spacer"></div>
        <div>${esc(p.signerName)}</div>
        <div>NIP. ${esc(p.signerNip)}</div>
      </div>
    </div>
  </div>
`;

/* ===================== TALENTA PRINT ===================== */
export const renderPrintHtml = async (items: SubmissionItem[]) => {
  const loaded = await ensureLetterheadLoaded();
  if (!loaded.ok) {
    return { ok: false as const, error: loaded.error, html: "" };
  }

  const ctx = printCtx;
  if (!ctx.letterhead) {
    return {
      ok: false as const,
      error: "Kop cabang belum diset. Isi data BranchLetterhead (branch_letterheads) terlebih dulu.",
      html: "",
    };
  }

  const logoPath = ctx.letterhead.logoPath ?? "/logo-dindik.png";
  const logoBase64 = await loadImageAsBase64(logoPath);
  const barcodeBase64 = await loadImageAsBase64("/barcode-ttd.png");

  const city = ctx.branchCity ?? "Malang";

  const titleUpper = esc(ctx.letterhead.title ?? "");
  const address = esc(ctx.letterhead.address ?? "");
  const phone = esc(ctx.letterhead.phone ?? "");
  const email = esc(ctx.letterhead.email ?? "");

  const signerName = esc(ctx.letterhead.signerName ?? "");
  const signerRank = esc(ctx.letterhead.signerRank ?? "");
  const signerNip = esc(ctx.letterhead.signerNip ?? "");
  const signerNipClean = signerNip.replace(/\s+/g, "");

  const regionTextRaw = (ctx.letterhead.title.match(/\((.*)\)/)?.[0] ?? "").trim();
  const regionText = regionTextRaw ? esc(regionTextRaw) : "";

  const jenisTalentaRaw = items[0]?.jenisTalenta ?? "";
  const jenisTalentaLabel = jenisTalentaRaw ? esc(jenisTalentaRaw) : "";

  const rows = items
    .map((s, idx) => {
      const nama = s.gtk?.name ?? ctx.gtk?.name ?? "-";
      const sekolah = s.gtk?.school?.name ?? ctx.gtk?.schoolName ?? "-";
      const npsn = s.gtk?.school?.npsn ?? "-";
      const nik = s.gtk?.nik ?? "-";
      return `
        <tr>
          <td class="c">${idx + 1}.</td>
          <td>${esc(nama)}</td>
          <td>${esc(sekolah)}</td>
          <td>${esc(npsn)}</td>
          <td>${esc(nik)}</td>
        </tr>
      `;
    })
    .join("");

  const printedAt = fmtPrintedAt();

  // ===== KONSTANTA HEADER (sesuai permintaan Anda) =====
  const addressLine1: string = address;

  let addressLine2: string = "";
  if (phone) addressLine2 += `Telepon/Faksimile ${phone}`;
  if (email) addressLine2 += `${addressLine2 ? ", " : ""}Pos-el: ${email}`;
  addressLine2 = addressLine2.replace(/\s+/g, " ").trim();

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Cetak Talenta</title>
<style>
  ${buildBaseCss({ size: "A4", margin: "12mm 18mm 18mm 18mm" }, "12pt")}
  .doc-title { font-size: 12pt; }
  .doc-subtitle { font-size: 11.5pt; }
  .talent-line { margin: 4px 0 6px; font-weight: 700; text-align: left; font-size: 11pt; }
  table.data-table th, table.data-table td { font-size: 11pt; padding: 6px; }
  table.data-table th { padding: 7px 6px; }
  .kop-line3 { 
    font-size: 13.2pt; 
    font-weight: 700; 
    line-height: 1.05; 
    margin: 0; 
    padding: 0;
    word-break: break-word;
  }
</style>
</head>
<body>
  <div class="page">

  <div class="kop">
  <table class="kop-table">
    <tr>
      <td class="kop-logo">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ""}
      </td>
      <td class="kop-text">
        <div class="kop-title">SIPODI - Sistem Informasi Potensi Diri</div>
        <div class="kop-sub1">CABANG DINAS PENDIDIKAN WILAYAH MALANG</div>
        <div class="kop-sub2">(KOTA MALANG - KOTA BATU)</div>
        <div class="kop-address">
          <div>${addressLine1}</div>
          <div>${esc(addressLine2)}</div>
        </div>
      </td>
    </tr>
  </table>
</div>

<div class="divider"></div>

    <div class="doc-title">Potensi Diri Guru dan Tenaga Kependidikan</div>
    <div class="doc-subtitle">Cabang Dinas Pendidikan Wilayah Malang <br> (Kota Malang - Kota Batu)</div>

    ${jenisTalentaLabel ? `<div class="talent-line">Talenta: ${jenisTalentaLabel}</div>` : ""}
    <div class="printed-at">Dicetak pada: ${esc(printedAt)}</div>

    <table class="print-table data-table">
      <thead>
        <tr>
          <th style="width:6%">No</th>
          <th style="width:28%">Nama GTK</th>
          <th style="width:30%">Asal sekolah</th>
          <th style="width:16%">NPSN</th>
          <th style="width:20%">NIK</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="5" class="c">Tidak ada data</td></tr>`}
      </tbody>
    </table>

    ${buildTtdHtml({ signerName, signerNip })}
    </div>

  <script>
    window.onload = () => { window.focus(); window.print(); };
    window.onafterprint = () => window.close();
  </script>
</body>
</html>`;

  return { ok: true as const, html, error: "" };
};

/* ===================== GTK TABLE PRINT ===================== */
export type GtkPrintItem = {
  nik: string;
  name: string;
  email: string | null;
  gender: string | null;
  type: string | null;
  mapel: string | null;
  schoolName: string | null;
  schoolNpsn: string | null;
  city: string | null;
  birthDate: string | null;
};

export const renderGtkPrintHtml = async (items: GtkPrintItem[], signer: TtdInput) => {
  const loaded = await ensureLetterheadLoaded();
  if (!loaded.ok) {
    return { ok: false as const, error: loaded.error, html: "" };
  }

  const ctx = printCtx;
  if (!ctx.letterhead) {
    return {
      ok: false as const,
      error: "Kop cabang belum diset. Isi data BranchLetterhead (branch_letterheads) terlebih dulu.",
      html: "",
    };
  }

  const logoPath = ctx.letterhead.logoPath ?? "/logo-dindik.png";
  const logoBase64 = await loadImageAsBase64(logoPath);
  const barcodeBase64 = await loadImageAsBase64("/barcode-ttd.png");

  const city = ctx.branchCity ?? "Malang";

  const titleUpper = esc(ctx.letterhead.title ?? "");
  const address = esc(ctx.letterhead.address ?? "");
  const phone = esc(ctx.letterhead.phone ?? "");
  const email = esc(ctx.letterhead.email ?? "");

  const titleLines = (ctx.letterhead.title ?? "").split("\n").map(esc);
  const titleHtml = titleLines.join('</div><div class="kop-line3">');

  const signerName = (signer?.name ?? "").trim();
  const signerNip = (signer?.nip ?? "").trim();

  const regionTextRaw = (ctx.letterhead.title.match(/\((.*)\)/)?.[0] ?? "").trim();
  const regionText = regionTextRaw ? esc(regionTextRaw) : "";

  const printedAt = fmtPrintedAt();

  // ===== KONSTANTA HEADER (sesuai permintaan Anda) =====
  const addressLine1: string = address;

  let addressLine2: string = "";
  if (phone) addressLine2 += `Telepon/Faksimile ${phone}`;
  if (email) addressLine2 += `${addressLine2 ? ", " : ""}Pos-el: ${email}`;
  addressLine2 = addressLine2.replace(/\s+/g, " ").trim();

  const rows = items
    .map(
      (g, idx) => `
      <tr>
        <td class="c">${idx + 1}</td>
        <td>${esc(g.nik)}</td>
        <td>${esc(g.name)}</td>
        <td>${esc(g.email)}</td>
        <td class="c">${esc(g.gender ?? "-")}</td>
        <td>${esc(g.type ?? "-")}</td>
        <td>${esc(g.mapel ?? "-")}</td>
        <td>${esc(g.schoolName ?? "-")}</td>
        <td>${esc(g.schoolNpsn ?? "-")}</td>
        <td>${esc(g.city ?? "-")}</td>
        <td>${esc(g.birthDate ?? "-")}</td>
      </tr>
    `
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Daftar GTK</title>
<style>
  ${buildBaseCss({ size: "A4", margin: "12mm 18mm 18mm 18mm" }, "12pt")}
  .doc-title { font-size: 12pt; }
  .doc-subtitle { font-size: 11.5pt; }
  table.print-table th, table.print-table td { font-size: 10.5pt; }
  .kop-line3 { 
    font-size: 13.2pt; 
    font-weight: 700; 
    line-height: 1.05; 
    margin: 0; 
    padding: 0;
    word-break: break-word;
  }
</style>
</head>
<body>
  <div class="page">

  <div class="kop">
  <table class="kop-table">
    <tr>
      <td class="kop-logo">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ""}
      </td>
      <td class="kop-text">
        <div class="kop-title">SIPODI - Sistem Informasi Potensi Diri</div>
        <div class="kop-sub1">CABANG DINAS PENDIDIKAN WILAYAH MALANG</div>
        <div class="kop-sub2">(KOTA MALANG - KOTA BATU)</div>
        <div class="kop-address">
          <div>${addressLine1}</div>
          <div>${esc(addressLine2)}</div>
        </div>
      </td>
    </tr>
  </table>
</div>

<div class="divider"></div>

    <div class="doc-title">DAFTAR GURU DAN TENAGA KEPENDIDIKAN</div>
    <div class="doc-subtitle">Cabang Dinas Pendidikan Wilayah Malang <br> (Kota Malang - Kota Batu)</div>

    <div class="printed-at">Dicetak pada: ${esc(printedAt)}</div>

    <table class="print-table">
      <thead>
        <tr>
          <th style="width:3%">No</th>
          <th style="width:10%">NIK</th>
          <th style="width:14%">Nama</th>
          <th style="width:13%">Email</th>
          <th style="width:4%">L/P</th>
          <th style="width:10%">Jenis</th>
          <th style="width:10%">Mapel</th>
          <th style="width:14%">Sekolah</th>
          <th style="width:8%">NPSN</th>
          <th style="width:8%">Kota</th>
          <th style="width:8%">Tanggal Lahir</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="11" class="c">Tidak ada data</td></tr>`}
      </tbody>
    </table>

    ${buildTtdHtml({ signerName, signerNip })}
    </div>

  <script>
    window.onload = () => { window.focus(); window.print(); };
    window.onafterprint = () => window.close();
  </script>
</body>
</html>`;

  return { ok: true as const, html, error: "" };
};

/* ===================== SCHOOL TABLE PRINT ===================== */
export type SchoolPrintItem = {
  name: string;
  npsn: string;
  level: string;
  status: string;
  city: string;
  headName: string | null;
  jumlahGtk: number | null;
  rate?: number | null;
};

export const renderSchoolPrintHtml = async (items: SchoolPrintItem[], signer: TtdInput) => {
  const loaded = await ensureLetterheadLoaded();
  if (!loaded.ok) {
    return { ok: false as const, error: loaded.error, html: "" };
  }

  const ctx = printCtx;
  if (!ctx.letterhead) {
    return {
      ok: false as const,
      error: "Kop cabang belum diset. Isi data BranchLetterhead (branch_letterheads) terlebih dulu.",
      html: "",
    };
  }

  const logoPath = ctx.letterhead.logoPath ?? "/logo-dindik.png";
  const logoBase64 = await loadImageAsBase64(logoPath);
  const barcodeBase64 = await loadImageAsBase64("/barcode-ttd.png");

  const city = ctx.branchCity ?? "Malang";

  const titleUpper = esc(ctx.letterhead.title ?? "");
  const address = esc(ctx.letterhead.address ?? "");
  const phone = esc(ctx.letterhead.phone ?? "");
  const email = esc(ctx.letterhead.email ?? "");

  const titleLines = (ctx.letterhead.title ?? "").split("\n").map(esc);
  const titleHtml = titleLines.join('</div><div class="kop-line3">');

  const signerName = (signer?.name ?? "").trim();
  const signerNip = (signer?.nip ?? "").trim();

  const regionTextRaw = (ctx.letterhead.title.match(/\((.*)\)/)?.[0] ?? "").trim();
  const regionText = regionTextRaw ? esc(regionTextRaw) : "";

  const printedAt = fmtPrintedAt();

  // ===== KONSTANTA HEADER (sesuai permintaan Anda) =====
  const addressLine1: string = address;

  let addressLine2: string = "";
  if (phone) addressLine2 += `Telepon/Faksimile ${phone}`;
  if (email) addressLine2 += `${addressLine2 ? ", " : ""}Pos-el: ${email}`;
  addressLine2 = addressLine2.replace(/\s+/g, " ").trim();

  const fmtRate = (v: number | null | undefined) => {
    if (v == null) return "-";
    const n = Number(v);
    if (!Number.isFinite(n)) return "-";
    return n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const rows = items
    .map((s, idx) => {
      const statusLabel = (s.status ?? "").toUpperCase() === "NEGERI" ? "Negeri" : "Swasta";
      return `
        <tr>
          <td class="c">${idx + 1}</td>
          <td>${esc(s.name)}</td>
          <td class="c">${esc(s.npsn)}</td>
          <td class="c">${esc(s.level)}</td>
          <td class="c">${esc(statusLabel)}</td>
          <td>${esc(s.city)}</td>
          <td>${esc(s.headName ?? "-")}</td>
          <td class="c">${esc(s.jumlahGtk == null ? "-" : String(s.jumlahGtk))}</td>
          <td class="c">${esc(fmtRate(s.rate))}</td>
        </tr>
      `;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Daftar Sekolah</title>
<style>
  ${buildBaseCss({ size: "A4", margin: "18mm 16mm" }, "11pt")}
  .doc-title { font-size: 12pt; }
  .doc-subtitle { font-size: 11pt; }
  table.print-table th, table.print-table td { font-size: 10.8pt; padding: 5px 5px; }
  .kop-line3 { 
    font-size: 13.2pt; 
    font-weight: 700; 
    line-height: 1.05; 
    margin: 0; 
    padding: 0;
    word-break: break-word;
  }

  @media print {
    thead { display: table-row-group !important; }
    tr { break-inside: avoid; page-break-inside: avoid; }
  }  
</style>
</head>
<body>
  <div class="page">

  <div class="kop">
  <table class="kop-table">
    <tr>
      <td class="kop-logo">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ""}
      </td>
      <td class="kop-text">
        <div class="kop-title">SIPODI - Sistem Informasi Potensi Diri</div>
        <div class="kop-sub1">CABANG DINAS PENDIDIKAN WILAYAH MALANG</div>
        <div class="kop-sub2">(KOTA MALANG - KOTA BATU)</div>
        <div class="kop-address">
          <div>${addressLine1}</div>
          <div>${esc(addressLine2)}</div>
        </div>
      </td>
    </tr>
  </table>
</div>

<div class="divider"></div>

    <div class="doc-title">DAFTAR SEKOLAH</div>
    <div class="doc-subtitle">Cabang Dinas Pendidikan Wilayah Malang <br> (Kota Malang - Kota Batu)</div>

    <div class="printed-at">Dicetak pada: ${esc(printedAt)}</div>

    <table class="print-table">
      <thead>
      <tr>
      <th style="width:4%">No</th>
      <th style="width:28%">Nama Sekolah</th>
      <th style="width:12%">NPSN</th>
      <th style="width:10%">Jenjang</th>
      <th style="width:10%">Status</th>
      <th style="width:12%">Kota</th>
      <th style="width:20%">Kepala Sekolah</th>
      <th style="width:10%">Jumlah GTK</th>
      <th style="width:7%">Rate</th>
    </tr>
    
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="9" class="c">Tidak ada data</td></tr>`}
      </tbody>
    </table>

    ${buildTtdHtml({ signerName, signerNip })}
  </div>

  <script>
    window.onload = () => { window.focus(); window.print(); };
    window.onafterprint = () => window.close();
  </script>
</body>
</html>`;

  return { ok: true as const, html, error: "" };
};

/* ===================== USER TABLE PRINT ===================== */
export type UserPrintItem = {
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  gtkName: string | null;
  schoolName: string | null;
  branchName: string | null;
};

const ROLE_ALIAS: Record<string, string> = {
  USER_GTK: "GTK",
  ADMIN_SEKOLAH: "Admin Sekolah",
  ADMIN_TALENTA: "Admin Talenta",
  SUPER_ADMIN: "Super Admin",
};

function pdfRoleLabel(role: string) {
  const key = role.replaceAll(" ", "_").toUpperCase();
  return ROLE_ALIAS[key] ?? role;
}

export const renderUserPrintHtml = async (items: UserPrintItem[], signer: TtdInput) => {
  const loaded = await ensureLetterheadLoaded();
  if (!loaded.ok) {
    return { ok: false as const, error: loaded.error, html: "" };
  }

  const ctx = printCtx;
  if (!ctx.letterhead) {
    return {
      ok: false as const,
      error: "Kop cabang belum diset. Isi data BranchLetterhead (branch_letterheads) terlebih dulu.",
      html: "",
    };
  }

  const logoPath = ctx.letterhead.logoPath ?? "/logo-dindik.png";
  const logoBase64 = await loadImageAsBase64(logoPath);
  const barcodeBase64 = await loadImageAsBase64("/barcode-ttd.png");

  const city = ctx.branchCity ?? "Malang";

  const titleUpper = esc(ctx.letterhead.title ?? "");
  const address = esc(ctx.letterhead.address ?? "");
  const phone = esc(ctx.letterhead.phone ?? "");
  const email = esc(ctx.letterhead.email ?? "");

  const titleLines = (ctx.letterhead.title ?? "").split("\n").map(esc);
  const titleHtml = titleLines.join('</div><div class="kop-line3">');

  const signerName = (signer?.name ?? "").trim();
  const signerNip = (signer?.nip ?? "").trim();

  const regionTextRaw = (ctx.letterhead.title.match(/\((.*)\)/)?.[0] ?? "").trim();
  const regionText = regionTextRaw ? esc(regionTextRaw) : "";

  const printedAt = fmtPrintedAt();

  // ===== KONSTANTA HEADER (sesuai permintaan Anda) =====
  const addressLine1: string = address;

  let addressLine2: string = "";
  if (phone) addressLine2 += `Telepon/Faksimile ${phone}`;
  if (email) addressLine2 += `${addressLine2 ? ", " : ""}Pos-el: ${email}`;
  addressLine2 = addressLine2.replace(/\s+/g, " ").trim();

  const rows = items
    .map((u, idx) => {
      return `
        <tr>
          <td class="c">${idx + 1}</td>
          <td>${esc(u.username)}</td>
          <td>${esc(u.name)}</td>
          <td class="c">${esc(pdfRoleLabel(u.role))}</td>
          <td class="c">${u.isActive ? "Aktif" : "Nonaktif"}</td>
          <td>${esc(u.gtkName ?? "-")}</td>
          <td>${esc(u.schoolName ?? "-")}</td>
          <td>${esc(u.branchName ?? "-")}</td>
        </tr>
      `;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Daftar User</title>
<style>
${buildBaseCss({ size: "A4", margin: "18mm 16mm" }, "11pt")}
.doc-title { font-size: 12pt; }
  .doc-subtitle { font-size: 11pt; font-weight: 700; }
  table.print-table th, table.print-table td { font-size: 10.5pt; }
  .kop-line3 { 
    font-size: 13.2pt; 
    font-weight: 700; 
    line-height: 1.05; 
    margin: 0; 
    padding: 0;
    word-break: break-word;
  }
</style>
</head>
<body>
  <div class="page">

  <div class="kop">
  <table class="kop-table">
    <tr>
      <td class="kop-logo">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ""}
      </td>
      <td class="kop-text">
        <div class="kop-title">SIPODI - Sistem Informasi Potensi Diri</div>
        <div class="kop-sub1">CABANG DINAS PENDIDIKAN WILAYAH MALANG</div>
        <div class="kop-sub2">(KOTA MALANG - KOTA BATU)</div>
        <div class="kop-address">
          <div>${addressLine1}</div>
          <div>${esc(addressLine2)}</div>
        </div>
      </td>
    </tr>
  </table>
</div>

<div class="divider"></div>

    <div class="doc-title">DAFTAR USER APLIKASI</div>
    <div class="doc-subtitle">Cabang Dinas Pendidikan Wilayah ${esc(city)} <br> ${regionText ? regionText : ""}</div>

    <div class="printed-at">Dicetak pada: ${esc(printedAt)}</div>

    <table class="print-table">
      <thead>
        <tr>
          <th style="width:4%">No</th>
          <th style="width:14%">Username</th>
          <th style="width:18%">Nama</th>
          <th style="width:10%">Role</th>
          <th style="width:10%">Status</th>
          <th style="width:18%">GTK</th>
          <th style="width:18%">Sekolah</th>
          <th style="width:18%">Cabang</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="8" class="c">Tidak ada data</td></tr>`}
      </tbody>
    </table>

    ${buildTtdHtml({ signerName, signerNip })}
    </div>

  <script>
    window.onload = () => { window.focus(); window.print(); };
    window.onafterprint = () => window.close();
  </script>
</body>
</html>`;

  return { ok: true as const, html, error: "" };
};
