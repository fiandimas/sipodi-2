"use client";

import {
  printCtx,
  TtdInput,
  esc,
  fmtPrintedAt,
  loadImageAsBase64,
  buildBaseCss,
  buildTtdHtml
} from "@/lib/print-utils-core";

let letterheadPromise: Promise<{ ok: true } | { ok: false; error: string }> | null = null;

async function ensureLetterheadLoadedAdminSchool(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (printCtx.letterhead) return { ok: true };
  if (letterheadPromise) return letterheadPromise;

  letterheadPromise = (async () => {
    try {
      const res = await fetch("/api/admin-sekolah/branch-letterhead", {
        cache: "no-store",
        credentials: "include",
      });

      const text = await res.text();

      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        return { ok: false as const, error: "Respon server kop tidak valid (bukan JSON)." };
      }

      if (!res.ok || !json?.data) {
        return {
          ok: false as const,
          error: json?.error ?? "Gagal mengambil kop cabang dari server.",
        };
      }

      printCtx.letterhead = json.data.letterhead;
      printCtx.branchCity = json.data.branchCity ?? null;

      return { ok: true };
    } catch (e) {
      return { ok: false as const, error: "Gagal mengambil kop cabang (network/server error)." };
    } finally {
      letterheadPromise = null;
    }
  })();

  return letterheadPromise;
}

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

export const renderAdminSchoolGtkPdfHtml = async (
  items: GtkPrintItem[],
  signer: TtdInput
) => {
  const loaded = await ensureLetterheadLoadedAdminSchool();
  if (!loaded.ok) {
    return { ok: false as const, error: loaded.error, html: "" };
  }

  const ctx = printCtx;
  const L = ctx.letterhead;
  if (!L) {
    return {
      ok: false as const,
      error: "Kop cabang belum diset. Isi data BranchLetterhead terlebih dulu.",
      html: "",
    };
  }

  const logoBase64 = await loadImageAsBase64(L.logoPath ?? "/logo-dindik.png");
  const printedAt = fmtPrintedAt();

  /* ========== KONSTRUKSI ADDRESS IDENTIK ========== */
  const addressLine1 = esc(L.address ?? "");

  let addressLine2 = "";
  if (L.phone) addressLine2 += `Telepon/Faksimile ${L.phone}`;
  if (L.email)
    addressLine2 += `${addressLine2 ? ", " : ""}Pos-el: ${L.email}`;
  addressLine2 = addressLine2.replace(/\s+/g, " ").trim();
  const addressLine2Esc = esc(addressLine2);

  /* ========== ROWS ========== */
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

  /* ============================================================
     HTML FINAL (100% Copy Engine Super Admin)
     ============================================================ */
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>Daftar GTK</title>
<style>
  ${buildBaseCss({ size: "A4", margin: "12mm 18mm 18mm 18mm" }, "12pt")}
  table.print-table th, table.print-table td { font-size: 10.5pt; }
</style>
</head>

<body>
<div class="page">

  <!-- KOP: 100% IDENTIK -->
  <div class="kop">
    <table class="kop-table">
      <tr>
        <td class="kop-logo">
          ${logoBase64 ? `<img src="${logoBase64}" />` : ""}
        </td>
        <td class="kop-text">
          <div class="kop-title">SIPODI - Sistem Informasi Potensi Diri</div>
          <div class="kop-sub1">CABANG DINAS PENDIDIKAN WILAYAH MALANG</div>
          <div class="kop-sub2">(KOTA MALANG - KOTA BATU)</div>
          <div class="kop-address">
            <div>${addressLine1}</div>
            <div>${addressLine2Esc}</div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <div class="divider"></div>

  <div class="doc-title">DAFTAR GURU DAN TENAGA KEPENDIDIKAN</div>
  <div class="doc-subtitle">
    Cabang Dinas Pendidikan Wilayah Malang <br> (Kota Malang - Kota Batu)
  </div>

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

  ${buildTtdHtml({ signerName: signer.name, signerNip: signer.nip })}

</div>

<script>
window.onload = () => { window.focus(); window.print(); };
window.onafterprint = () => window.close();
</script>

</body>
</html>`;

  return { ok: true as const, html, error: "" };
};


/* ============================================================
   OPEN PRINT WINDOW (IDENTIK)
   ============================================================ */
export function openPrintWindowAdminSchool(html: string) {
  const w = window.open("", "_blank", "width=950,height=700");
  if (!w) {
    alert("Popup diblokir browser.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
