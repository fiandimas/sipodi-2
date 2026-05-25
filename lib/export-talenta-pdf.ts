// lib/export-talenta-pdf.ts

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

const esc = (v: string) =>
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

export const renderPrintHtml = async (
  items: SubmissionItem[],
  signer?: TtdInput
) => {
  const ctx = printCtx;

  if (!ctx.letterhead) {
    return {
      ok: false as const,
      error:
        "Kop cabang belum diset. Isi data BranchLetterhead (branch_letterheads) terlebih dulu.",
      html: "",
    };
  }

  const logoBase64 = await loadImageAsBase64("/logo-dindik.png");

  const city = ctx.branchCity ?? "Malang";

  const address = esc(ctx.letterhead.address ?? "");
  const phone = esc(ctx.letterhead.phone ?? "");
  const email = esc(ctx.letterhead.email ?? "");

  const jenisTalentaRaw = items[0]?.jenisTalenta ?? "";
  const jenisTalentaLabel = jenisTalentaRaw ? esc(jenisTalentaRaw) : "";

  const rows = items
    .map((s, idx) => {
      const nama = s.gtk?.name ?? ctx.gtk?.name ?? "-";
      const sekolah = s.gtk?.school?.name ?? ctx.gtk?.schoolName ?? "-";
      const npsn = s.gtk?.school?.npsn ?? "-";

      return `
        <tr>
          <td class="c">${idx + 1}.</td>
          <td>${esc(nama)}</td>
          <td>${esc(sekolah)}</td>
          <td>${esc(npsn)}</td>
        </tr>
      `;
    })
    .join("");

  const addressLine1: string = address;
  let addressLine2: string = "";
  if (phone) addressLine2 += `Telepon/Faksimile ${phone}`;
  if (email) addressLine2 += `${addressLine2 ? ", " : ""}Pos-el: ${email}`;
  addressLine2 = addressLine2.replace(/\s+/g, " ").trim();

  const printedAt = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const signerName = esc((signer?.name ?? "").trim());
  const signerNip = esc((signer?.nip ?? "").trim());

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Cetak Talenta</title>
<style>
  @page { size: A4; margin: 12mm 18mm 18mm 18mm; }
  body { font-family: "Times New Roman", Times, serif; font-size: 12pt; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin:0; padding:0; }

  /* ===== Header sesuai screenshot ===== */
  .kop { margin:0; padding:0; }
  .kop-table { width:100%; border-collapse:collapse; border:none !important; margin:0 !important; }
  .kop-table td { border:none !important; padding:0 !important; vertical-align:top; }
  .kop-logo { width:140px; }
  .kop-logo img { height:96px; width:auto; display:block; }

  .kop-text { width:100%; text-align:center; }
  .kop-sipodi { font-size:18pt; font-weight:700; line-height:1.05; }
  .kop-sub1 { font-size:10.5pt; font-weight:700; line-height:1.1; letter-spacing:0.2px; }
  .kop-sub2 { font-size:10.5pt; font-weight:700; line-height:1.1; }
  .kop-address { margin-top:3px; font-size:10pt; line-height:1.2; }

  /* garis tebal seperti screenshot */
  .divider { border-top:4px solid #000; height:0; margin:8px 0 12px; }

  .doc-title { text-align:center; margin:0; font-weight:700; font-size:12pt; }
  .doc-subtitle { text-align:center; margin:3px 0 10px; font-weight:700; font-size:11.5pt; }
  .talent-line { margin:4px 0 6px; font-weight:400; text-align:left; font-size:11pt; }
  .printed-at { margin:2px 0 6px; font-size:10.5pt; text-align:left; }

  table.data-table { width:100%; border-collapse:collapse; margin-top:6px; page-break-inside:auto; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  table.data-table th, table.data-table td { border:1px solid #000; padding:6px; vertical-align:top; font-size:11pt; }
  table.data-table th { text-align:center; font-weight:700; background:#cfe3bf; padding:7px 6px; }
  .c { text-align:center; }

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
  
</style>
</head>
<body>

<div class="kop">
  <table class="kop-table">
    <tr>
      <td class="kop-logo">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ""}
      </td>
      <td class="kop-text">
        <div class="kop-sipodi">SIPODI - Sistem Informasi Potensi Diri</div>
        <div class="kop-sub1">CABANG DINAS PENDIDIKAN WILAYAH ${esc(city).toUpperCase()}</div>
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
<div class="doc-subtitle">Cabang Dinas Pendidikan Wilayah ${esc(city)} <br> (Kota Malang – Kota Batu)</div>

${jenisTalentaLabel ? `<div class="talent-line">Talenta : ${jenisTalentaLabel}</div>` : ""}

<div class="printed-at">Dicetak pada: ${esc(printedAt)}</div>

<div class="content">
<table class="data-table">
  <thead>
    <tr>
      <th style="width:6%">No</th>
      <th style="width:28%">Nama GTK</th>
      <th style="width:30%">Asal sekolah</th>
      <th style="width:16%">NPSN</th>
    </tr>
  </thead>
  <tbody>
    ${rows || `<tr><td colspan="5" class="c">Tidak ada data</td></tr>`}
  </tbody>
</table>

<div class="ttd-wrap">
  <div class="ttd-right">
    <div class="ttd-block">
      <div>Mengetahui,</div>
      <div class="ttd-spacer"></div>
      <div>${signerName ? signerName : "MENGAMBIL INPUT NAMA"}</div>
      <div>${signerNip ? `NIP. ${signerNip}` : "NIP. MENGAMBIL DARI INPUT"}</div>
    </div>
  </div>
</div>

</div>

<script>
  window.onload = () => { window.focus(); window.print(); };
  window.onafterprint = () => window.close();
</script>
</body>
</html>`;

  return { ok: true as const, html, error: "" };
};
