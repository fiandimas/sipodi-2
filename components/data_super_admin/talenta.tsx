"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, RotateCcw, Search, Check, ChevronsUpDown, User } from "lucide-react";
import type { UserRole } from "@/lib/types/role";
import { useRouter } from "next/navigation";

import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

import type { TalentaSuperAdmin } from "@/lib/types/talenta-super-admin";
import { exportTalentaSuperAdminToXLS } from "@/lib/export-talenta-super-admin-xls";
import { openPrintWindow, renderPrintHtml, printCtx, type SubmissionItem } from "@/lib/export-talenta-pdf";

import DetailTalentaSuperAdminModal, { type TalentaUpdatePayload } from "@/components/modals/detail-talenta-super-admin";
import { cn } from "@/lib/utils";

const PAGESIZE = 20;
const PAGEWINDOW = 5;
const COLSPAN = 9;

type ApiResponse = {
  data: TalentaSuperAdmin[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Option = {
  id: string;
  label: string;
};

type TagOption = {
  id: string;
  name: string;
};

type TagsApiResponse = {
  priority: TagOption[];
  others: Array<TagOption & { usedCount: number }>;
  free: Array<{ name: string; usedCount: number }>;
};
type ScoreSort = "default" | "score_desc" | "score_asc";

type UiStatus = "PENDING" | "TERVERIFIKASI" | "APPROVED" | "REJECTED" | "DINILAI";
type StatusFilter = "all" | UiStatus;

function uiStatusOf(t: TalentaSuperAdmin): UiStatus {
  if (t.status === "REJECTED") return "REJECTED";
  if (t.status === "PENDING") return "PENDING";

  if (t.reviewStatus) return t.reviewStatus as UiStatus;

  const scope = t.approvedScopeResolved ?? t.approvedScope ?? null;
  if (scope === "SEKOLAH" || scope === null) return "TERVERIFIKASI";
  if (scope === "TALENTA" || scope === "SUPER_ADMIN") return "APPROVED";
  return "PENDING";
}

function uiStatusBadgeClass(s: UiStatus) {
  if (s === "DINILAI") return "border-sky-600 text-sky-700";
  if (s === "TERVERIFIKASI") return "border-emerald-600 text-emerald-700";
  if (s === "REJECTED") return "border-red-600 text-red-700";
  return "border-amber-600 text-amber-700";
}

function uiStatusLabel(s: UiStatus) {
  if (s === "REJECTED") return "Ditinjau Ulang";
  if (s === "TERVERIFIKASI") return "Verifikasi";
  if (s === "DINILAI" || s === "APPROVED") return "Dinilai";
  return "Belum verifikasi";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getPageWindow(page: number, totalPages: number, windowSize = PAGEWINDOW) {
  if (totalPages <= windowSize) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const half = Math.floor(windowSize / 2);
  const start = clamp(page - half, 1, totalPages - windowSize + 1);
  const end = start + windowSize - 1;
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function mapTalentaToSubmissionItem(data: TalentaSuperAdmin[]): SubmissionItem[] {
  return data.map((t) => {
    const d0 = Array.isArray(t.detailTalenta) ? t.detailTalenta?.[0] : undefined;

    return {
      jenisTalenta: t.jenis ?? "-",
      fieldLabel: d0?.bidang ?? d0?.kategori ?? "-",
      activityName: d0?.namaKegiatan ?? "-",
      description: d0?.deskripsi ?? "-",
      subject: d0?.subKategori ?? "-",
      gtk: {
        name: t.gtk?.nama ?? "-",
        nik: t.gtk?.nik ?? "-",
        school: {
          name: t.gtk?.sekolah ?? "-",
          npsn: (t.gtk as any)?.npsn ?? "-",
        },
      },
    };
  });
}

function pushLainnyaToEndOption(arr: Option[]) {
  const idx = arr.findIndex((x) => x.label.trim().toLowerCase() === "lainnya");
  if (idx === -1) return arr;

  const copy = arr.slice();
  const [item] = copy.splice(idx, 1);
  copy.push(item);
  return copy;
}

export default function DataSuperAdminTalentaPage({ role, userName }: { role: UserRole; userName: string }) {
  const router = useRouter();
  // filters
  const [search, setSearch] = useState("");
  const [scoreQ, setScoreQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kategori, setKategori] = useState<string | "all">("all");
  const [jenisTalenta, setJenisTalenta] = useState<string | "all">("all");

  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const JENIS_TALENTA_ORDER: Record<string, number> = {
    "Peserta (Pelatihan / Workshop / Seminar / Upskilling)": 1,
    "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)": 2,
    "Pembimbing Lomba": 3,
    "Peserta Lomba": 4,
    "Minat / Bakat / Lainnya": 5,
  };  

  const [scoreSort, setScoreSort] = useState<ScoreSort | undefined>(undefined);

  // tags filter (multi)
  const [tagPriority, setTagPriority] = useState<TagOption[]>([]);
  const [tagOthers, setTagOthers] = useState<Array<TagOption & { usedCount: number }>>([]);
  const [tagFree, setTagFree] = useState<Array<{ name: string; usedCount: number }>>([]);

  const [juara, setJuara] = useState<"" | "Juara 1" | "Juara 2" | "Juara 3">("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagTexts, setTagTexts] = useState<string[]>([]);

  const [tagOpen, setTagOpen] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);

  // paging
  const [page, setPage] = useState(1);

  // options
  const [kategoriOptions, setKategoriOptions] = useState<Option[]>([]);
  const [jenisOptions, setJenisOptions] = useState<Option[]>([]);

  // data
  const [items, setItems] = useState<TalentaSuperAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // selection lintas page
  const [selectedIds, setSelectedIds] = useState<Record<string, true>>({});
  const [lockedJenis, setLockedJenis] = useState<string | null>(null);

  // TTD input modal
  const [ttdOpen, setTtdOpen] = useState(false);
  const [ttdName, setTtdName] = useState("");
  const [ttdNip, setTtdNip] = useState("");

  // untuk menyimpan action print yang tertunda sampai user submit
  const [pendingMode, setPendingMode] = useState<null | "all" | "selected">(null);
  const [printing, setPrinting] = useState(false);

  const [schoolOptions, setSchoolOptions] = useState<{ npsn: string; name: string }[]>([]);
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);

  function validateTtd() {
    const name = ttdName.trim();
    const nip = ttdNip.trim();
    if (!name) return { ok: false as const, error: "Nama penandatangan wajib diisi." };
    if (!nip) return { ok: false as const, error: "NIP wajib diisi." };
    return { ok: true as const, name, nip };
  }

  // modal detail
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedTalenta, setSelectedTalenta] = useState<TalentaSuperAdmin | null>(null);

  function toggleSelectRow(t: TalentaSuperAdmin) {
    const id = String(t.id);
    const jenis = t.jenis ?? "-";

    setSelectedIds((prev) => {
      const next = { ...prev };

      if (next[id]) {
        delete next[id];
        if (Object.keys(next).length === 0) setLockedJenis(null);
        return next;
      }

      if (lockedJenis && jenis !== lockedJenis) {
        alert(`Tidak bisa memilih jenis talenta berbeda. Terkunci pada: ${lockedJenis}`);
        return prev;
      }

      next[id] = true;
      if (!lockedJenis) setLockedJenis(jenis);
      return next;
    });
  }

  const selectedIdList = useMemo(() => Object.keys(selectedIds), [selectedIds]);
  const selectedCount = selectedIdList.length;

  async function handleClearSelected() {
    setSelectedIds({});
    setLockedJenis(null);
  }

  async function handlePrintSelectedWithSigner(signer: { name: string; nip: string }) {
    if (selectedCount === 0) {
      alert("Pilih minimal 1 data untuk dicetak.");
      return;
    }

    const res = await fetch("/api/super-admin/talenta/print-selected", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIdList }),
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      alert("Gagal memproses respon server untuk cetak dipilih.");
      return;
    }

    if (!res.ok || !json?.data) {
      alert(json?.error ?? "Gagal mengambil data untuk cetak dipilih.");
      return;
    }

    const data = json.data as TalentaSuperAdmin[];
    if (data.length === 0) {
      alert("Data pilihan tidak ditemukan (mungkin sudah terhapus).");
      return;
    }

    const jenisSet = new Set(data.map((t) => (t?.jenis ?? "-") as string));
    if (jenisSet.size > 1) {
      alert("Pilihan mengandung lebih dari 1 jenis talenta. Hapus pilihan jenis lain.");
      return;
    }

    const w = openPrintWindow();
    if (!w) return;

    const itemsForPrint = mapTalentaToSubmissionItem(data);
    const result = await renderPrintHtml(itemsForPrint, signer);
    if (!result.ok) {
      alert(result.error);
      return;
    }

    w.document.open();
    w.document.write(result.html);
    w.document.close();
  }

  async function handlePrintAllWithSigner(signer: { name: string; nip: string }) {
    if (loading) return;

    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (scoreQ) params.set("scoreQ", scoreQ);
    if (status !== "all") params.set("status", status);
    if (kategori !== "all") params.set("kategori", kategori);
    if (jenisTalenta !== "all") params.set("jenis", jenisTalenta);
    tagIds.forEach((id) => params.append("tagId", id));
    tagTexts.forEach((t) => params.append("tagText", t));
    if (juara) params.set("juara", juara);

    const res = await fetch(`/api/super-admin/talenta/export?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      alert("Gagal memproses respon server untuk cetak.");
      return;
    }

    if (!res.ok || !json?.data) {
      alert(json?.error ?? "Gagal mengambil data untuk cetak.");
      return;
    }

    const totalRows = json.data.length;
    if (totalRows === 0) {
      alert("Tidak ada data yang sesuai dengan filter untuk dicetak.");
      return;
    }

    const MAX_PREVIEW_ROWS = 200;
    if (totalRows > MAX_PREVIEW_ROWS) {
      const confirmExport =
        confirm(
          `Data terlalu banyak untuk preview (${totalRows} baris). ` +
          `Hanya ${MAX_PREVIEW_ROWS} baris pertama yang akan ditampilkan di preview.\n` +
          `Untuk semua data, gunakan Export XLS.`
        );
      if (!confirmExport) return;
      json.data = json.data.slice(0, MAX_PREVIEW_ROWS);
    }

    const w = openPrintWindow();
    if (!w) return;

    const itemsForPrint = mapTalentaToSubmissionItem(json.data as TalentaSuperAdmin[]);
    const result = await renderPrintHtml(itemsForPrint, signer);
    if (!result.ok) {
      alert(result.error);
      return;
    }

    w.document.open();
    w.document.write(result.html);
    w.document.close();
  }

  // load print context
  useEffect(() => {
    let cancelled = false;

    async function loadPrintCtx() {
      try {
        const res = await fetch("/api/super-admin/print-context", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        printCtx.gtk = data.gtk ? { name: data.gtk.name, schoolName: data.gtk.schoolName } : null;
        printCtx.letterhead = data.letterhead;
        printCtx.branchCity = data.branch?.city ?? data.branchCity ?? null;
      } catch {
        // silent
      }
    }

    loadPrintCtx();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  const loadOptions = async () => {
    const res = await fetch("/api/super-admin/talenta/option", {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return;

    const json = await res.json();

    const mappedKategori: Option[] = (json.kategori ?? []).map((k: string) => ({
      id: k,
      label: k,
    }));

    setKategoriOptions(pushLainnyaToEndOption(mappedKategori));

    const mappedJenis: Option[] = (json.jenis ?? []).map((j: string) => ({
      id: j,
      label: j,
    }));
    
    mappedJenis.sort((a, b) => {
      const ao = JENIS_TALENTA_ORDER[a.label] ?? 999;
      const bo = JENIS_TALENTA_ORDER[b.label] ?? 999;
      if (ao !== bo) return ao - bo;
      return a.label.localeCompare(b.label);
    });
    
    setJenisOptions(mappedJenis);    
  };

  const loadTagOptions = async () => {
    const res = await fetch("/api/super-admin/talenta/tags", {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return;

    const json = (await res.json()) as TagsApiResponse;
    setTagPriority(json.priority ?? []);
    setTagOthers(json.others ?? []);
    setTagFree(json.free ?? []);
  };

  // load school
  const loadSchoolOptions = async () => {
    try {
      const res = await fetch("/api/super-admin/school", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;

      const json = await res.json();
      if (!Array.isArray(json?.data)) return;

      const schools = json.data as { npsn: string; name: string }[];
      setSchoolOptions(schools)
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadOptions();
    loadTagOptions();
    loadSchoolOptions();
  }, []);

  // reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, scoreQ, status, kategori, jenisTalenta, tagIds, tagTexts, juara, scoreSort]);

  // load list
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setErrorMsg(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(PAGESIZE));

        if (debouncedSearch) params.set("q", debouncedSearch);
        if (scoreQ) params.set("scoreQ", scoreQ);
        if (status !== "all") params.set("status", status);
        if (kategori !== "all") params.set("kategori", kategori);
        if (jenisTalenta !== "all") params.set("jenis", jenisTalenta);

        tagIds.forEach((id) => params.append("tagId", id));
        tagTexts.forEach((t) => params.append("tagText", t));
        selectedSchools.forEach((s) => params.append("school", s));
        if (juara) params.set("juara", juara);

        const res = await fetch(`/api/super-admin/talenta?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
          credentials: "include",
        });

        const text = await res.text();
        let json: any = null;
        try {
          json = JSON.parse(text);
        } catch {
          setErrorMsg("Response API bukan JSON.");
          return;
        }

        if (!res.ok) {
          setErrorMsg(json?.error ?? "Gagal memuat data.");
          return;
        }

        const j = json as ApiResponse;

        setItems(j.data ?? []);
        setTotal(j.total ?? 0);
        setTotalPages(j.totalPages ?? 1);

        if ((j.totalPages ?? 1) > 0 && page > (j.totalPages ?? 1)) {
          setPage(j.totalPages ?? 1);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") setErrorMsg("Terjadi kesalahan jaringan.");
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [page, debouncedSearch, scoreQ, status, kategori, jenisTalenta, tagIds, tagTexts, juara, reloadKey, selectedSchools]);

  const paginationRange = useMemo(() => getPageWindow(page, totalPages, PAGEWINDOW), [page, totalPages]);

  function resetAll() {
    setSearch("");
    setDebouncedSearch("");
    setScoreQ("");
    setStatus("all");
    setKategori("all");
    setJenisTalenta("all");
    setPage(1);
    setJuara("");
    setTagIds([]);
    setTagTexts([]);
    setScoreSort(undefined);
    setSelectedSchools([]);
    setSelectedIds({});
    setLockedJenis(null);
  }

  async function handleExportXLSAll() {
    if (loading) return;

    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (scoreQ) params.set("scoreQ", scoreQ);
      if (status !== "all") params.set("status", status);
      if (kategori !== "all") params.set("kategori", kategori);
      if (jenisTalenta !== "all") params.set("jenis", jenisTalenta);
      tagIds.forEach((id) => params.append("tagId", id));
      tagTexts.forEach((t) => params.append("tagText", t));
      if (juara) params.set("juara", juara);

      const res = await fetch(`/api/super-admin/talenta/export?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        alert("Gagal memproses respon server untuk export.");
        return;
      }

      if (!res.ok || !json?.data) {
        alert(json?.error ?? "Gagal mengambil data untuk export.");
        return;
      }

      if (json.data.length === 0) {
        alert("Tidak ada data yang sesuai dengan filter untuk diekspor.");
        return;
      }

      exportTalentaSuperAdminToXLS(json.data as TalentaSuperAdmin[]);
    } catch (err: any) {
      alert("Terjadi kesalahan saat export talenta: " + (err?.message ?? err));
    }
  }

  function handleUpdatedFromModal(_payload: TalentaUpdatePayload) {
    setReloadKey((k) => k + 1);
  }

  const tagSelectedLabel = useMemo(() => {
    const names: string[] = [];

    if (juara) names.push(juara);

    if (tagIds.length) {
      const map = new Map<string, string>();
      tagOthers.forEach((t) => map.set(t.id, t.name));
      names.push(...tagIds.map((id) => map.get(id) ?? id));
    }

    if (tagTexts.length) names.push(...tagTexts);

    if (names.length === 0) return "Filter Tag";
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }, [juara, tagIds, tagTexts, tagOthers]);

  const tagSelectedSchools = useMemo(() => {
    const names: string[] = [];

    if (selectedSchools.length) {
      names.push(schoolOptions.filter((s) => selectedSchools.includes(s.npsn)).map((s) => s.name).join(", "));
    }

    if (names.length === 0) return "Filter UPT";
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }, [selectedSchools]);

  const sortedItems = useMemo(() => {
    if (!scoreSort || scoreSort === "default") return items;

    const arr = [...items];
    arr.sort((a, b) => {
      const av = Number(a.totalSkor ?? 0);
      const bv = Number(b.totalSkor ?? 0);
      return scoreSort === "score_desc" ? bv - av : av - bv;
    });

    return arr;
  }, [items, scoreSort]);

  return (
    <DashboardLayout role={role} userName={userName}>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Manajemen Talenta GTK</h1>
            <p className="text-sm text-muted-foreground">Verifikasi dan monitoring talenta oleh Super Admin.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportXLSAll} disabled={loading || total === 0} className="gap-2">
              <Download className="h-4 w-4" />
              Export XLS
            </Button>

            <Button
              variant="outline"
              disabled={loading || total === 0}
              onClick={() => {
                setPendingMode("all");
                setTtdName("");
                setTtdNip("");
                setTtdOpen(true);
              }}
            >
              Cetak PDF
            </Button>

            <Button
              variant="outline"
              disabled={selectedCount === 0}
              onClick={() => {
                setPendingMode("selected");
                setTtdName("");
                setTtdNip("");
                setTtdOpen(true);
              }}
            >
              Cetak PDF (Dipilih)
            </Button>

            <Button variant="outline" onClick={handleClearSelected} disabled={loading || selectedCount === 0}>
              Hapus pilihan
            </Button>

            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)} disabled={loading} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="py-4 flex flex-wrap gap-3 items-center">
            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                className="pl-10"
                placeholder="Cari GTK / Kegiatan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* <Select value={scoreSort} onValueChange={(v) => setScoreSort(v as ScoreSort)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Urutkan skor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="score_desc">Skor terbesar → terkecil</SelectItem>
                <SelectItem value="score_asc">Skor terkecil → terbesar</SelectItem>
              </SelectContent>
            </Select> */}

            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="TERVERIFIKASI">Verifikasi</SelectItem>
                <SelectItem value="DINILAI">Dinilai</SelectItem>
                <SelectItem value="REJECTED">Ditinjau Ulang</SelectItem>
              </SelectContent>
            </Select>

            <Select value={kategori} onValueChange={(v) => setKategori(v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {kategoriOptions.map((k, idx) => (
                  <SelectItem key={`${k.id}-${idx}`} value={k.id}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={jenisTalenta} onValueChange={(v) => setJenisTalenta(v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Semua Jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                {jenisOptions.map((j, idx) => (
                  <SelectItem key={`${j.id}-${idx}`} value={j.id}>
                    {j.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* TAG FILTER (Combobox + Search + Scroll + Separator) */}
            <Popover open={tagOpen} onOpenChange={setTagOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={tagOpen} className="w-64 justify-between font-normal">
                  <span className="truncate">{tagSelectedLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cari Tag..." />
                  <CommandList className="max-h-72 overflow-auto">
                    <CommandEmpty>Tag tidak ditemukan.</CommandEmpty>

                    <CommandGroup heading="Prioritas">
                      {tagPriority.map((t) => {
                        const checked = juara === t.name;
                        return (
                          <CommandItem
                            key={t.id}
                            onSelect={() => setJuara((prev) => (prev === t.name ? "" : (t.name as any)))}
                          >
                            <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{t.name}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>

                    <CommandSeparator />

                    <CommandGroup heading="Tag Lain">
                      {tagOthers.map((t) => {
                        const checked = tagIds.includes(t.id);
                        return (
                          <CommandItem
                            key={t.id}
                            onSelect={() => {
                              setTagIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(t.id)) next.delete(t.id);
                                else next.add(t.id);
                                return Array.from(next);
                              });
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{t.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{t.usedCount}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup heading="Tag Bebas">
                      {tagFree.map((t) => {
                        const checked = tagTexts.includes(t.name);
                        return (
                          <CommandItem
                            key={t.name}
                            value={t.name}
                            onSelect={() => {
                              setTagTexts((prev) => {
                                const next = new Set(prev);
                                if (next.has(t.name)) next.delete(t.name);
                                else next.add(t.name);
                                return Array.from(next);
                              });
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{t.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{t.usedCount}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>

                {(tagIds.length > 0 || tagTexts.length > 0 || juara) ? (
                  <div className="border-t p-2">
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setTagIds([]);
                        setTagTexts([]);
                        setJuara("");
                      }}
                    >
                      Hapus filter tag
                    </Button>
                  </div>
                ) : null}
              </PopoverContent>
            </Popover>

            <Popover open={schoolOpen} onOpenChange={setSchoolOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={schoolOpen} className="w-64 justify-between font-normal">
                  <span className="truncate">{tagSelectedSchools}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cari UPT..." />
                  <CommandList className="max-h-72 overflow-auto">
                    <CommandEmpty>UPT tidak ditemukan.</CommandEmpty>

                    <CommandGroup>
                      {schoolOptions.map((t) => {
                        const checked = selectedSchools.includes(t.npsn);
                        return (
                          <CommandItem
                            key={t.npsn}
                            value={t.name}
                            onSelect={() => {
                              setSelectedSchools((prev) => {
                                const next = new Set(prev);
                                if (next.has(t.npsn)) next.delete(t.npsn);
                                else next.add(t.npsn);
                                return Array.from(next);
                              });
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{t.name}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>

                {selectedSchools.length > 0 && (
                  <div className="border-t p-2">
                    <Button variant="ghost" className="w-full" onClick={() => setSelectedSchools([])}>
                      Hapus filter tag
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <Button variant="outline" onClick={resetAll} disabled={loading}>
              Reset filter
            </Button>
          </CardContent>
        </Card>

        {errorMsg ? (
          <Card>
            <CardContent className="py-3 text-sm text-rose-700">{errorMsg}</CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Daftar Talenta</CardTitle>
              <div className="text-sm text-muted-foreground">
                Menampilkan {items.length} data dari {total} hasil filter. Sorting:{" "}
                <span className="font-medium">CreatedAt (DESC)</span>.
              </div>
              {lockedJenis ? (
                <div className="text-xs text-muted-foreground">
                  Pilihan terkunci pada jenis: <span className="font-medium">{lockedJenis}</span>
                </div>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-center w-[60px]">Pilih</TableHead>
                  <TableHead>Potensi</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Nama GTK</TableHead>
                  <TableHead>Sekolah / UPT</TableHead>
                  <TableHead className="text-right">Talenta</TableHead>
                  <TableHead className="text-right">Skor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {items.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={COLSPAN} className="text-center py-10 text-muted-foreground">
                      Tidak ada data untuk filter/pencarian saat ini.
                    </TableCell>
                  </TableRow>
                ) : null}

                {loading ? (
                  <TableRow>
                    <TableCell colSpan={COLSPAN} className="text-center py-10 text-muted-foreground">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : null}

                {!loading
                  ? sortedItems.map((t) => {
                    const uiStatus = uiStatusOf(t);
                    const statusLabel = uiStatusLabel(uiStatus);

                    const jenis = t.jenis ?? "-";
                    const d0 = Array.isArray(t.detailTalenta) ? t.detailTalenta[0] : undefined;
                    const namaKegiatan = d0?.namaKegiatan ?? "-";
                    const tags = Array.isArray(d0?.tag) ? d0!.tag : [];
                    const shown = tags;
                    const more = Math.max(0, shown.length - 2);
                    const isChecked = !!selectedIds[String(t.id)];
                    const isLockedOut = lockedJenis ? jenis !== lockedJenis : false;

                    return (
                      <TableRow key={t.id} className="hover:bg-muted/40">
                        {/* Pilih (checkbox tetap) */}
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!isChecked && isLockedOut}
                            onChange={() => toggleSelectRow(t)}
                            title={!isChecked && isLockedOut ? `Terkunci: ${lockedJenis}` : ""}
                          />
                        </TableCell>

                        {/* Potensi */}
                        <TableCell>
                          <div className="text-xs text-muted-foreground leading-4">{jenis}</div>
                          <div className="text-sm font-semibold leading-5">{namaKegiatan}</div>
                        </TableCell>

                        {/* Tag */}
                        <TableCell>
                          {shown.length ? (
                            <div className="flex flex-wrap gap-2">
                              {shown.slice(0, 2).map((tg) => (
                                <Badge
                                  key={tg}
                                  variant="secondary"
                                  className="rounded-full px-2.5 py-0.5 text-xs max-w-[140px] truncate"
                                  title={tg}
                                >
                                  {tg}
                                </Badge>
                              ))}

                              {more > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="rounded-full px-2.5 py-0.5 text-xs text-muted-foreground"
                                  title={shown.join(", ")}
                                >
                                  +{more} lagi
                                </Badge>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Nama GTK */}
                        <TableCell>
                          <div className="font-medium">{t.gtk?.nama ?? "-"}</div>
                          <div className="text-xs text-muted-foreground">{t.gtk?.nik ?? "-"}</div>
                        </TableCell>

                        {/* Sekolah / UPT */}
                        <TableCell>
                          <div className="font-medium">{t.gtk?.sekolah ?? "-"}</div>
                        </TableCell>

                        {/* Talenta */}
                        <TableCell className="text-center tabular-nums">
                          {t.jumlahTalentaGtk ?? 0}
                        </TableCell>

                        {/* Skor */}
                        <TableCell className="text-center tabular-nums">
                          {t.totalSkor ?? 0}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold bg-transparent ${uiStatusBadgeClass(uiStatus)}`}
                          >
                            {statusLabel}
                          </Badge>
                        </TableCell>

                        {/* Action */}
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="border-primary text-primary"
                              onClick={() => {
                                setSelectedTalenta(t);
                                setOpenDetail(true);
                              }}
                              title="Detail"
                            >
                              <Eye className="h-4 w-4" strokeWidth={2.75} absoluteStrokeWidth />
                            </Button>

                            <Button
                              size="icon"
                              variant="outline"
                              className="border-emerald-600 text-emerald-600"
                              onClick={() => router.push(`/super-admin/data-talenta/${t.gtk?.nik}`)}
                              title="Detail"
                            >
                              <User className="h-4 w-4 text-emerald-600" strokeWidth={2.75} absoluteStrokeWidth />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                  : null}
              </TableBody>

              {totalPages > 1 ? (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={COLSPAN}>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} aria-disabled={page === 1} />
                          </PaginationItem>

                          {paginationRange[0] !== 1 ? (
                            <>
                              <PaginationItem>
                                <PaginationLink isActive={page === 1} onClick={() => setPage(1)}>
                                  1
                                </PaginationLink>
                              </PaginationItem>
                              {paginationRange[0] > 2 ? <span className="px-2 text-xs text-muted-foreground">...</span> : null}
                            </>
                          ) : null}

                          {paginationRange.map((p) => (
                            <PaginationItem key={p}>
                              <PaginationLink isActive={page === p} onClick={() => setPage(p)}>
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          ))}

                          {paginationRange[paginationRange.length - 1] !== totalPages ? (
                            <>
                              {paginationRange[paginationRange.length - 1] < totalPages - 1 ? (
                                <span className="px-2 text-xs text-muted-foreground">...</span>
                              ) : null}
                              <PaginationItem>
                                <PaginationLink isActive={page === totalPages} onClick={() => setPage(totalPages)}>
                                  {totalPages}
                                </PaginationLink>
                              </PaginationItem>
                            </>
                          ) : null}

                          <PaginationItem>
                            <PaginationNext onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-disabled={page === totalPages} />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </CardContent>
        </Card>

        <DetailTalentaSuperAdminModal
          open={openDetail}
          onOpenChange={setOpenDetail}
          talenta={selectedTalenta}
          onUpdated={handleUpdatedFromModal}
        />

        {ttdOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg bg-background p-4 shadow-lg">
              <div className="text-base font-semibold">Pengesahan / TTD</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Isi nama dan NIP sebelum mencetak.
              </div>

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
                  disabled={printing}
                  onClick={async () => {
                    if (printing) return;
                    const v = validateTtd();
                    if (!v.ok) return alert(v.error);
                    if (!pendingMode) return alert("Pilih mode cetak dulu (Cetak PDF atau Cetak Dipilih).");

                    setPrinting(true);
                    try {
                      if (pendingMode === "all") await handlePrintAllWithSigner({ name: v.name, nip: v.nip });
                      else await handlePrintSelectedWithSigner({ name: v.name, nip: v.nip });

                      setTtdOpen(false);
                      setPendingMode(null);
                      setTtdName("");
                      setTtdNip("");
                    } finally {
                      setPrinting(false);
                    }
                  }}
                >
                  Cetak
                </Button>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </DashboardLayout>
  );
}
