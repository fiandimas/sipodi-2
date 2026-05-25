"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Search, Plus, Edit, Trash2, Download, FileText } from "lucide-react";
import type { UserRole } from "@/lib/types/role";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import DashboardLayout from "@/components/dashboard-layout";
import { exportSekolahToXLS } from "@/lib/export-sekolah-xls";
import { openPrintWindow, printCtx, renderSchoolPrintHtml, type SchoolPrintItem } from "@/lib/print-utils";

import { CreateSekolahModal } from "@/components/modals/create-sekolah-modal";
import EditSekolahModal from "@/components/modals/edit-sekolah-modal";
import { DeleteSekolahModal } from "@/components/modals/delete-sekolah-modal";

import type { Sekolah, JenjangSekolah, StatusSekolah } from "@/lib/types/sekolah";

const PAGE_SIZE = 20;

const formatNumber = (value: number | null | undefined) =>
  value == null ? "-" : new Intl.NumberFormat("id-ID").format(value);

const formatRate = (value: number | null | undefined) =>
  value == null
    ? "-"
    : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);

type ApiSchool = {
  npsn: string;
  name: string;
  level: "SMA" | "SMK" | "SLB";
  status: "NEGERI" | "SWASTA";
  city: string;
  headName: string | null;
  headNip?: string | null;
  headRank?: string | null;
  branchId?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { gtks: number };

  totalTalentaDinilai?: number;
  rate?: number;
};

type ApiListResponse = {
  data: ApiSchool[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function DataSekolahPage({
  role,
  userName,
}: {
  role: UserRole;
  userName: string;
}) {
  // FILTER STATE
  const [search, setSearch] = useState("");
  const [jenjang, setJenjang] = useState<"all" | "SMA" | "SMK" | "SLB">("all");
  const [status, setStatus] = useState<"all" | "NEGERI" | "SWASTA">("all");
  const [kota, setKota] = useState<string>("all");

  const [rateDir, setRateDir] = useState<"desc" | "asc">("desc");

  const [rateDirUi, setRateDirUi] = useState<"desc" | "asc" | undefined>(undefined);

  const [allCities, setAllCities] = useState<string[]>([]);

  const [page, setPage] = useState(1);

  // DATA STATE
  const [items, setItems] = useState<ApiSchool[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // MODAL STATE
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [selected, setSelected] = useState<ApiSchool | null>(null);

  // SELECTION STATE
  const [selectedNpsns, setSelectedNpsns] = useState<string[]>([]);
  const hasSelection = selectedNpsns.length > 0;

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

  // RESET PAGE saat filter berubah
  useEffect(() => {
    setPage(1);
  }, [search, jenjang, status, kota, rateDir]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("sort", "rate");
      params.set("dir", rateDir);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (search.trim()) params.set("q", search.trim());
      if (jenjang !== "all") params.set("level", jenjang);
      if (status !== "all") params.set("status", status);
      if (kota !== "all") params.set("city", kota);

      const res = await fetch(`/api/super-admin/school-management?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const text = await res.text();
      let json: ApiListResponse | { error?: string };
      try {
        json = JSON.parse(text);
      } catch {
        console.error("Non-JSON response:", text);
        return;
      }

      if (!res.ok) {
        console.error("Error load sekolah:", json);
        return;
      }

      const data = json as ApiListResponse;
      const rows = data.data ?? [];
      setItems(rows);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);

      // ✅ update allCities dari data yang tampil
      const setCity = new Set<string>();
      rows.forEach((r) => {
        if (r.city) setCity.add(r.city);
      });
      setAllCities((prev) => {
        // gabung biar tidak “hilang” saat pindah page
        const merged = new Set<string>([...prev, ...Array.from(setCity)]);
        return Array.from(merged).sort();
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, jenjang, status, kota, rateDir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sekolahForExportCurrentPage: Sekolah[] = useMemo(
    () =>
      items.map(
        (s): Sekolah => ({
          id: s.npsn,
          namaSekolah: s.name,
          npsn: s.npsn,
          jenjang: s.level as JenjangSekolah,
          status: (s.status === "NEGERI" ? "Negeri" : "Swasta") as StatusSekolah,
          kota: s.city,
          kepalaSekolah: s.headName ?? "-",
          jumlahSiswa: 0,
          jumlahGtk: s._count.gtks,
          rate: s.rate ?? 0,
        })
      ),
    [items]
  );

  const toggleSelect = (npsn: string) => {
    setSelectedNpsns((prev) => (prev.includes(npsn) ? prev.filter((x) => x !== npsn) : [...prev, npsn]));
  };

  const handleResetSelection = () => {
    setSelectedNpsns([]);
  };

  async function handlePrintSekolahByFilterWithSigner(signer: { name: string; nip: string }) {
    try {
      if (items.length === 0) return;

      const params = new URLSearchParams();
      params.set("sort", "rate");
      params.set("dir", rateDir);
      if (search.trim()) params.set("q", search.trim());
      if (jenjang !== "all") params.set("level", jenjang);
      if (status !== "all") params.set("status", status);
      if (kota !== "all") params.set("city", kota);

      const res = await fetch(`/api/super-admin/school-management/print?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("Failed to get schools by filter:", await res.text());
        return;
      }

      const json = await res.json();
      const data = json.data as SchoolPrintItem[];

      const { ok, html, error } = await renderSchoolPrintHtml(data ?? [], signer);
      if (!ok) {
        console.error(error);
        return;
      }

      const win = openPrintWindow();
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleExportSekolahByFilter() {
    try {
      if (total === 0) {
        alert("Tidak ada data untuk diexport.");
        return;
      }

      const params = new URLSearchParams();
      params.set("sort", "rate");
      params.set("dir", rateDir);
      params.set("page", "1");
      params.set("pageSize", String(total));
      if (search.trim()) params.set("q", search.trim());
      if (jenjang !== "all") params.set("level", jenjang);
      if (status !== "all") params.set("status", status);
      if (kota !== "all") params.set("city", kota);

      const res = await fetch(`/api/super-admin/school-management?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("Gagal load data sekolah untuk export:", await res.text());
        alert("Gagal mengambil data sekolah untuk export.");
        return;
      }

      const json = (await res.json()) as ApiListResponse;
      const allItems = json.data ?? [];
      if (allItems.length === 0) {
        alert("Tidak ada data sekolah untuk export.");
        return;
      }

      const sekolahForExport: Sekolah[] = allItems.map(
        (s): Sekolah => ({
          id: s.npsn,
          namaSekolah: s.name,
          npsn: s.npsn,
          jenjang: s.level as JenjangSekolah,
          status: (s.status === "NEGERI" ? "Negeri" : "Swasta") as StatusSekolah,
          kota: s.city,
          kepalaSekolah: s.headName ?? "-",
          jumlahSiswa: 0,
          jumlahGtk: s._count.gtks,
          rate: s.rate ?? 0,
        })
      );

      exportSekolahToXLS(sekolahForExport);
    } catch (e) {
      console.error("Error export sekolah by filter:", e);
      alert("Terjadi kesalahan saat export data sekolah.");
    }
  }

  async function handlePrintSelectedSchoolsWithSigner(signer: { name: string; nip: string }) {
    if (!hasSelection) return;

    try {
      const res = await fetch("/api/super-admin/school-management/print-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ npsns: selectedNpsns }),
      });

      const text = await res.text();
      let json: { data?: SchoolPrintItem[]; error?: string };

      try {
        json = JSON.parse(text);
      } catch {
        console.error("Non-JSON response (print-selected sekolah):", text);
        alert("Gagal memproses respon server untuk cetak terpilih.");
        return;
      }

      if (!res.ok || !json.data) {
        console.error("API error print-selected sekolah:", json);
        alert(json.error || "Gagal mengambil data sekolah terpilih.");
        return;
      }

      const data = json.data;
      if (!data.length) {
        alert("Tidak ada data sekolah yang valid untuk dicetak.");
        return;
      }

      const { ok, html, error } = await renderSchoolPrintHtml(data, signer);
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
      console.error("Error print-selected sekolah:", e);
      alert("Terjadi kesalahan saat cetak sekolah terpilih.");
    }
  }

  const handleReloadAfterMutation = () => {
    fetchData();
  };

  const pageNumbers = useMemo(() => {
    const windowSize = 5;
    if (totalPages <= windowSize) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const half = Math.floor(windowSize / 2);
    let start = Math.max(1, page - half);
    let end = start + windowSize - 1;
    if (end > totalPages) {
      end = totalPages;
      start = end - windowSize + 1;
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <DashboardLayout role={role} userName={userName}>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* HEADER */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Data Sekolah</h1>
            <p className="text-muted-foreground mt-1">Manajemen data sekolah.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {loading && (
                <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">Memuat…</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={total === 0}
              onClick={handleExportSekolahByFilter}
            >
              <Download className="w-4 h-4" />
              Export XLS (Filter)
            </Button>

            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={total === 0}
              onClick={() => {
                setPendingMode("all");
                setTtdOpen(true);
              }}
            >
              <FileText className="w-4 h-4" />
              Cetak semua (filter)
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!hasSelection}
              onClick={() => {
                setPendingMode("selected");
                setTtdOpen(true);
              }}
              title={
                hasSelection ? "Cetak semua sekolah yang dipilih (lintas halaman/filter)" : "Pilih minimal 1 sekolah"
              }
            >
              <FileText className="w-4 h-4" />
              Cetak yang dipilih
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={!hasSelection}
              onClick={handleResetSelection}
              title="Hapus semua pilihan"
            >
              Reset pilihan
            </Button>

            <Button
              size="sm"
              className="gap-2 bg-primary text-primary-foreground"
              onClick={() => setOpenCreate(true)}
            >
              <Plus className="w-4 h-4" />
              Tambah Sekolah
            </Button>
          </div>
        </div>

        {/* FILTER */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama sekolah, NPSN, Kota..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={jenjang} onValueChange={(v) => setJenjang(v as typeof jenjang)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Jenjang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jenjang</SelectItem>
                  <SelectItem value="SMA">SMA</SelectItem>
                  <SelectItem value="SMK">SMK</SelectItem>
                  <SelectItem value="SLB">SLB</SelectItem>
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="NEGERI">Negeri</SelectItem>
                  <SelectItem value="SWASTA">Swasta</SelectItem>
                </SelectContent>
              </Select>

              <Select value={kota} onValueChange={setKota}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Kota" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kota</SelectItem>
                  {allCities.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setJenjang("all");
                  setStatus("all");
                  setKota("all");
                  setRateDir("desc");
                  setRateDirUi(undefined);
                }}
              >
                Reset
              </Button>
            </div>

            {(search || jenjang !== "all" || status !== "all" || kota !== "all") && (
              <div className="flex flex-wrap gap-2">
                {search && <Badge variant="secondary">Pencarian: {search}</Badge>}
                {jenjang !== "all" && (
                  <Badge
                    variant="outline"
                    className="border-primary text-primary cursor-pointer"
                    onClick={() => setJenjang("all")}
                  >
                    Jenjang: {jenjang} ✕
                  </Badge>
                )}
                {status !== "all" && (
                  <Badge
                    variant="outline"
                    className="border-primary text-primary cursor-pointer"
                    onClick={() => setStatus("all")}
                  >
                    Status: {status === "NEGERI" ? "Negeri" : "Swasta"} ✕
                  </Badge>
                )}
                {kota !== "all" && (
                  <Badge
                    variant="outline"
                    className="border-primary text-primary cursor-pointer"
                    onClick={() => setKota("all")}
                  >
                    Kota: {kota} ✕
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* TABLE */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Daftar Sekolah</CardTitle>
              <CardDescription>Menampilkan {items.length} dari {total} sekolah</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Select
                key={rateDirUi ?? "placeholder"}
                value={rateDirUi}
                onValueChange={(v) => {
                  const dir = v as "asc" | "desc";
                  setRateDirUi(dir);
                  setRateDir(dir);
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Sorting Rate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Terbesar → Terkecil</SelectItem>
                  <SelectItem value="asc">Terkecil → Terbesar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40px] text-center">Pilih</TableHead>
                  <TableHead>Nama UPT</TableHead>
                  <TableHead>NPSN</TableHead>
                  <TableHead>Jenjang</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kota</TableHead>
                  <TableHead>Kepala UPT</TableHead>
                  <TableHead className="text-right">GTK</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="w-20 text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                )}

                {!loading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                      Tidak ada data sekolah untuk filter/pencarian saat ini.
                    </TableCell>
                  </TableRow>
                )}

                {!loading &&
                  items.map((item) => {
                    const checked = selectedNpsns.includes(item.npsn);
                    return (
                      <TableRow key={item.npsn}>
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
                            onChange={() => toggleSelect(item.npsn)}
                          />
                        </TableCell>

                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="font-mono text-sm">{item.npsn}</TableCell>
                        <TableCell>{item.level}</TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              item.status === "NEGERI"
                                ? "border-primary text-primary"
                                : "border-orange-500 text-orange-600"
                            }
                          >
                            {item.status === "NEGERI" ? "Negeri" : "Swasta"}
                          </Badge>
                        </TableCell>

                        <TableCell>{item.city}</TableCell>
                        <TableCell>{item.headName ?? "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(item._count.gtks)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {formatRate(item.rate ?? 0)}
                          <div className="text-xs font-normal text-muted-foreground">
                            {(item.totalTalentaDinilai ?? 0)}/{item._count.gtks}
                          </div>
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
              </TableBody>

              {totalPages > 1 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={10}>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} />
                          </PaginationItem>

                          {pageNumbers.map((p) => (
                            <PaginationItem key={p}>
                              <PaginationLink isActive={page === p} onClick={() => setPage(p)}>
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          ))}

                          <PaginationItem>
                            <PaginationNext onClick={() => setPage((p) => Math.min(totalPages, p + 1))} />
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

      {/* MODALS */}
      <CreateSekolahModal open={openCreate} onOpenChange={setOpenCreate} onSuccess={handleReloadAfterMutation} />

      <EditSekolahModal
        open={openEdit}
        onOpenChange={setOpenEdit}
        sekolah={
          selected
            ? {
              npsn: selected.npsn,
              name: selected.name,
              level: selected.level,
              status: selected.status,
              city: selected.city,
              headName: selected.headName,
            }
            : null
        }
        onSuccess={handleReloadAfterMutation}
      />

      <DeleteSekolahModal
        open={openDelete}
        onOpenChange={setOpenDelete}
        npsn={selected?.npsn ?? null}
        namaSekolah={selected?.name}
        onSuccess={handleReloadAfterMutation}
      />

      {ttdOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-4 shadow-lg">
            <div className="text-base font-semibold">Pengesahan / TTD</div>
            <div className="mt-1 text-sm text-muted-foreground">Isi nama dan NIP sebelum mencetak.</div>

            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <div className="text-sm">Nama</div>
                <Input
                  value={ttdName}
                  onChange={(e) => setTtdName(e.target.value)}
                  placeholder="Nama penandatangan"
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm">NIP</div>
                <Input
                  value={ttdNip}
                  onChange={(e) => setTtdNip(e.target.value)}
                  placeholder="NIP"
                />
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
                    if (pendingMode === "all") {
                      await handlePrintSekolahByFilterWithSigner({ name: v.name, nip: v.nip });
                    } else {
                      await handlePrintSelectedSchoolsWithSigner({ name: v.name, nip: v.nip });
                    }

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
