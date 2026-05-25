"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type GtkMeResponse = {
  gtk: {
    nik: string;
    name: string;
    email: string | null;
    nuptk: string | null;
    nip: string | null;
    gender: "L" | "P" | null;
    birthDate: string | null;
    type: string | null;
    photoUrl: string | null;
    createdAt: string;
    updatedAt: string;

    school: {
      npsn: string;
      name: string;
      level: "SMA" | "SMK" | "SLB";
      status: "NEGERI" | "SWASTA";
      city: string;
      headName: string | null;
      branch: { id: string; name: string; city: string };
    };

    user: {
      id: string;
      username: string;
      role: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    } | null;
  } | null;
};

function formatDateID(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatBirthDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function esc(v: any) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function ProfileUserPage() {
  const [data, setData] = useState<GtkMeResponse["gtk"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const initials = useMemo(() => {
    const name = data?.name ?? "User";
    return (
      name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "U"
    );
  }, [data?.name]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/gtk/me");
        const json = (await res.json()) as GtkMeResponse;
        if (!res.ok) {
          alert("Gagal memuat profil");
          return;
        }
        setData(json.gtk);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  /* ===================== RENDER BIODATA PDF RESMI ===================== */
  const renderBiodataPdf = () => {
    if (!data) {
      return {
        ok: false as const,
        error: "Data profil belum dimuat",
        html: "",
      };
    }
  
    const genderLabel =
      data.gender === "L"
        ? "Laki-laki"
        : data.gender === "P"
        ? "Perempuan"
        : "-";
  
    const html = `<!DOCTYPE html>
  <html lang="id">
  <head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Biodata GTK</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { margin:0; padding:0; box-sizing:border-box; }
  
    body {
      font-family:"Times New Roman", Times, serif;
      font-size:11pt;
      color:#000;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
      line-height:1.2;
    }
  
    .page-wrapper {
      padding: 0 12mm;
    }
  
    .kop {
      text-align: center;
      border-bottom: 3px double #000;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
  
    /* Flexbox untuk menata logo dan teks secara horizontal */
    .kop-content {
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: left;
      width: 100%;
      position: relative;
    }
  
    /* Logo tetap berada di kiri */
    .kop-logo {
      position: absolute;
      left: 10mm;
      top: 50%;
      transform: translateY(-50%);
      width: 80px;
    }
  
    .kop-logo img {
      width: 100%;
      height: auto;
    }
  
    .kop-text {
      text-align: center;
      margin-left: 90px; /* Memberikan ruang antara logo dan teks */
    }
  
    .kop-title {
      font-size:18pt;
      font-weight:700;
      line-height:1.05;
    }
  
    .kop-sub1 {
      font-size:12pt;
      font-weight:700;
      line-height:1.1;
    }
  
    .kop-sub2 {
      font-size:10pt;
      font-weight:700;
      line-height:1.1;
    }
  
    .kop-address {
      font-size:10pt;
      line-height:1.2;
      margin-top:5px;
    }
  
    .divider {
      border-top:4px solid #000;
      border-bottom:1px solid #000;
      height:0;
      margin:8px 0 12px;
    }
  
    .doc-title {
      text-align:center;
      font-weight:700;
      font-size:12pt;
      margin: 10px 0 2px;
    }
  
    .doc-subtitle {
      text-align:center;
      font-size:10pt;
      margin-bottom: 10px;
    }
  
    table {
      width:100%;
      border-collapse:collapse;
    }
  
    td {
      border: 1px solid #000;
      padding: 6px 8px;
      vertical-align: top;
      font-size:10.5pt;
    }
  
    .footer-note {
      margin-top: 8px;
      margin-bottom: 8px;
      font-size: 9pt;
      text-align:center;
      color:#444;
    }
  </style>
  </head>
  <body>
    <div class="page-wrapper">
      <div class="kop">
        <div class="kop-content">
          <!-- Logo tetap di kiri -->
          <div class="kop-logo">
            <img src="${window.location.origin}/logo-dindik.png" alt="Logo" />
          </div>
          <!-- Teks terpusat di bagian tengah -->
          <div class="kop-text">
            <div class="kop-title">SIPODI - Sistem Informasi Potensi Diri</div>
            <div class="kop-sub1">CABANG DINAS PENDIDIKAN WILAYAH MALANG</div>
            <div class="kop-sub2">(KOTA MALANG - KOTA BATU)</div>
            <div class="kop-address">
              <div>Jalan Anjasmoro Nomor 40, Oro-oro Dowo, Kec. Klojen, Kota Malang, Jawa Timur 65119</div>
              <div>Telepon/Faksimile (0341) 353155, Pos-el: cabdinwilmalangbatu@gmail.com</div>
            </div>
          </div>
        </div>
      </div>
  
      <div class="doc-title">BIODATA GURU DAN TENAGA KEPENDIDIKAN</div>
      <div class="doc-subtitle">Formulir Data Individu</div>
  
      <table>
        <tr><td class="section" colspan="2">I. IDENTITAS PRIBADI</td></tr>
        <tr><td class="label">1. Nama Lengkap</td><td class="value">${esc(data.name ?? "-")}</td></tr>
        <tr><td class="label">2. NIK</td><td class="value">${esc(data.nik ?? "-")}</td></tr>
        <tr><td class="label">3. Email</td><td class="value">${esc(data.email ?? "-")}</td></tr>
        <tr><td class="label">4. Jenis Kelamin</td><td class="value">${esc(genderLabel)}</td></tr>
        <tr><td class="label">5. Tanggal Lahir</td><td class="value">${esc(formatDateID(data.birthDate ?? null))}</td></tr>
  
        <tr><td class="section" colspan="2">II. DATA KEPEGAWAIAN</td></tr>
        <tr><td class="label">1. NIP</td><td class="value">${esc(data.nip ?? "-")}</td></tr>
        <tr><td class="label">2. NUPTK</td><td class="value">${esc(data.nuptk ?? "-")}</td></tr>
        <tr><td class="label">3. Jabatan</td><td class="value">${esc(data.type ?? "-")}</td></tr>
  
        <tr><td class="section" colspan="2">III. DATA SEKOLAH</td></tr>
        <tr><td class="label">1. Nama Sekolah</td><td class="value">${esc(data.school?.name ?? "-")}</td></tr>
        <tr><td class="label">2. NPSN</td><td class="value">${esc(data.school?.npsn ?? "-")}</td></tr>
        <tr><td class="label">3. Jenjang / Status</td><td class="value">${esc(data.school?.level ?? "-")} (${esc(data.school?.status ?? "-")})</td></tr>
        <tr><td class="label">4. Kota/Kabupaten</td><td class="value">${esc(data.school?.city ?? "-")}</td></tr>
        <tr><td class="label">5. Kepala Sekolah</td><td class="value">${esc(data.school?.headName ?? "-")}</td></tr>
        <tr><td class="label">6. Cabang Dinas Pendidikan</td><td class="value">Cabang Dinas Wilayah Malang</td></tr>
      </table>
  
      <div class="footer-note">Dokumen ini dicetak melalui Sistem SIPODI.</div>
    </div>
  </body>
  </html>`;
  
    return { ok: true as const, html, error: "" };
  };  
  
  const downloadBiodataPdf = async () => {
    const result = renderBiodataPdf();
    if (!result.ok) {
      alert(result.error);
      return;
    }

    try {
      setGeneratingPdf(true);

      // Import html2pdf secara dinamis
      const html2pdf = (await import("html2pdf.js")).default;

      // Buat temporary container
      const element = document.createElement("div");
      element.innerHTML = result.html;

      // Setup html2pdf options
      const options = {
        margin: 0,
        filename: `Biodata-${data?.name?.replace(/\s+/g, "-")}-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 1, useCORS: true, allowTaint: true, scrollY: 0 },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] as const },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      } as const;

      // Generate dan download PDF
      await html2pdf().set(options).from(element).save();
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Gagal membuat PDF biodata");
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <DashboardLayout
      role="user"
      userName={data?.name ?? "-"}
      userPhotoUrl={data?.photoUrl ?? "/avatar.png"}
    >
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
            <p className="text-muted-foreground">Data akun GTK.</p>
          </div>
          <Button
            onClick={downloadBiodataPdf}
            disabled={!data || generatingPdf}
          >
            <Download className="w-4 h-4 mr-2" />
            {generatingPdf ? "Proses..." : "Download Biodata PDF"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identitas</CardTitle>
            <CardDescription>Informasi dasar GTK.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={data?.photoUrl ?? "/avatar.png"} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="font-medium">
                {data?.name ?? (loading ? "Memuat..." : "-")}
              </div>
              <div className="text-sm text-muted-foreground">
                NIK: {data?.nik ?? "-"}
              </div>
              <div className="text-sm text-muted-foreground">
                Email: {data?.email ?? "-"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data kepegawaian</CardTitle>
            <CardDescription>NUPTK, NIP, jenis, dll.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">NUPTK:</span>{" "}
              {data?.nuptk ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">NIP:</span>{" "}
              {data?.nip ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Gender:</span>{" "}
              {data?.gender ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Tgl lahir:</span>{" "}
              {formatDateID(data?.birthDate ?? null)}
            </div>
            <div>
              <span className="text-muted-foreground">Jenis:</span>{" "}
              {data?.type ?? "-"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sekolah</CardTitle>
            <CardDescription>Scope sekolah & cabdin.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">NPSN:</span>{" "}
              {data?.school?.npsn ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Sekolah:</span>{" "}
              {data?.school?.name ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Level:</span>{" "}
              {data?.school?.level ? (
                <Badge variant="secondary">{data.school.level}</Badge>
              ) : (
                "-"
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              {data?.school?.status ? (
                <Badge variant="secondary">{data.school.status}</Badge>
              ) : (
                "-"
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Kota:</span>{" "}
              {data?.school?.city ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Kepala sekolah:</span>{" "}
              {data?.school?.headName ?? "-"}
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Cabdin:</span>{" "}
              {data?.school?.branch?.name ?? "-"} (
              {data?.school?.branch?.city ?? "-"})
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Akun</CardTitle>
            <CardDescription>Informasi akun login.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Username:</span>{" "}
              {data?.user?.username ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Role:</span>{" "}
              {data?.user?.role ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              {data?.user ? (
                data.user.isActive ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">
                    ACTIVE
                  </Badge>
                ) : (
                  <Badge variant="destructive">INACTIVE</Badge>
                )
              ) : (
                "-"
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{" "}
              {formatDateID(data?.user?.createdAt ?? null)}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
