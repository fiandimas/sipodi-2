// /lib/print-utils-core.ts

/* ============================================================
   CONTEXT & TYPES
============================================================ */

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

export type TtdInput = {
  name: string;
  nip: string;
};

// Shared runtime print context
export const printCtx: {
  gtk: PrintGtk | null;
  letterhead: PrintLetterhead | null;
  branchCity: string | null;
} = {
  gtk: null,
  letterhead: null,
  branchCity: null,
};

/* ============================================================
   UTIL FUNCTIONS
============================================================ */

export const esc = (v: string | null | undefined) =>
  (v ?? "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const loadImageAsBase64 = async (imagePath: string): Promise<string> => {
  try {
    const response = await fetch(imagePath, { cache: "no-store" });
    if (!response.ok) return "";
    const blob = await response.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject("FileReader error");
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn(`Gagal load image ${imagePath}:`, err);
    return "";
  }
};

export const fmtPrintedAt = () =>
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

/* ============================================================
   CSS BUILDER (100% IDENTIK DENGAN SUPER ADMIN)
============================================================ */

export const buildBaseCss = (
  page: { size: string; margin: string },
  baseFontPt: string
) => `
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

  .kop-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
    padding: 0;
  }

  .kop-table td {
    border: none !important;
    padding: 0 !important;
    vertical-align: middle;
  }

  .kop-logo { width: 140px; padding-right: 10px !important; }
  .kop-logo img { height: 96px; width: auto; display: block; }

  .kop-text { text-align: center; }
  .kop-title { font-size: 18pt; font-weight: 700; line-height: 1.05; }
  .kop-sub1 { font-size: 10.5pt; font-weight: 700; line-height: 1.1; }
  .kop-sub2 { font-size: 10.5pt; font-weight: 700; line-height: 1.1; }

  .kop-address { margin-top: 3px; font-size: 10pt; line-height: 1.2; }

  .divider {
    border-top: 4px solid #000;
    border-bottom: 1px solid #000;
    height: 0;
    margin: 8px 0 12px;
  }

  .doc-title { text-align: center; font-weight: 700; margin: 0; }
  .doc-subtitle { text-align: center; font-weight: 700; margin: 3px 0 10px; }

  .printed-at { margin: 2px 0 6px; font-size: 10.5pt; }

  table.print-table {
    width: 100% !important;
    border-collapse: collapse;
    margin-top: 6px;
    table-layout: fixed;
  }

  table.print-table th,
  table.print-table td {
    border: 1px solid #000;
    padding: 4px 4px;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  table.print-table th {
    text-align: center;
    font-weight: 700;
    background: #fff;
  }

  .c { text-align: center; }

  .ttd-wrap { margin-top: 18px; break-inside: avoid; }
  .ttd-right {
    width: 280px;
    margin-left: auto;
    transform: translateX(20mm);
  }

  .ttd-block { font-size: 12pt; }
  .ttd-spacer { height: 82px; }
  .ttd-name { margin-top: 6px; }

  @media print {
    thead { display: table-row-group !important; }
  }
`;

export const buildTtdHtml = (p: { signerName: string; signerNip: string }) => `
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

/* ============================================================
   PRINT WINDOW
============================================================ */

export const openPrintWindow = (html: string) => {
  const w = window.open("", "_blank", "width=950,height=700");
  if (!w) {
    alert("Popup diblokir browser. Izinkan popup untuk situs ini.");
    return null;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  return w;
};
