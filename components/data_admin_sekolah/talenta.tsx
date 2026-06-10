"use client";

import type { UserRole } from "@/lib/types/role";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Search as SearchIcon,
  Edit,
  RefreshCcw,
  FileText,
  Check,
  ChevronsUpDown,
  User,
} from "lucide-react";

import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";

import VerifikasiSekolahModal from "@/components/modals/verifikasi-sekolah-modal";

import { exportTalentaAdminToXLS } from "@/lib/export-talenta-admin-xls";

import { openPrintWindow, renderPrintHtml, printCtx, type SubmissionItem, type TtdInput } from "@/lib/export-talenta-pdf";

import type { Status, SubmissionRow } from "@/lib/types/talent-submission-admin";

type DecisionScopeClient = "SEKOLAH" | "TALENTA" | "SUPER_ADMIN" | null;
type UiStatus = "PENDING" | "TERVERIFIKASI" | "APPROVED" | "REJECTED";
type StatusFilterUI = "all" | UiStatus;
type TagOption = { id: string; name: string };
type TagsApiResponse = {
  priority: TagOption[];
  others: Array<TagOption & { usedCount: number }>;
  free: Array<{ name: string; usedCount: number }>;
};

type Talenta = {
  jenisBidang: string;
  mapel?: string;
  categoryLabel?: string;
  subCategoryLabel?: string;
  tagsLabel?: string[];
  detail?: string;
  skor?: number;
};

type Gtk = {
  name: string;
  Talenta?: Talenta[];
};

type SubmissionRowUI = SubmissionRow & {
  approvedScope?: DecisionScopeClient;
  rejectedScope?: DecisionScopeClient;
};

type SubmissionRowForExport = {
  gtkName: string;
  mapel?: string;
  jenisBidang: string;
  keterangan: string;
  skor?: number;
  talentaCount: number;
};

type ScoreSort = "default" | "score_desc" | "score_asc";

const PAGE_SIZE = 20;
const PAGE_WINDOW = 5;

type PageItem = number | "ellipsis";

function mapToExportRows(data: SubmissionRowUI[]): SubmissionRowForExport[] {
  const countMap = new Map<string, number>();
  for (const t of data) {
    const key = t.gtk?.nik ?? t.id;
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  return data.map((t) => {
    const key = t.gtk?.nik ?? t.id;
    return {
      gtkName: t.gtk?.name ?? "-",
      mapel: t.gtk?.mapel ?? "-",
      jenisBidang: t.fieldLabel ?? "-",
      keterangan:
        [t.categoryLabel, t.subCategoryLabel, (t.tagsLabel ?? []).join(", ") || null]
          .filter(Boolean)
          .join(" • ") || "-",
      skor: typeof t.computedScore === "number" ? t.computedScore : undefined,
      talentaCount: countMap.get(key) ?? 1,
    };
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getPageWindow(page: number, totalPages: number, windowSize = PAGE_WINDOW): PageItem[] {
  if (totalPages <= 1) return [1];
  if (totalPages <= windowSize + 2) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const half = Math.floor(windowSize / 2);
  let start = clamp(page - half, 1, Math.max(1, totalPages - windowSize + 1));
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const pages: PageItem[] = [];
  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push("ellipsis");
  }
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push("ellipsis");
    pages.push(totalPages);
  }
  return pages;
}

function getUiStatus(r: SubmissionRowUI): UiStatus {
  if (r.status === "REJECTED") return "REJECTED";
  if (r.status === "PENDING") return "PENDING";

  // status APPROVED:
  if (r.approvedScope === "SEKOLAH") return "TERVERIFIKASI";
  return "APPROVED";
}

function statusBadge(ui: UiStatus) {
  if (ui === "APPROVED") {
    return (
      <Badge variant="outline" className="rounded-full border-sky-600 text-sky-700 bg-transparent">
        Dinilai
      </Badge>
    );
  }

  if (ui === "TERVERIFIKASI") {
    return (
      <Badge variant="outline" className="rounded-full border-emerald-600 text-emerald-700 bg-transparent">
        Verifikasi
      </Badge>
    );
  }

  if (ui === "REJECTED") {
    return (
      <Badge variant="outline" className="rounded-full border-red-600 text-red-700 bg-transparent">
        Ditinjau Ulang
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full border-amber-600 text-amber-700 bg-transparent">
      Belum Verifikasi
    </Badge>
  );
}

const TALENT_TYPE_ORDER: Record<string, number> = {
  "Peserta (Pelatihan / Workshop / Seminar / Upskilling)": 1,
  "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)": 2,
  "Pembimbing Lomba": 3,
  "Peserta Lomba": 4,
  "Minat / Bakat / Lainnya": 5,
};

function normalizeTalentTypeLabel(raw: string) {
  const s = (raw ?? "").trim().toLowerCase();

  if (s.includes("peserta") && (s.includes("pelatihan") || s.includes("workshop") || s.includes("seminar") || s.includes("upskilling")))
    return "Peserta (Pelatihan / Workshop / Seminar / Upskilling)";

  if ((s.includes("narasumber") || s.includes("ahli")) && (s.includes("pelatihan") || s.includes("workshop") || s.includes("seminar") || s.includes("upskilling")))
    return "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)";

  if (s.includes("pembimbing") && s.includes("lomba")) return "Pembimbing Lomba";
  if (s.includes("peserta") && s.includes("lomba")) return "Peserta Lomba";
  if (s.includes("minat") || s.includes("bakat") || s.includes("lainnya")) return "Minat / Bakat / Lainnya";

  return raw?.trim() || raw;
}

export default function DataTalentaPage({
  role,
  userName,
}: {
  role: UserRole;
  userName: string;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SubmissionRowUI[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [printReady, setPrintReady] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterUI>("all");
  const [jenisFilter, setJenisFilter] = useState<string>("all");
  const [bidangFilter, setBidangFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // TAG FILTER (server-side)
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [juara, setJuara] = useState<"" | "Juara 1" | "Juara 2" | "Juara 3">("");
  const [tagPriority, setTagPriority] = useState<TagOption[]>([]);
  const [tagOthers, setTagOthers] = useState<Array<TagOption & { usedCount: number }>>([]);
  const [tagTexts, setTagTexts] = useState<string[]>([]);
  const [tagFree, setTagFree] = useState<Array<{ name: string; usedCount: number }>>([]);
  const [tagOpen, setTagOpen] = useState(false);

  const [scoreSort, setScoreSort] = useState<ScoreSort | undefined>(undefined);

  // modal
  const [openVerifikasi, setOpenVerifikasi] = useState(false);
  const [selected, setSelected] = useState<SubmissionRowUI | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  // selection
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const [ttdOpen, setTtdOpen] = useState(false);
  const [ttdName, setTtdName] = useState("");
  const [ttdNip, setTtdNip] = useState("");

  const [pendingMode, setPendingMode] = useState<"filter" | "selected" | null>(null);

  const validateTtd = () => {
    const name = ttdName.trim();
    const nip = ttdNip.trim();
    if (!name) return { ok: false as const, error: "Nama wajib diisi.", name: "", nip: "" };
    if (!nip) return { ok: false as const, error: "NIP wajib diisi.", name: "", nip: "" };
    return { ok: true as const, error: "", name, nip };
  };

  const buildParams = () => {
    const params = new URLSearchParams();

    if (juara) params.set("juara", juara);
    tagIds.forEach((id) => params.append("tagId", id));
    tagTexts.forEach((t) => params.append("tagText", t));

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

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = buildParams();
      const url = `/api/admin-sekolah/talent-submissions?${params.toString()}`;
      const res = await fetch(url, { method: "GET" });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Gagal memuat data");

      const newRows = (json?.submissions ?? []) as SubmissionRowUI[];
      setRows(newRows);

      // prune selection (tidak reset)
      setSelectedIds((prev) => {
        const valid = new Set(newRows.map((x) => x.id));
        const next: Record<string, boolean> = {};
        for (const [id, v] of Object.entries(prev)) {
          if (v && valid.has(id)) next[id] = true;
        }
        return next;
      });
    } catch (e: any) {
      setError(e?.message ?? "Gagal memuat data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPrintCtx = async () => {
    try {
      setPrintReady(false);
      const res = await fetch("/api/admin-sekolah/print-context", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();

      printCtx.gtk = data.gtk ? { name: data.gtk.name, schoolName: data.gtk.schoolName } : null;
      printCtx.letterhead = data.letterhead ?? null;
      printCtx.branchCity = data.branch?.city ?? null;

      setPrintReady(!!printCtx.letterhead);
    } catch {
      setPrintReady(false);
    }
  };

  useEffect(() => {
    load();
    loadPrintCtx();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTagOptions() {
      try {
        const res = await fetch("/api/admin-sekolah/tags", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as TagsApiResponse;
        if (cancelled) return;
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
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagIds, tagTexts, juara, scoreSort]);

  const jenisOptions = useMemo(() => {
    const set = new Set<string>();

    for (const r of rows) {
      if (!r.type?.name) continue;
      set.add(normalizeTalentTypeLabel(r.type.name));
    }

    const arr = Array.from(set);
    arr.sort((a, b) => {
      const ao = TALENT_TYPE_ORDER[a] ?? 999;
      const bo = TALENT_TYPE_ORDER[b] ?? 999;
      if (ao !== bo) return ao - bo;
      return a.localeCompare(b, "id-ID");
    });

    return ["all", ...arr];
  }, [rows]);

  const bidangOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.fieldLabel) set.add(r.fieldLabel);

    const arr = Array.from(set);

    arr.sort((a, b) => {
      const aIsLainnya = a.trim().toLowerCase() === "lainnya";
      const bIsLainnya = b.trim().toLowerCase() === "lainnya";
      if (aIsLainnya && !bIsLainnya) return 1;   // a taruh belakang
      if (!aIsLainnya && bIsLainnya) return -1;  // b taruh belakang
      return a.localeCompare(b, "id-ID");        // sisanya alfabetis
    });

    return ["all", ...arr];
  }, [rows]);

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return rows.filter((r) => {
      const gtkName = (r.gtk?.name ?? "").toLowerCase();
      const act = (r.activityName ?? "").toLowerCase();
      const jenis = (r.type?.name ?? "").toLowerCase();
      const bidang = (r.fieldLabel ?? "").toLowerCase();

      const okSearch = !keyword || gtkName.includes(keyword) || act.includes(keyword) || jenis.includes(keyword) || bidang.includes(keyword);

      const ui = getUiStatus(r);
      const okStatus = statusFilter === "all" || ui === statusFilter;

      const okJenis =
        jenisFilter === "all" ||
        normalizeTalentTypeLabel(r.type?.name ?? "") === jenisFilter;
      const okBidang = bidangFilter === "all" || r.fieldLabel === bidangFilter;

      return okSearch && okStatus && okJenis && okBidang;
    });
  }, [rows, search, statusFilter, jenisFilter, bidangFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, jenisFilter, bidangFilter, tagIds, tagTexts, juara, scoreSort]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, page]);

  const gtkTalentaCountMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const key = r.gtk?.nik ?? r.id;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [rows]);

  // selection across filter/page
  const selectedItemsAll = useMemo(() => rows.filter((r) => selectedIds[r.id]), [rows, selectedIds]);
  const selectedItemsVisible = useMemo(() => filteredData.filter((r) => selectedIds[r.id]), [filteredData, selectedIds]);

  const schoolName = filteredData[0]?.gtk?.school?.name ?? rows[0]?.gtk?.school?.name ?? "Nama Sekolah";

  function mapToGtk(data: SubmissionRowUI[]): Gtk[] {
    const map = new Map<string, Gtk>();
    for (const t of data) {
      const key = (t as any).gtk?.nik ?? t.gtk?.name ?? t.id;
      const current = map.get(key) ?? { name: t.gtk?.name ?? "-", Talenta: [] };

      current.Talenta!.push({
        jenisBidang: t.fieldLabel ?? "-",
        mapel: t.gtk?.mapel ?? "-",
        categoryLabel: t.categoryLabel ?? undefined,
        subCategoryLabel: t.subCategoryLabel ?? undefined,
        tagsLabel: t.tagsLabel ?? [],
        detail: t.activityName ?? undefined,
        skor: typeof t.computedScore === "number" ? t.computedScore : undefined,
      });

      map.set(key, current);
    }
    return Array.from(map.values());
  }

  function mapToSubmissionItems(data: SubmissionRowUI[], forceJenisTalenta: string): SubmissionItem[] {
    return data.map((t) => ({
      jenisTalenta: forceJenisTalenta,
      gtk: {
        name: t.gtk?.name ?? null,
        nik: (t as any).gtk?.nik ?? null,
        school: {
          name: t.gtk?.school?.name ?? null,
          npsn: (t as any).gtk?.school?.npsn ?? null,
        },
      },
    }));
  }

  const selectedJenis = useMemo(() => selectedItemsAll[0]?.type?.name ?? null, [selectedItemsAll]);

  const toggleSelect = (id: string, checked: boolean) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;

    if (checked && selectedJenis && row.type?.name !== selectedJenis) {
      alert(
        `Pilihan tidak valid.\n\nAnda sudah memilih talenta dengan jenis "${selectedJenis}".\nData dengan jenis "${row.type?.name ?? "-"}" tidak dapat dipilih bersamaan.`
      );
      return;
    }

    setSelectedIds((prev) => ({ ...prev, [id]: checked }));
  };

  const allPageSelected = paginatedData.length > 0 && paginatedData.every((r) => selectedIds[r.id] === true);
  const somePageSelected = paginatedData.some((r) => selectedIds[r.id]) && !allPageSelected;

  const toggleSelectAllOnPage = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((prev) => {
        const next = { ...prev };
        for (const r of paginatedData) next[r.id] = false;
        return next;
      });
      return;
    }

    const jenisSet = new Set(paginatedData.filter((r) => r.type?.name).map((r) => r.type!.name as string));
    if (selectedJenis) jenisSet.add(selectedJenis);

    if (jenisSet.size > 1) {
      alert("Tidak dapat memilih semua pada halaman ini.\nKarena data memiliki lebih dari satu jenis talenta.");
      return;
    }

    setSelectedIds((prev) => {
      const next = { ...prev };
      for (const r of paginatedData) next[r.id] = true;
      return next;
    });
  };

  const doApprove = async () => {
    if (!selected) return;
    try {
      setBusyAction(true);
      const res = await fetch(`/api/admin-sekolah/talent-submissions/${selected.id}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Gagal approve");
      setOpenVerifikasi(false);
      setSelected(null);
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Gagal approve");
    } finally {
      setBusyAction(false);
    }
  };

  const doReject = async (note: string) => {
    if (!selected) return;
    try {
      setBusyAction(true);
      const res = await fetch(`/api/admin-sekolah/talent-submissions/${selected.id}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Gagal reject");
      setOpenVerifikasi(false);
      setSelected(null);
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Gagal reject");
    } finally {
      setBusyAction(false);
    }
  };

  const kepalaSekolah = {
    name: filteredData[0]?.gtk?.school?.headName ?? rows[0]?.gtk?.school?.headName ?? null,
    rank: filteredData[0]?.gtk?.school?.headRank ?? rows[0]?.gtk?.school?.headRank ?? null,
    nip: filteredData[0]?.gtk?.school?.headNip ?? rows[0]?.gtk?.school?.headNip ?? null,
  };

  const canExportByFilter = jenisFilter !== "all";
  const hasSelection = selectedItemsAll.length > 0;

  const exportTalentaName = hasSelection ? (selectedJenis ?? "Talenta") : jenisFilter !== "all" ? jenisFilter : "Talenta";

  const validateSingleJenis = (source: SubmissionRowUI[]) => {
    const jenisSet = new Set(source.filter((r) => r.type?.name).map((r) => r.type!.name as string));
    return jenisSet.size <= 1;
  };

  const handlePrintFilterAllWithSigner = async (signer: TtdInput) => {
    if (jenisFilter === "all") return alert("Pilih Jenis talenta dulu untuk cetak berdasarkan filter.");
    if (!printReady) return alert("Kop cabang belum siap. Isi branch_letterheads dulu.");

    const source = filteredData;
    if (!source.length) return;

    const w = openPrintWindow();
    if (!w) return;

    const items = mapToSubmissionItems(source, exportTalentaName);
    const res = await renderPrintHtml(items, signer); // <— penting
    if (!res.ok) {
      alert(res.error);
      w.close();
      return;
    }

    w.document.open();
    w.document.write(res.html);
    w.document.close();
  };

  const handlePrintSelectedWithSigner = async (signer: TtdInput) => {
    if (!selectedItemsAll.length) return alert("Centang minimal satu data.");
    if (!printReady) return alert("Kop cabang belum siap. Isi branch_letterheads dulu.");
    if (!validateSingleJenis(selectedItemsAll)) return alert("Cetak dibatalkan.\nPilihan mengandung lebih dari satu jenis talenta.");

    const w = openPrintWindow();
    if (!w) return;

    const items = mapToSubmissionItems(selectedItemsAll, exportTalentaName);
    const res = await renderPrintHtml(items, signer); // <— penting
    if (!res.ok) {
      alert(res.error);
      w.close();
      return;
    }

    w.document.open();
    w.document.write(res.html);
    w.document.close();
  };

  const handleExportXls = () => {
    if (!canExportByFilter) {
      alert("Pilih jenis talenta dulu sebelum export.");
      return;
    }

    const source = filteredData;
    if (!source.length) return;

    if (!validateSingleJenis(source)) {
      alert("Export dibatalkan.\nData yang akan diexport mengandung lebih dari satu jenis talenta.");
      return;
    }

    const gtkMap = new Map<
      string,
      {
        key: string;
        gtkName: string;
        mapel?: string;
        talentas: SubmissionRowUI[];
      }
    >();

    for (const t of source) {
      const key = t.gtk?.nik ?? t.id;

      const existing = gtkMap.get(key);
      if (existing) {
        existing.talentas.push(t);
      } else {
        gtkMap.set(key, {
          key,
          gtkName: t.gtk?.name ?? "-",
          mapel: t.gtk?.mapel ?? "-",
          talentas: [t],
        });
      }
    }

    const rowsForExport: SubmissionRowForExport[] = Array.from(gtkMap.values()).map((gtk) => {
      const talentaCountLikeTable = gtkTalentaCountMap.get(gtk.key) ?? gtk.talentas.length;

      return {
        gtkName: gtk.gtkName,
        mapel: gtk.mapel ?? "-",
        jenisBidang: gtk.talentas[0]?.fieldLabel ?? "-",
        keterangan:
          gtk.talentas
            .map((t) =>
              [t.categoryLabel, t.subCategoryLabel, (t.tagsLabel ?? []).join(", ") || null]
                .filter(Boolean)
                .join(" • ")
            )
            .join("; ") || "-",
        skor: gtk.talentas.reduce((sum, t) => sum + (typeof t.computedScore === "number" ? t.computedScore : 0), 0),

        talentaCount: talentaCountLikeTable,
      };
    });

    exportTalentaAdminToXLS(rowsForExport, schoolName, exportTalentaName);
  };

  const pageItems = useMemo(() => getPageWindow(page, totalPages), [page, totalPages]);

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

  return (
    <DashboardLayout role={role} userName={userName}>
      <div className="mx-auto w-full max-w-7xl px-6 py-8 space-y-8">
        <div className="flex flex-wrap justify-between gap-4 items-start">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Data GTK & Talenta Sekolah</h1>
            <p className="text-sm text-muted-foreground">Manajemen Talenta GTK</p>

            <div className="flex flex-wrap gap-2 pt-1">

              {!printReady ? (
                <Badge variant="outline" className="text-amber-700 border-amber-300">
                  Kop cabang belum siap
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="outline"
              onClick={() => {
                load();
                loadPrintCtx();
              }}
              disabled={loading}
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Button variant="outline" onClick={() => setSelectedIds({})} disabled={loading || selectedItemsAll.length === 0}>
              Reset pilihan
            </Button>

            <Button variant="outline" onClick={handleExportXls} disabled={loading || (!canExportByFilter && !hasSelection)}>
              <Download className="w-4 h-4 mr-2" />
              Export XLS (Filter)
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setPendingMode("filter");
                setTtdOpen(true);
              }}
              disabled={loading || !printReady || filteredData.length === 0 || jenisFilter === "all"}
            >
              <FileText className="w-4 h-4 mr-2" />
              Cetak PDF (Filter)
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setPendingMode("selected");
                setTtdOpen(true);
              }}
              disabled={loading || !printReady || selectedItemsAll.length === 0}
            >
              <FileText className="w-4 h-4 mr-2" />
              Cetak PDF (Dipilih)
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                placeholder="Cari nama GTK / kegiatan / jenis / bidang..."
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilterUI)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua status</SelectItem>
                  <SelectItem value="PENDING">Belum Verifikasi</SelectItem>
                  <SelectItem value="TERVERIFIKASI">Verifikasi</SelectItem>
                  <SelectItem value="APPROVED">Dinilai</SelectItem>
                  <SelectItem value="REJECTED">Tinjau Ulang</SelectItem>
                </SelectContent>
              </Select>

              <Select value={jenisFilter} onValueChange={setJenisFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Jenis" />
                </SelectTrigger>
                <SelectContent>
                  {jenisOptions.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x === "all" ? "Semua jenis" : x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={bidangFilter} onValueChange={setBidangFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Bidang" />
                </SelectTrigger>
                <SelectContent>
                  {bidangOptions.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x === "all" ? "Semua bidang" : x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover open={tagOpen} onOpenChange={setTagOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={tagOpen} className="justify-between font-normal">
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
                              value={t.name}
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

                  {(juara || tagIds.length || tagTexts.length) ? (
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          setJuara("");
                          setTagIds([]);
                          setTagTexts([]);
                        }}
                      >
                        Hapus filter tag
                      </Button>
                    </div>
                  ) : null}
                </PopoverContent>
              </Popover>

              <Select value={scoreSort} onValueChange={(v) => setScoreSort(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Urutkan skor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="score_desc">Skor terbesar → terkecil</SelectItem>
                  <SelectItem value="score_asc">Skor terkecil → terbesar</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setJenisFilter("all");
                  setBidangFilter("all");
                  setJuara("");
                  setTagIds([]);
                  setTagTexts([]);
                  setScoreSort(undefined);
                }}
              >
                Reset filter
              </Button>
            </div>

            {error ? <div className="text-sm text-red-600">{error}</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Talenta</CardTitle>
            <CardDescription>{loading ? "Memuat..." : `Menampilkan ${paginatedData.length} dari ${filteredData.length}`}</CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[44px]">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                          onCheckedChange={(v) => toggleSelectAllOnPage(Boolean(v))}
                          aria-label="Pilih semua (halaman ini)"
                        />
                      </div>
                    </TableHead>

                    <TableHead>Potensi</TableHead>
                    <TableHead>GTK</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead className="text-center">Skor</TableHead>
                    <TableHead className="text-center">Talenta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {!loading && paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        Tidak ada data.
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {paginatedData.map((t) => {
                    const checked = !!selectedIds[t.id];

                    const gtkKey = (t as any).gtkNik ?? (t as any).gtk?.nik ?? t.gtk?.name ?? t.id;
                    const jumlahTalentaGtk = gtkTalentaCountMap.get(gtkKey) ?? 0;

                    const nilaiTalenta = typeof t.computedScore === "number" ? t.computedScore.toFixed(2) : "0";
                    const ui = getUiStatus(t);

                    return (
                      <TableRow key={t.id} className="hover:bg-muted/40">
                        <TableCell className="text-center">
                          <Checkbox checked={checked} onCheckedChange={(v) => toggleSelect(t.id, Boolean(v))} aria-label="Pilih baris" />
                        </TableCell>

                        <TableCell className="whitespace-nowrap">
                          <div className="text-xs text-muted-foreground leading-4">{t.type?.name ?? "-"}</div>
                          <div className="text-sm font-semibold leading-5">{t.activityName ?? "-"}</div>
                        </TableCell>

                        <TableCell className="whitespace-nowrap">
                          <div className="font-medium">{t.gtk?.name ?? "-"}</div>
                          <div className="text-xs text-muted-foreground">{t.gtk?.school?.name ?? "-"}</div>
                        </TableCell>

                        <TableCell>
                          {/* Line 2: Tag */}
                          <div className="flex flex-wrap gap-2 mt-1">
                            {Array.isArray(t.tagsLabel) && t.tagsLabel.length > 0 ? (
                              <>
                                {/* Tampilkan max 2 tag */}
                                {t.tagsLabel.slice(0, 2).map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="rounded-full px-2.5 py-0.5 text-xs max-w-[140px] truncate"
                                    title={tag}
                                  >
                                    {tag}
                                  </Badge>
                                ))}

                                {/* Jika tag lebih dari 2 */}
                                {t.tagsLabel.length > 2 ? (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full px-2.5 py-0.5 text-xs text-muted-foreground"
                                    title={t.tagsLabel.join(", ")}
                                  >
                                    +{t.tagsLabel.length - 2} lagi
                                  </Badge>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-center tabular-nums">{nilaiTalenta}</TableCell>
                        <TableCell className="text-center tabular-nums">{jumlahTalentaGtk}</TableCell>

                        <TableCell className="whitespace-nowrap px-3 py-1 text-xs font-semibold">{statusBadge(ui)}</TableCell>

                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="border-primary text-primary"
                              onClick={() => {
                                setSelected(t);
                                setOpenVerifikasi(true);
                              }}
                              title="Verifikasi"
                            >
                              <Edit className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
                            </Button>

                            <Button
                              size="icon"
                              variant="outline"
                              className="border-emerald-600 text-emerald-600"
                              onClick={() => router.push(`/admin-sekolah/data-talenta/${t.gtk?.nik}`)}
                              title="Detail"
                            >
                              <User className="h-4 w-4 text-emerald-600" strokeWidth={2.75} absoluteStrokeWidth />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>

                {totalPages > 1 ? (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} aria-disabled={page === 1} />
                            </PaginationItem>

                            {pageItems.map((it, idx) =>
                              it === "ellipsis" ? (
                                <PaginationItem key={`e-${idx}`}>
                                  <span className="px-2 text-xs text-muted-foreground">...</span>
                                </PaginationItem>
                              ) : (
                                <PaginationItem key={it}>
                                  <PaginationLink isActive={page === it} onClick={() => setPage(it)}>
                                    {it}
                                  </PaginationLink>
                                </PaginationItem>
                              )
                            )}

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
            </div>
          </CardContent>
        </Card>

        <VerifikasiSekolahModal
          open={openVerifikasi}
          onOpenChange={(v) => {
            setOpenVerifikasi(v);
            if (!v) setSelected(null);
          }}
          submission={selected as any}
          onApprove={doApprove}
          onReject={doReject}
          busy={busyAction}
        />
      </div>

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

    </DashboardLayout>
  );
}
