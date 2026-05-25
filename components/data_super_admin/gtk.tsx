"use client";

import { useEffect, useMemo, useState, useDeferredValue, useCallback } from "react";
import { Search, Plus, Edit, Trash2, Download, FileText } from "lucide-react";
import type { UserRole } from "@/lib/types/role";

import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import type { GTK } from "@/lib/types/gtk";
import { CreateGTKModal } from "@/components/modals/create-gtk-modal";
import { EditGTKModal } from "@/components/modals/edit-gtk-modal";
import { DeleteGTKModal } from "@/components/modals/delete-gtk-modal";

import { openPrintWindow, printCtx, renderGtkPrintHtml, type GtkPrintItem, type TtdInput } from "@/lib/print-utils";

const PAGE_SIZE = 20;

type GtkWithTalenta = GTK & { talentaCount: number; totalSkorDinilai: number };

type ApiResponse = {
  data: GtkWithTalenta[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function useDebounced<T>(value: T, delay: number): T {
  const deferred = useDeferredValue(value);
  const [debounced, setDebounced] = useState(deferred);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(deferred), delay);
    return () => clearTimeout(id);
  }, [deferred, delay]);

  return debounced;
}

type PaginationToken = { type: "page"; value: number } | { type: "ellipsis"; key: string };

function buildPagination(current: number, total: number): PaginationToken[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => ({ type: "page", value: i + 1 }));
  }

  const tokens: PaginationToken[] = [];
  const clamp = (n: number) => Math.max(1, Math.min(total, n));
  const currentPage = clamp(current);

  const first = 1;
  const last = total;

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(total - 1, currentPage + 1);

  tokens.push({ type: "page", value: first });

  if (start > 2) tokens.push({ type: "ellipsis", key: "left" });
  for (let p = start; p <= end; p++) tokens.push({ type: "page", value: p });
  if (end < total - 1) tokens.push({ type: "ellipsis", key: "right" });

  tokens.push({ type: "page", value: last });
  return tokens;
}

export default function DataGTKPage({
  role,
  userName,
}: {
  role: UserRole;
  userName: string;
}) {
  useEffect(() => {
    if (!printCtx.letterhead) {
      printCtx.letterhead = {
        title: "CABANG DINAS PENDIDIKAN WILAYAH MALANG\n(KOTA MALANG - KOTA BATU)",
        address: "Jalan Anjasmoro Nomor 40, Oro-oro Dowo, Kec. Klojen, Kota Malang, Jawa Timur 65119",
        phone: "(0341) 353155",
        email: "cabdinwilmalangbatu@gmail.com",
        logoPath: null,
      };
    }
    if (!printCtx.branchCity) {
      printCtx.branchCity = "Malang";
    }
  }, []);

  const [items, setItems] = useState<GtkWithTalenta[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [jenis, setJenis] = useState("all");
  const [sekolah, setSekolah] = useState("all");
  const [jenisKelamin, setJenisKelamin] = useState("all");

  const [activeSort, setActiveSort] = useState<"score" | "talenta">("score");

  const [scoreDir, setScoreDir] = useState<"desc" | "asc">("desc");
  const [talentaDir, setTalentaDir] = useState<"desc" | "asc">("desc");

  const [scoreDirUi, setScoreDirUi] = useState<"desc" | "asc" | undefined>(undefined);
  const [talentaDirUi, setTalentaDirUi] = useState<"desc" | "asc" | undefined>(undefined);

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [selected, setSelected] = useState<GTK | null>(null);

  const [allSekolah, setAllSekolah] = useState<Array<[string, string]>>([]);

  const [selectedNiks, setSelectedNiks] = useState<string[]>([]);
  const [ttdOpen, setTtdOpen] = useState(false);
  const [ttdName, setTtdName] = useState("");
  const [ttdNip, setTtdNip] = useState("");
  const [pendingMode, setPendingMode] = useState<null | "all" | "selected">(null);

  function validateTtd() {
    const name = ttdName.trim();
    const nip = ttdNip.trim();
    if (!name) return { ok: false as const, error: "Nama penandatangan wajib diisi." };
    if (!nip) return { ok: false as const, error: "NIP wajib diisi." };
    return { ok: true as const, name, nip };
  }

  const hasSelection = selectedNiks.length > 0;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeSort === "score") {
        params.set("sort", "score");
        params.set("dir", scoreDir);
      } else {
        params.set("sort", "talenta");
        params.set("dir", talentaDir);
      }
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));

      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (sekolah !== "all") params.set("schoolNpsn", sekolah);
      if (jenis !== "all") params.set("jenis", jenis);
      if (jenisKelamin !== "all") params.set("gender", jenisKelamin);

      const res = await fetch(`/api/super-admin/gtk?${params.toString()}`, {
        cache: "no-store",
      });

      const text = await res.text();
      let json: ApiResponse | { error?: string };
      try {
        json = JSON.parse(text);
      } catch {
        console.error("Non-JSON response:", text);
        return;
      }

      if (!res.ok) {
        console.error("API error GTK:", json);
        return;
      }

      const j = json as ApiResponse;
      const data = j.data ?? [];

      setItems(data);
      setTotal(j.total ?? data.length);
      setTotalPages(j.totalPages ?? 1);

      setAllSekolah((prev) => {
        const map = new Map<string, string>();
        prev.forEach(([npsn, name]) => map.set(npsn, name));
        data.forEach((g) => {
          if (g.school?.npsn) map.set(g.school.npsn, g.school.name ?? g.school.npsn);
        });
        return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sekolah, jenis, jenisKelamin, activeSort, scoreDir, talentaDir]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sekolah, jenis, jenisKelamin, activeSort, scoreDir, talentaDir]);

  const sekolahOptions = useMemo(() => allSekolah, [allSekolah]);
  const paginationItems = useMemo(() => buildPagination(page, totalPages || 1), [page, totalPages]);

  const toggleSelect = (nik: string) => {
    setSelectedNiks((prev) => (prev.includes(nik) ? prev.filter((x) => x !== nik) : [...prev, nik]));
  };

  const handleResetSelection = () => {
    setSelectedNiks([]);
  };

  async function handlePrintByFilterWithSigner(signer: TtdInput) {
    try {
      if (total === 0) return;

      const params = new URLSearchParams();
      if (activeSort === "score") {
        params.set("sort", "score");
        params.set("dir", scoreDir);
      } else {
        params.set("sort", "talenta");
        params.set("dir", talentaDir);
      }
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (sekolah !== "all") params.set("schoolNpsn", sekolah);
      if (jenis !== "all") params.set("jenis", jenis);

      if (jenisKelamin !== "all") params.set("gender", jenisKelamin);

      const res = await fetch(`/api/super-admin/gtk/print?${params.toString()}`, { cache: "no-store" });

      if (!res.ok) {
        console.error("Failed to get GTK by filter:", await res.text());
        return;
      }

      const json = await res.json();
      const data = json.data as Array<{
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
      }>;

      if (!data || data.length === 0) return;

      const first = data[0];
      printCtx.gtk = { name: first?.name ?? "", schoolName: first?.schoolName ?? "" };

      const itemsPrint: GtkPrintItem[] = data.map((g) => ({
        nik: g.nik,
        name: g.name,
        email: g.email,
        gender: g.gender,
        type: g.type,
        mapel: g.mapel,
        schoolName: g.schoolName,
        schoolNpsn: g.schoolNpsn,
        city: g.city,
        birthDate: g.birthDate,
      }));

      const { ok, html, error } = await renderGtkPrintHtml(itemsPrint, signer);
      if (!ok) {
        console.error(error);
        return;
      }

      const win = openPrintWindow();
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err) {
      console.error(err);
    }
  }

  async function handlePrintSelectedWithSigner(signer: TtdInput) {
    if (!hasSelection) return;

    try {
      const res = await fetch("/api/super-admin/gtk/print-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niks: selectedNiks }),
      });

      const text = await res.text();
      let json: {
        data?: Array<{
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
        }>;
        error?: string;
      };

      try {
        json = JSON.parse(text);
      } catch {
        console.error("Non-JSON response (print-selected GTK):", text);
        alert("Gagal memproses respon server untuk cetak terpilih.");
        return;
      }

      if (!res.ok || !json.data) {
        console.error("API error print-selected GTK:", json);
        alert(json.error || "Gagal mengambil data GTK terpilih.");
        return;
      }

      const data = json.data;
      if (!data.length) {
        alert("Tidak ada data GTK yang valid untuk dicetak.");
        return;
      }

      const first = data[0];
      printCtx.gtk = { name: first?.name ?? "", schoolName: first?.schoolName ?? "" };

      const itemsPrint: GtkPrintItem[] = data.map((g) => ({
        nik: g.nik,
        name: g.name,
        email: g.email,
        gender: g.gender,
        type: g.type,
        mapel: g.mapel,
        schoolName: g.schoolName,
        schoolNpsn: g.schoolNpsn,
        city: g.city,
        birthDate: g.birthDate,
      }));

      const { ok, html, error } = await renderGtkPrintHtml(itemsPrint, signer);
      if (!ok) {
        console.error(error);
        alert("Gagal merender dokumen cetak.");
        return;
      }

      const win = openPrintWindow();
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e) {
      console.error("Error print-selected GTK:", e);
      alert("Terjadi kesalahan saat cetak GTK terpilih.");
    }
  }

  const handleExportXLS = async () => {
    try {
      if (total === 0) return;

      const params = new URLSearchParams();
      if (activeSort === "score") {
        params.set("sort", "score");
        params.set("dir", scoreDir);
      } else {
        params.set("sort", "talenta");
        params.set("dir", talentaDir);
      }
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (sekolah !== "all") params.set("schoolNpsn", sekolah);
      if (jenis !== "all") params.set("jenis", jenis);
      if (jenisKelamin !== "all") params.set("gender", jenisKelamin);

      const res = await fetch(`/api/super-admin/gtk/export-xls?${params.toString()}`);
      if (!res.ok) {
        console.error("Failed to export XLS:", await res.text());
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GTK_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <DashboardLayout role={role} userName={userName}>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="space-y-3">
            {/* Baris 1: Judul */}
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Data GTK</h1>
              <p className="text-muted-foreground text-sm">Manajemen data Guru &amp; Tenaga Kependidikan.</p>

              <div className="flex flex-wrap items-center gap-2">
                {loading && (
                  <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">Memuat…</Badge>
                )}
              </div>
            </div>

            {/* Baris 2: Toolbar (kiri vs kanan) */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* KIRI: tombol-tombol lain */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportXLS}
                  disabled={loading || total === 0}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export XLS
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => { setPendingMode("all"); setTtdOpen(true); }}
                  disabled={loading || total === 0}
                  className="gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Cetak semua (filter)
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setPendingMode("selected"); setTtdOpen(true); }}
                  disabled={loading || !hasSelection}
                  className="gap-2"
                  title={hasSelection ? "Cetak semua GTK yang dipilih (lintas halaman/filter)" : "Pilih minimal 1 GTK"}
                >
                  <FileText className="w-4 h-4" />
                  Cetak yang dipilih
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetSelection}
                  disabled={!hasSelection}
                  className="gap-1"
                  title="Hapus semua pilihan"
                >
                  Reset pilihan
                </Button>
              </div>

              {/* KANAN: Tambah GTK (sendiri) */}
              <Button size="sm" onClick={() => setOpenCreate(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Tambah GTK
              </Button>
            </div>
          </div>
        </div>

        {/* FILTER */}
        <Card className="border-muted/40">
          <CardContent className="py-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama, NIK, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">

              <Select value={jenis} onValueChange={setJenis}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Jenis GTK" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jenis</SelectItem>
                  <SelectItem value="Guru">Guru</SelectItem>
                  <SelectItem value="Tendik">Tendik</SelectItem>
                  <SelectItem value="Kepala Sekolah">Kepala Sekolah</SelectItem>
                  <SelectItem value="Kepala Seksi">Kepala Seksi</SelectItem>
                  <SelectItem value="Kepala Cabang Dinas">Kepala Cabang Dinas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sekolah} onValueChange={setSekolah}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Semua sekolah" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Sekolah</SelectItem>
                  {sekolahOptions.map(([npsn, label]) => (
                    <SelectItem key={npsn} value={npsn}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={jenisKelamin} onValueChange={setJenisKelamin}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Semua Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Gender</SelectItem>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="P">P</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setJenis("all");
                  setSekolah("all");
                  setJenisKelamin("all");

                  setActiveSort("score");
                  setScoreDir("desc");
                  setTalentaDir("desc");

                  setScoreDirUi(undefined);
                  setTalentaDirUi(undefined);
                }}
              >
                Reset Filter
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Menampilkan data berdasarkan filter di atas.
            </p>
          </CardContent>
        </Card>

        {/* TABLE */}
        <Card className="border-muted/40">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">Daftar GTK</CardTitle>
              <CardDescription>
                {loading ? "Memuat data..." : `Menampilkan ${items.length} dari ${total} data.`}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {/* Sorting Skor */}
              <Select
                key={scoreDirUi ?? "placeholder-score"}
                value={scoreDirUi}
                onValueChange={(v) => {
                  const dir = v as "asc" | "desc";

                  if (activeSort !== "score") {
                    toast.message("Sorting diganti", {
                      description: "Sekarang yang aktif: Skor (Talenta dinonaktifkan).",
                    });
                  }

                  setScoreDirUi(dir);
                  setScoreDir(dir);
                  setActiveSort("score");
                  setTalentaDirUi(undefined);
                }}
              >
                <SelectTrigger className={activeSort === "score" ? "w-[210px]" : "w-[210px] opacity-70"}>
                  <SelectValue placeholder="Sorting Skor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Terbesar → Terkecil</SelectItem>
                  <SelectItem value="asc">Terkecil → Terbesar</SelectItem>
                </SelectContent>
              </Select>

              {/* Sorting Talenta */}
              <Select
                key={talentaDirUi ?? "placeholder-talenta"}
                value={talentaDirUi}
                onValueChange={(v) => {
                  const dir = v as "asc" | "desc";

                  if (activeSort !== "talenta") {
                    toast.message("Sorting diganti", {
                      description: "Sekarang yang aktif: Talenta (Skor dinonaktifkan).",
                    });
                  }

                  setTalentaDirUi(dir);
                  setTalentaDir(dir);
                  setActiveSort("talenta");
                  setScoreDirUi(undefined);
                }}
              >
                <SelectTrigger className={activeSort === "talenta" ? "w-[240px]" : "w-[240px] opacity-70"}>
                  <SelectValue placeholder="Sorting Talenta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Terbanyak → Tersedikit</SelectItem>
                  <SelectItem value="asc">Tersedikit → Terbanyak</SelectItem>
                </SelectContent>
              </Select>

              <Badge variant="outline" className="rounded-full">
                Dipilih: {selectedNiks.length}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40px] text-center">Pilih</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>NIP</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Sekolah / UPT</TableHead>
                  <TableHead>Skor</TableHead>
                  <TableHead>Talenta</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {!loading &&
                  items.map((item) => {
                    const checked = selectedNiks.includes(item.nik);
                    return (
                      <TableRow key={item.nik}>
                        <TableCell className="text-center align-middle">
                          <input
                            type="checkbox"
                            className={
                              "h-4 w-4 rounded border-2 " +
                              (checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted bg-background hover:ring-2 hover:ring-primary/40 cursor-pointer")
                            }
                            checked={checked}
                            onChange={() => toggleSelect(item.nik)}
                          />
                        </TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.nip ?? "-"}</TableCell>
                        <TableCell className="text-center">{item.gender ?? "-"}</TableCell>
                        <TableCell>{item.type ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{item.school?.name ?? "-"}</TableCell>
                        <TableCell className="text-center tabular-nums">
                          {(item.totalSkorDinilai ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {item.talentaCount ?? 0}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="border-primary text-primary"
                              onClick={() => {
                                setSelected(item);
                                setOpenEdit(true);
                              }}
                            >
                              <Edit className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="border-destructive text-destructive"
                              onClick={() => {
                                setSelected(item);
                                setOpenDelete(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                {!loading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      Tidak ada data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>

              {totalPages > 1 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setPage((p) => Math.max(1, p - 1))}
                              className={page === 1 ? "pointer-events-none opacity-50" : ""}
                            />
                          </PaginationItem>

                          {paginationItems.map((it) =>
                            it.type === "ellipsis" ? (
                              <PaginationItem key={it.key}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            ) : (
                              <PaginationItem key={it.value}>
                                <PaginationLink isActive={page === it.value} onClick={() => setPage(it.value)}>
                                  {it.value}
                                </PaginationLink>
                              </PaginationItem>
                            )
                          )}

                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
                              className={page === (totalPages || 1) ? "pointer-events-none opacity-50" : ""}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </CardContent>
        </Card>
      </div>

      <CreateGTKModal
        open={openCreate}
        onOpenChange={(o) => {
          setOpenCreate(o);
          if (!o) loadData();
        }}
        onCreated={loadData}
      />
      <EditGTKModal
        open={openEdit}
        onOpenChange={(o) => {
          setOpenEdit(o);
          if (!o) setSelected(null);
        }}
        gtk={selected}
        onUpdated={loadData}
      />
      <DeleteGTKModal
        open={openDelete}
        onOpenChange={(o) => {
          setOpenDelete(o);
          if (!o) setSelected(null);
        }}
        gtk={selected}
        onDeleted={loadData}
      />

      {ttdOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-4 shadow-lg">
            <div className="text-base font-semibold">Pengesahan / TTD</div>
            <div className="mt-1 text-sm text-muted-foreground">Isi nama dan NIP sebelum mencetak.</div>

            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <div className="text-sm">Nama</div>
                <Input value={ttdName} onChange={(e) => setTtdName(e.target.value)} placeholder="Nama penandatangan" />
              </div>

              <div className="space-y-1">
                <div className="text-sm">NIP</div>
                <Input value={ttdNip} onChange={(e) => setTtdNip(e.target.value)} placeholder="NIP" />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setTtdOpen(false);
                  setPendingMode(null);
                  setTtdName("");
                  setTtdNip("");
                }}
              >
                Batal
              </Button>

              <Button
                onClick={async () => {
                  const v = validateTtd();
                  if (!v.ok) return alert(v.error);
                  if (!pendingMode) return alert("Pilih mode cetak dulu.");

                  try {
                    if (pendingMode === "all") await handlePrintByFilterWithSigner({ name: v.name, nip: v.nip });
                    else await handlePrintSelectedWithSigner({ name: v.name, nip: v.nip });

                    setTtdOpen(false);
                    setPendingMode(null);
                    setTtdName("");
                    setTtdNip("");
                  } catch (e: any) {
                    alert(e?.message ?? "Gagal mencetak.");
                  }
                }}
              >
                Cetak
              </Button>
            </div>
          </div>
        </div>
      ) : null}

    </DashboardLayout>
  );
}
