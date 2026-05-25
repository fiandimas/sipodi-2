"use client";

import type { UserRole } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
import { Search, Download, Eye, FileText, RotateCcw, PrinterIcon, Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

import type { TalentaAdmin } from "@/lib/types/talenta-admin";
import { exportTalentaToXLS } from "@/lib/export-talenta-xls";
import { openPrintWindow, renderPrintHtml, printCtx, type SubmissionItem, type TtdInput } from "@/lib/export-talenta-pdf";

import DetailTalentaModal from "@/components/modals/detail-talenta";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const PAGE_WINDOW = 5;

const LS_KEY_PREFIX = "admin-talenta:selectedIds:";

type Props = {
  role: UserRole;
  fieldId: string;
  initialPage: number;
};

type ApiResponse = {
  data: TalentaAdmin[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort?: string;
  dir?: string;
};

type TalentaUpdatePayload = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

type ScoreSort = "default" | "score_desc" | "score_asc";

type UiStatus = "PENDING" | "TERVERIFIKASI" | "APPROVED" | "REJECTED" | "DINILAI";
type StatusFilterUI = "all" | UiStatus;

// TAG FILTER types (sama pola super admin)
type TagOption = {
  id: string;
  name: string;
};

type TagsApiResponse = {
  priority: TagOption[];
  others: Array<TagOption & { usedCount: number }>;
  free: Array<{ name: string; usedCount: number }>;
};

function getUiStatus(item: TalentaAdmin): UiStatus {
  if (item.reviewStatus) {
    return item.reviewStatus as UiStatus;
  }

  if (item.status === "REJECTED") return "REJECTED";
  if (item.status === "PENDING") return "PENDING";

  const scope = item.approvedScopeResolved ?? item.approvedScope ?? null;
  if (scope === "SEKOLAH" || scope === null) return "TERVERIFIKASI";
  return "APPROVED";
}

function statusBadgeClass(status: UiStatus) {
  if (status === "DINILAI") return "border-sky-600 text-sky-700";
  if (status === "TERVERIFIKASI") return "border-emerald-600 text-emerald-700";
  if (status === "REJECTED") return "border-red-600 text-red-700";
  return "border-amber-600 text-amber-700";
}

function uiStatusLabel(s: UiStatus) {
  if (s === "REJECTED") return "Ditinjau Ulang";
  if (s === "TERVERIFIKASI") return "Verifikasi";
  if (s === "APPROVED" || s === "DINILAI") return "Dinilai";
  return "Belum Verifikasi";
}

function loadSelectedIds(storageKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return new Set();
    return new Set(ids.map(String).filter(Boolean));
  } catch {
    return new Set();
  }
}

function saveSelectedIds(storageKey: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

export default function DataTalentaPage({ role, fieldId, initialPage }: Props) {
  const storageKey = `${LS_KEY_PREFIX}${fieldId}`;

  const [search, setSearch] = useState("");
  const [scoreQ, setScoreQ] = useState("");
  const [status, setStatus] = useState<StatusFilterUI>("all");
  const [kategori, setKategori] = useState("all");
  const [jenisTalenta, setJenisTalenta] = useState("all");

  const JENIS_TALENTA_ORDER: Record<string, number> = {
    "Peserta (Pelatihan / Workshop / Seminar / Upskilling)": 1,
    "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)": 2,
    "Pembimbing Lomba": 3,
    "Peserta Lomba": 4,
    "Minat / Bakat / Lainnya": 5,
  };

  // TAG FILTER state
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagPriority, setTagPriority] = useState<TagOption[]>([]);
  const [tagOthers, setTagOthers] = useState<Array<TagOption & { usedCount: number }>>([]);
  const [tagFree, setTagFree] = useState<Array<{ name: string; usedCount: number }>>([]);
  const [tagTexts, setTagTexts] = useState<string[]>([]);
  const [tagOpen, setTagOpen] = useState(false);
  const [juara, setJuara] = useState<"" | "Juara 1" | "Juara 2" | "Juara 3">("");

  const [page, setPage] = useState(initialPage);

  const [kategoriOptions, setKategoriOptions] = useState<string[]>([]);
  const [jenisOptions, setJenisOptions] = useState<string[]>([]);

  const [items, setItems] = useState<TalentaAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [scoreSort, setScoreSort] = useState<ScoreSort | undefined>(undefined);

  const [openDetail, setOpenDetail] = useState(false);
  const [selectedTalenta, setSelectedTalenta] = useState<TalentaAdmin | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectedJenisLock, setSelectedJenisLock] = useState<string | null>(null);

  const [ttdOpen, setTtdOpen] = useState(false);
  const [ttdName, setTtdName] = useState("");
  const [ttdNip, setTtdNip] = useState("");
  const [pendingMode, setPendingMode] = useState<null | "filter" | "selected">(null);

  function validateTtd() {
    const name = ttdName.trim();
    const nip = ttdNip.trim();
    if (!name) return { ok: false as const, error: "Nama penandatangan wajib diisi." };
    if (!nip) return { ok: false as const, error: "NIP wajib diisi." };
    return { ok: true as const, name, nip };
  }

  const buildParams = (p: number, ps: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("pageSize", String(ps));
    params.set("fieldId", fieldId);

    if (search) params.set("q", search);
    if (scoreQ) params.set("scoreQ", scoreQ);

    params.delete("status");
    params.delete("uiStatus");

    if (status !== "all") {
      if (status === "TERVERIFIKASI") params.set("uiStatus", "TERVERIFIKASI");
      else if (status === "APPROVED" || status === "DINILAI") params.set("status", "APPROVED");
      else if (status === "REJECTED") params.set("status", "REJECTED");
      else if (status === "PENDING") params.set("status", "PENDING");
    }

    if (kategori !== "all") params.set("kategori", kategori);
    if (jenisTalenta !== "all") params.set("jenis", jenisTalenta);

    // TAG FILTER: kirim multi tagId
    tagIds.forEach((id) => params.append("tagId", id));
    tagTexts.forEach((t) => params.append("tagText", t));

    if (juara) params.set("juara", juara);

    params.delete("sort");
    params.delete("dir");

    if (scoreSort === "score_desc") {
      params.set("sort", "score");
      params.set("dir", "desc");
    } else if (scoreSort === "score_asc") {
      params.set("sort", "score");
      params.set("dir", "asc");
    }

    return params;
  };

  const handleExportXlsAll = async () => {
    try {
      setLoading(true);

      const all: TalentaAdmin[] = [];
      let p = 1;
      let tp = 1;

      while (p <= tp) {
        const params = buildParams(p, PAGE_SIZE);
        const res = await fetch(`/api/admin-talenta/talent-submissions?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res.json()) as ApiResponse | { error?: string };
        if (!res.ok) throw new Error((json as any)?.error ?? "Gagal export");

        const j = json as ApiResponse;
        all.push(...j.data);
        tp = j.totalPages;
        p += 1;
      }

      exportTalentaToXLS(all);
    } catch (e: any) {
      alert(e?.message ?? "Gagal export");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintFilterAllWithSigner = async (signer: TtdInput) => {
    try {
      setLoading(true);

      const all: TalentaAdmin[] = [];
      let p = 1;
      let tp = 1;

      while (p <= tp) {
        const params = buildParams(p, PAGE_SIZE);
        const res = await fetch(`/api/admin-talenta/talent-submissions?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        const json = (await res.json()) as ApiResponse | { error?: string };
        if (!res.ok) throw new Error((json as any)?.error ?? "Gagal cetak");

        const j = json as ApiResponse;
        all.push(...j.data);
        tp = j.totalPages;
        p += 1;
      }

      const w = openPrintWindow(); // dipanggil dari tombol modal
      if (!w) throw new Error("Pop-up diblokir browser");

      const itemsForPrint = mapTalentaToSubmissionItem(all);
      const { ok, html, error } = await renderPrintHtml(itemsForPrint, signer);

      if (!ok) throw new Error(error || "Gagal render");

      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e: any) {
      alert(e?.message ?? "Gagal cetak");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSelectedWithSigner = async (signer: TtdInput) => {
    if (selectedIds.size === 0) {
      alert("Pilih minimal 1 data untuk dicetak!");
      return;
    }

    const res = await fetch("/api/admin-talenta/talent-print-selected", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });

    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { }

    if (!res.ok) {
      console.error("print-selected error", res.status, json ?? text);
      alert(json?.error ?? "Gagal mengambil data terpilih.");
      return;
    }

    const itemsForPrint = (json?.items ?? []) as SubmissionItem[];
    if (itemsForPrint.length === 0) {
      alert("Tidak ada data APPROVED yang bisa dicetak dari pilihan Anda (atau tidak diotorisasi).");
      return;
    }

    const w = openPrintWindow();
    if (!w) return;

    const { ok, html, error } = await renderPrintHtml(itemsForPrint, signer);
    if (!ok) {
      alert(error);
      w.close();
      return;
    }

    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  useEffect(() => {
    let cancelled = false;

    async function loadPrintCtx() {
      try {
        const res = await fetch("/api/admin-talenta/print-context", { cache: "no-store" });
        if (!res.ok) return;

        const data = await res.json();
        if (cancelled) return;

        printCtx.gtk = data.gtk ? { name: data.gtk.name, schoolName: data.gtk.schoolName } : null;
        printCtx.letterhead = data.letterhead;
        printCtx.branchCity = data.branch.city;
      } catch {
        // silent
      }
    }

    loadPrintCtx();
    return () => {
      cancelled = true;
    };
  }, []);

  // opsi filter: hanya menambah
  useEffect(() => {
    setKategoriOptions((prev) => {
      const set = new Set(prev);
      for (const t of items) {
        const d = t.detailTalenta?.[0];
        if (d?.kategori) set.add(d.kategori);
      }
      return Array.from(set).sort();
    });

    setJenisOptions((prev) => {
      const set = new Set(prev);
      for (const t of items) {
        const d = t.detailTalenta?.[0];
        if (d?.jenis) set.add(d.jenis);
      }

      const arr = Array.from(set);
      arr.sort((a, b) => {
        const ao = JENIS_TALENTA_ORDER[a] ?? 999;
        const bo = JENIS_TALENTA_ORDER[b] ?? 999;
        if (ao !== bo) return ao - bo;
        return a.localeCompare(b);
      });

      return arr;
    });
  }, [items]);

  // reset page kalau filter berubah (termasuk tagIds)
  useEffect(() => {
    setPage(1);
  }, [search, scoreQ, status, kategori, jenisTalenta, tagIds, tagTexts, juara, scoreSort]);

  // load opsi tag untuk dropdown (prioritas & lainnya)
  useEffect(() => {
    let cancelled = false;

    async function loadTagOptions() {
      try {
        const res = await fetch(`/api/admin-talenta/tags?fieldId=${fieldId}`, { cache: "no-store" });
        const text = await res.text();
        console.log("TAGS", res.status, text);
        if (!res.ok) return;
        const json = JSON.parse(text);
        setTagPriority(json.priority ?? []);
        setTagOthers(json.others ?? []);
        setTagFree(json.free ?? []);
      } catch {
        // silent
      }
    }

    loadTagOptions();
    return () => {
      cancelled = true;
    };
  }, [fieldId]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setErrorMsg(null);

      try {
        const params = buildParams(page, PAGE_SIZE);

        const res = await fetch(`/api/admin-talenta/talent-submissions?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const text = await res.text();
        let json: ApiResponse | { error?: string };

        try {
          json = JSON.parse(text);
        } catch {
          setErrorMsg("Response API bukan JSON.");
          return;
        }

        if (!res.ok) {
          setErrorMsg((json as any)?.error || "Gagal memuat data.");
          return;
        }

        const j = json as ApiResponse;
        setItems(j.data);
        setTotal(j.total);
        setTotalPages(j.totalPages);

        if (j.totalPages > 0 && page > j.totalPages) setPage(j.totalPages);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErrorMsg("Terjadi kesalahan jaringan.");
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [page, search, scoreQ, status, kategori, jenisTalenta, fieldId, reloadKey, tagIds, tagTexts, juara, scoreSort]);

  const paginationRange = useMemo(() => {
    if (totalPages <= 1) return [1];

    const half = Math.floor(PAGE_WINDOW / 2);
    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, start + PAGE_WINDOW - 1);

    if (end - start + 1 < PAGE_WINDOW) start = Math.max(1, end - PAGE_WINDOW + 1);

    const range: number[] = [];
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  }, [page, totalPages]);

  function mapTalentaToSubmissionItem(data: TalentaAdmin[]): SubmissionItem[] {
    return data.map((t) => {
      const d = t.detailTalenta?.[0];
      return {
        jenisTalenta: d?.jenis ?? "-",
        fieldLabel: d?.bidang ?? "-",
        activityName: d?.namaKegiatan ?? "-",
        description: d?.deskripsi ?? "-",
        subject: d?.subKategori ?? "-",
        gtk: {
          name: t.gtk.nama,
          nik: t.gtk.nik,
          school: {
            name: t.gtk.sekolah,
            npsn: (t.gtk as any).npsn ?? null,
          },
        },
      };
    });
  }

  const toggleItemSelection = (id: string, v: boolean | "indeterminate") => {
    const row = items.find((x) => x.id === id);
    const rowJenis = row?.detailTalenta?.[0]?.jenis?.trim() || "-";

    // saat mau memilih, kunci ke 1 jenis
    if (v === true) {
      if (selectedJenisLock && rowJenis !== selectedJenisLock) {
        alert(`Hanya boleh memilih 1 jenis talenta. Saat ini: ${selectedJenisLock}`);
        return;
      }
    }

    const next = new Set(selectedIds);
    if (v === true) next.add(id);
    else next.delete(id);

    setSelectedIds(next);

    // set / clear lock
    if (v === true) {
      setSelectedJenisLock(rowJenis);
    } else {
      if (next.size === 0) setSelectedJenisLock(null);
    }
  };

  const pageSelectedCount = useMemo(() => {
    let c = 0;
    for (const it of items) if (selectedIds.has(it.id)) c++;
    return c;
  }, [items, selectedIds]);

  const selectAllChecked: boolean | "indeterminate" = useMemo(() => {
    if (items.length === 0) return false;
    if (pageSelectedCount === 0) return false;
    if (pageSelectedCount === items.length) return true;
    return "indeterminate";
  }, [items.length, pageSelectedCount]);

  const resetAll = () => {
    setSearch("");
    setScoreQ("");
    setStatus("all");
    setKategori("all");
    setJenisTalenta("all");
    setTagIds([]);
    setTagTexts([]);
    setJuara("");
    setScoreSort(undefined);

    setPage(1);
  };

  const tagSelectedLabel = useMemo(() => {
    const names: string[] = [];

    if (juara) names.push(juara);

    if (tagIds.length) {
      const map = new Map<string, string>();
      tagOthers.forEach((t) => map.set(t.id, t.name));
      names.push(...tagIds.map((id) => map.get(id) ?? id));
    }

    if (tagTexts.length) names.push(...tagTexts);

    if (names.length === 0) return "Filter tag";
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }, [juara, tagIds, tagOthers, tagTexts]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Data Talenta</h1>
          <p className="text-sm text-muted-foreground">Menampilkan semua talenta pada bidang ini.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleExportXlsAll}
            disabled={loading || total === 0}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export XLS (filter)
          </Button>

          <Button
            variant="outline"
            onClick={() => { setPendingMode("filter"); setTtdOpen(true); }}
            disabled={loading || total === 0}
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            Cetak PDF (filter)
          </Button>

          <Button
            variant={selectedIds.size > 0 ? "default" : "outline"}
            onClick={() => { setPendingMode("selected"); setTtdOpen(true); }}
            disabled={loading || selectedIds.size === 0}
            className="gap-2"
          >
            <PrinterIcon className="w-4 h-4" />
            Cetak PDF ({selectedIds.size})
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setSelectedIds(new Set());
              if (typeof window !== "undefined") localStorage.removeItem(storageKey);
            }}
            disabled={selectedIds.size === 0}
            className="gap-2"
            title="Hapus semua pilihan"
          >
            Reset pilihan
          </Button>

          <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)} disabled={loading} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Cari GTK / kegiatan / sekolah..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Input className="w-40" placeholder="Cari skor..." value={scoreQ} onChange={(e) => setScoreQ(e.target.value)} />

          <Select value={scoreSort} onValueChange={(v) => setScoreSort(v as any)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Urutkan skor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="score_desc">Skor terbesar → terkecil</SelectItem>
              <SelectItem value="score_asc">Skor terkecil → terbesar</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilterUI)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="TERVERIFIKASI">Verifikasi</SelectItem>
              <SelectItem value="APPROVED">Dinilai</SelectItem>
              <SelectItem value="REJECTED">Ditinjau Ulang</SelectItem>
            </SelectContent>
          </Select>

          <Select value={kategori} onValueChange={setKategori}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {kategoriOptions.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={jenisTalenta} onValueChange={setJenisTalenta}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Jenis talenta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua jenis</SelectItem>
              {jenisOptions.map((j) => (
                <SelectItem key={j} value={j}>
                  {j}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* TAG FILTER dropdown */}
          <Popover open={tagOpen} onOpenChange={setTagOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={tagOpen} className="w-64 justify-between font-normal">
                <span className="truncate">{tagSelectedLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <Command>
                <CommandInput placeholder="Cari tag..." />
                <CommandList className="max-h-72 overflow-auto">
                  <CommandEmpty>Tag tidak ditemukan.</CommandEmpty>

                  <CommandGroup heading="Prioritas">
                    {tagPriority.map((p) => {
                      const checked = juara === p.name;

                      return (
                        <CommandItem
                          key={p.id}
                          value={p.name}
                          onSelect={() => setJuara((prev) => (prev === p.name ? "" : (p.name as any)))}
                        >
                          <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{p.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                  <CommandSeparator />

                  <CommandGroup heading="Tag lain">
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
                  <CommandGroup heading="Tag bebas">
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

          <Button variant="outline" onClick={resetAll}>
            Reset filter
          </Button>
        </CardContent>
      </Card>

      {errorMsg && (
        <Card className="border-rose-200">
          <CardContent className="py-3 text-sm text-rose-700">{errorMsg}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Daftar Talenta</CardTitle>
            <CardDescription>
              Menampilkan {items.length} data dari {total} (hasil filter).
              {selectedIds.size > 0 && ` | ${selectedIds.size} dipilih`}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Pilih</TableHead>
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
              {items.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Tidak ada data untuk filter/pencarian saat ini.
                  </TableCell>
                </TableRow>
              )}

              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Memuat data...
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                items.map((t) => {
                  const uiStatus = getUiStatus(t);
                  const isSelected = selectedIds.has(t.id);
                  const statusLabel = uiStatusLabel(uiStatus);
                  const d = t.detailTalenta?.[0];
                  const tags = (d?.tag ?? []).filter(Boolean);
                  const rowJenis = d?.jenis?.trim() || "-";
                  const locked = selectedIds.size > 0 && selectedJenisLock !== null;
                  const disableRowCheckbox = locked && rowJenis !== selectedJenisLock && !isSelected;

                  return (
                    <TableRow key={t.id} className={`hover:bg-muted/40 ${isSelected ? "bg-blue-50 dark:bg-blue-950" : ""}`}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={isSelected}
                          disabled={disableRowCheckbox}
                          onCheckedChange={(v) => toggleItemSelection(t.id, v)}
                          aria-label={`Pilih ${t.gtk.nama}`}
                        />
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        <div className="text-xs text-muted-foreground leading-4">{d?.jenis ?? "-"}</div>
                        <div className="font-semibold leading-5">{d?.namaKegiatan ?? "-"}</div>
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        {tags.length === 0 ? (
                          <span className="text-sm text-muted-foreground">-</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {tags.slice(0, 2).map((x) => (
                              <Badge key={x} variant="outline" className="text-xs font-normal">
                                {x}
                              </Badge>
                            ))}
                            {tags.length > 2 ? (
                              <Badge variant="secondary" className="text-xs font-normal">
                                +{tags.length - 2}
                              </Badge>
                            ) : null}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="font-medium">
                        <div>{t.gtk.nama}</div>
                        <div className="text-xs text-muted-foreground">{t.gtk.nik}</div>
                      </TableCell>

                      <TableCell>
                        <div className="whitespace-nowrap">{t.gtk.sekolah}</div>
                      </TableCell>

                      <TableCell className="text-center tabular-nums">{t.jumlahTalentaGtk ?? 0}</TableCell>

                      <TableCell className="text-center tabular-nums font-semibold">{t.totalSkor}</TableCell>

                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold bg-transparent ${statusBadgeClass(uiStatus)}`}
                        >
                          {statusLabel}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center">
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
                          <Eye className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>

            {totalPages > 1 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={9}>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} aria-disabled={page === 1} />
                        </PaginationItem>

                        {paginationRange[0] > 1 && (
                          <>
                            <PaginationItem>
                              <PaginationLink isActive={page === 1} onClick={() => setPage(1)}>
                                1
                              </PaginationLink>
                            </PaginationItem>
                            {paginationRange[0] > 2 && (
                              <PaginationItem>
                                <span className="px-2 text-xs text-muted-foreground">...</span>
                              </PaginationItem>
                            )}
                          </>
                        )}

                        {paginationRange.map((p) => (
                          <PaginationItem key={p}>
                            <PaginationLink isActive={page === p} onClick={() => setPage(p)}>
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        ))}

                        {paginationRange[paginationRange.length - 1] < totalPages && (
                          <>
                            {paginationRange[paginationRange.length - 1] < totalPages - 1 && (
                              <PaginationItem>
                                <span className="px-2 text-xs text-muted-foreground">...</span>
                              </PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationLink isActive={page === totalPages} onClick={() => setPage(totalPages)}>
                                {totalPages}
                              </PaginationLink>
                            </PaginationItem>
                          </>
                        )}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            aria-disabled={page === totalPages}
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

      <DetailTalentaModal
        open={openDetail}
        onOpenChange={setOpenDetail}
        talenta={selectedTalenta}
        fieldId={fieldId}
        onAfterUpdate={(_payload: TalentaUpdatePayload) => {
          setReloadKey((k) => k + 1);
        }}
      />

      {ttdOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
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

                  const signer: TtdInput = { name: v.name, nip: v.nip };

                  if (pendingMode === "filter") await handlePrintFilterAllWithSigner(signer);
                  else await handlePrintSelectedWithSigner(signer);

                  setTtdOpen(false);
                  setPendingMode(null);
                  setTtdName("");
                  setTtdNip("");
                }}
              >
                Cetak
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
