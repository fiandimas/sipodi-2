"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Plus,
  Search,
  Printer,
  Trophy,
  RefreshCcw,
  X,
  Check,
  ChevronsUpDown,
  Trash2,
} from "lucide-react";

import DashboardLayout from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

// import
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { cn } from "@/lib/utils";

import CreateTalentaUserModal, { type CreateSubmissionResult } from "@/components/modals/create-talenta-user";
import DetailTalentaUserModal, { type SubmissionItem, type ResubmitData } from "@/components/modals/detail-talenta-user";

type MeResponse = {
  gtk: {
    nik: string;
    name: string;
    schoolName: string;
    photoUrl?: string | null;
  } | null;
};

type PrintContext = {
  gtk: { name: string; schoolName: string };
  branch?: { id: string; name: string; city: string } | null;
  letterhead: {
    title: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    signerName?: string | null;
    signerRank?: string | null;
    signerNip?: string | null;
    signerRole?: string | null;
  } | null;
};

// ✅ 4-state untuk UI GTK
type UiStatus = "PENDING" | "TERVERIFIKASI" | "APPROVED" | "REJECTED" | "DINILAI";
type StatusFilter = "ALL" | UiStatus;

type TagOption = { id: string; name: string };
type TagsApiResponse = {
  priority: TagOption[];
  others: Array<TagOption & { usedCount: number }>;
  free: Array<{ name: string; usedCount: number }>;
};

const PAGE_SIZE = 10;
const PAGE_WINDOW = 5;

function formatDateID(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function uiStatusOf(s: SubmissionItem): UiStatus {
  if (s.status === "REJECTED") return "REJECTED";

  const anyS = s as any;
  const scope: string | null =
    (anyS.approvedScopeResolved ?? anyS.approvedScope ?? null) as string | null;

  if (!scope) {
    if (s.status === "APPROVED") return "APPROVED";
    return "PENDING";
  }

  if (scope === "SEKOLAH") return "TERVERIFIKASI";
  if (scope === "TALENTA" || scope === "SUPER_ADMIN") return "APPROVED";

  if (s.status === "APPROVED") return "APPROVED";
  return "PENDING";
}

function statusBadge(uiStatus: UiStatus) {
  switch (uiStatus) {
    case "APPROVED":
      return (
        <Badge variant="outline" className="rounded-full border-sky-600 text-sky-700 bg-transparent px-2.5 py-0.5 text-xs">
          Dinilai
        </Badge>
      );

    case "TERVERIFIKASI":
      return (
        <Badge variant="outline" className="rounded-full border-emerald-600 text-emerald-700 bg-transparent px-2.5 py-0.5 text-xs">
          Verifikasi
        </Badge>
      );

    case "REJECTED":
      return (
        <Badge variant="outline" className="rounded-full border-red-600 text-red-700 bg-transparent px-2.5 py-0.5 text-xs">
          Tinjau Ulang
        </Badge>
      );

    default: // PENDING
      return (
        <Badge variant="outline" className="rounded-full border-amber-600 text-amber-700 bg-transparent px-2.5 py-0.5 text-xs">
          Belum Verifikasi
        </Badge>
      );
  }
}

type SubmissionItemWithScores = SubmissionItem & {
  userScore?: number | null;
  tagScore?: number | null;
  jenisScore?: number | null;
  adminScore?: number | null;
  computedScore?: number | null;
};

function sumOldScores(s: SubmissionItem) {
  return (s.scoreEntries ?? []).reduce((acc, e) => acc + (e.points ?? 0), 0);
}

function computeScores(s: SubmissionItemWithScores) {
  const oldTotal = sumOldScores(s);

  if (s.computedScore != null) {
    return { totalSkor: s.computedScore ?? 0, isNewModel: true, oldTotal };
  }

  return { totalSkor: oldTotal, isNewModel: false, oldTotal };
}

function compactTags(tags: string[] | undefined, max = 3) {
  const clean = (tags ?? []).filter(Boolean);
  if (clean.length <= max) return { shown: clean, more: 0 };
  return { shown: clean.slice(0, max), more: clean.length - max };
}

function shortText(s: string, max = 60) {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
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

export default function TalentaUserPage() {
  const [me, setMe] = useState<MeResponse["gtk"] | null>(null);
  const [list, setList] = useState<SubmissionItemWithScores[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [typeId, setTypeId] = useState<string>("ALL");
  const [fieldLabel, setFieldLabel] = useState<string>("ALL");

  const [tagIds, setTagIds] = useState<string[]>([]);
  const [juara, setJuara] = useState<"" | "Juara 1" | "Juara 2" | "Juara 3">("");
  const [tagPriority, setTagPriority] = useState<TagOption[]>([]);
  const [tagOthers, setTagOthers] = useState<Array<TagOption & { usedCount: number }>>([]);
  const [tagTexts, setTagTexts] = useState<string[]>([]);
  const [tagFree, setTagFree] = useState<Array<{ name: string; usedCount: number }>>([]);
  const [tagOpen, setTagOpen] = useState(false);

  const [openCreate, setOpenCreate] = useState(false);
  const [selected, setSelected] = useState<SubmissionItemWithScores | null>(null);

  const [printCtx, setPrintCtx] = useState<PrintContext | null>(null);
  const [page, setPage] = useState(1);

  // state
  const [deleteTarget, setDeleteTarget] = useState<SubmissionItemWithScores | null>(null)

  // handler
  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.status !== "PENDING") return;
    try {
      console.log("Deleting", deleteTarget);

      const res = await fetch(`/api/gtk/talent-submissions/${deleteTarget.id}`, {
        method: "DELETE",
      });

      await loadData();
    } catch (e) {
      setDeleteTarget(null);
      console.error(e);
      alert("Gagal memuat data");
    } finally {
      setDeleteTarget(null);
    }
  }

  const esc = (v: any) =>
    String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const loadMe = async () => {
    try {
      const res = await fetch("/api/me", { method: "GET" });
      if (!res.ok) return setMe(null);
      const json = (await res.json()) as MeResponse;
      setMe(json.gtk);
    } catch (e) {
      console.error(e);
      setMe(null);
    }
  };

  const buildParams = () => {
    const params = new URLSearchParams();
    if (juara) params.set("juara", juara);
    tagIds.forEach((id) => params.append("tagId", id));
    tagTexts.forEach((t) => params.append("tagText", t));
    return params;
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const params = buildParams();
      const url = `/api/gtk/talent-submissions?${params.toString()}`;

      const res = await fetch(url, { method: "GET" });
      const json = await res.json();

      if (!res.ok) {
        alert(json?.error ?? "Gagal memuat data");
        return;
      }

      setList((json.submissions ?? []) as SubmissionItemWithScores[]);
    } catch (e) {
      console.error(e);
      alert("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const loadPrintContext = async () => {
    try {
      const res = await fetch("/api/gtk/talent-print-context");
      const json = await res.json();
      if (res.ok) setPrintCtx(json);
    } catch (e) {
      console.error("Failed to load print context", e);
    }
  };

  useEffect(() => {
    loadMe();
    loadData();
    loadPrintContext();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTagOptions() {
      try {
        const res = await fetch("/api/gtk/tags", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as TagsApiResponse;
        if (cancelled) return;
        setTagPriority(json.priority ?? []);
        setTagOthers(json.others ?? []);
        setTagFree(json.free ?? []);
      } catch { }
    }

    loadTagOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const typeOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const s of list) {
      if (!s.type?.name) continue;
      const normalized = normalizeTalentTypeLabel(s.type.name);
      map.set(normalized, normalized);
    }

    const arr = Array.from(map.keys());
    arr.sort((a, b) => {
      const ao = TALENT_TYPE_ORDER[a] ?? 999;
      const bo = TALENT_TYPE_ORDER[b] ?? 999;
      if (ao !== bo) return ao - bo;
      return a.localeCompare(b, "id-ID");
    });

    return ["ALL", ...arr];
  }, [list]);

  const fieldOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of list) if (s.fieldLabel) set.add(s.fieldLabel);

    const arr = Array.from(set);

    arr.sort((a, b) => {
      const aIsLainnya = a.trim().toLowerCase() === "lainnya";
      const bIsLainnya = b.trim().toLowerCase() === "lainnya";
      if (aIsLainnya && !bIsLainnya) return 1;   // a ke belakang
      if (!aIsLainnya && bIsLainnya) return -1;  // b ke belakang
      return a.localeCompare(b, "id-ID");        // sisanya alfabetis
    });

    return ["ALL", ...arr];
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return list.filter((s) => {
      const uiStatus = uiStatusOf(s);

      if (status !== "ALL" && uiStatus !== status) return false;
      if (typeId !== "ALL" && s.type?.name !== typeId) return false;
      if (fieldLabel !== "ALL" && (s.fieldLabel ?? "-") !== fieldLabel) return false;

      if (!q) return true;

      const tagsLabel = (s.tagsLabel ?? []).join(" ");
      const haystack = [
        s.activityName,
        s.organizer,
        s.description,
        s.type?.name,
        s.fieldLabel,
        s.categoryLabel,
        s.subCategoryLabel,
        tagsLabel,
        uiStatus,
        s.rejectionNote,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [list, search, status, typeId, fieldLabel]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

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

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagIds, tagTexts, juara]);

  useEffect(() => {
    setPage(1);
  }, [search, status, typeId, fieldLabel, juara, tagIds]);

  const createdCount = filtered.length;

  const totalWeightedSum = useMemo(
    () => filtered.reduce((sum, s) => sum + computeScores(s).totalSkor, 0),
    [filtered]
  );

  const avgWeighted = useMemo(() => {
    if (filtered.length === 0) return 0;
    return totalWeightedSum / filtered.length;
  }, [filtered.length, totalWeightedSum]);

  const clearFilters = () => {
    setSearch("");
    setStatus("ALL");
    setTypeId("ALL");
    setFieldLabel("ALL");
    setJuara("");
    setTagIds([]);
    setTagTexts([]);
  };

  const doResubmit = async (id: string, formData: ResubmitData): Promise<void> => {
    if (!formData || !id) return;
    
    try {
      const fd = new FormData();

      if (formData.activityName.trim()) fd.set("activityName", formData.activityName.trim());
      if (formData.organizer.trim()) fd.set("organizer", formData.organizer.trim());
      if (formData.description.trim()) fd.set("description", formData.description.trim());
      if (formData.linkPendukung.trim()) fd.set("linkPendukung", formData.linkPendukung.trim());
      if (formData.newFile) fd.set("file", formData.newFile);
  
      const res = await fetch(`/api/gtk/talent-submissions/${id}/resubmit`, {
        method: "POST",
        body: fd,
      });

      setSelected(null);
      await loadData();
    } catch (error) {
      console.error("Error resubmitting submission:", error);
    }
  };

  const handlePrintSingle = (s: SubmissionItemWithScores) => {
    const win = window.open("", "_blank", "width=950,height=700");
    if (!win) return;

    const scores = computeScores(s);

    const gtkName = s.gtk?.name ?? me?.name ?? "nama gtk";
    const schoolName = s.gtk?.school?.name ?? me?.schoolName ?? "-";

    const namaKegiatan = s.activityName ?? "-";
    const bidang = s.fieldLabel ?? "-";
    const penyelenggara = s.organizer ?? "-";
    const kategori = s.categoryLabel ?? "-";
    const subKategori = s.subCategoryLabel ?? "-";
    const jenisTalenta = s.type?.name ?? "-";
    const deskripsi = s.description ?? "-";
    const linkPendukung = s.linkPendukung ?? "-";

    const tagText = (s.tagsLabel ?? []).length > 0 ? (s.tagsLabel ?? []).join("  ") : "-";
    const hasBukti = (s.files ?? []).length > 0;
    const photoUrl = me?.photoUrl || "/avatar.png";

    win.document.open();
    win.document.write(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Cetak Talenta</title>
  <style>
    @page { size: A4; margin: 8mm 8mm; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif; color:#111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 16mm 18mm; }
    .header { display:grid; grid-template-columns: 76px 1fr; gap:18px; align-items:center; margin-bottom: 12mm; }
    .avatar { width:76px; height:76px; border-radius:999px; background:#f97316; overflow:hidden; }
    .avatar-img { width:100%; height:100%; object-fit:cover; }
    .name { font-size: 22pt; font-weight: 800; margin:0; }
    .school { margin-top:4px; font-size: 12pt; color:#f97316; }
    .score { margin: 8mm 0 10mm 0; padding: 10px 12px; border: 2px solid #fb923c; border-radius: 10px; background:#fff7ed; font-weight:800; font-size: 14pt; display:flex; justify-content:space-between; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; column-gap: 34mm; row-gap: 12mm; }
    .item .label { color:#f97316; font-weight:600; margin-bottom:4px; }
    .item .value { font-size: 13pt; font-weight:600; word-break: break-word; }
    .rightOnly { grid-column: 2 / 3; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="avatar"><img src="${esc(photoUrl)}" class="avatar-img" /></div>
      <div>
        <div class="name">${esc(gtkName)}</div>
        <div class="school">${esc(schoolName)}</div>
      </div>
    </div>

    <div class="score">
      <span>Skor Akhir</span>
      <span>${Number(scores.totalSkor).toFixed(1)}</span>
    </div>

    <div class="grid">
      <div class="item"><div class="label">Nama Kegiatan</div><div class="value">${esc(namaKegiatan)}</div></div>
      <div class="item"><div class="label">Bidang</div><div class="value">${esc(bidang)}</div></div>

      <div class="item"><div class="label">Penyelenggara</div><div class="value">${esc(penyelenggara)}</div></div>
      <div class="item"><div class="label">Kategori</div><div class="value">${esc(kategori)}</div></div>

      <div class="item"><div class="label">Jenis Talenta</div><div class="value">${esc(jenisTalenta)}</div></div>
      <div class="item"><div class="label">Sub Kategori</div><div class="value">${esc(subKategori)}</div></div>

      <div class="item"><div class="label">Tag</div><div class="value">${esc(tagText)}</div></div>

      <div class="item rightOnly"><div class="label">Deskripsi</div><div class="value">${esc(deskripsi)}</div></div>

      <div class="item"><div class="label">Link Pendukung</div><div class="value">${esc(linkPendukung)}</div></div>

      <div class="item"><div class="label">Bukti</div><div class="value">${hasBukti ? "Ada" : "-"}</div></div>
    </div>

    <script>
      window.focus();
      window.print();
      window.onafterprint = () => window.close();
    </script>
  </div>
</body>
</html>`);
    win.document.close();
  };

  const rowClass = "h-10 [&>td]:py-2";

  return (
    <DashboardLayout role="user" userName={me?.name ?? "-"} userPhotoUrl={me?.photoUrl ?? "/avatar.png"}>
      <div className="w-full space-y-6 px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Talenta Saya</h1>
            <p className="text-sm text-muted-foreground">
              {me?.schoolName ? `Sekolah: ${me.schoolName}.` : "belum memiliki izin sekolah"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadData} disabled={loading} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>

            <Button onClick={() => setOpenCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Tambah Talenta
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <Card className="border-muted/60">
          <CardContent className="py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-full flex-col gap-3 lg:max-w-5xl">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="Cari potensi, jenis, bidang, kategori, dan tag."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Semua status</SelectItem>
                      <SelectItem value="APPROVED">Dinilai</SelectItem>
                      <SelectItem value="TERVERIFIKASI">Verifikasi</SelectItem>
                      <SelectItem value="PENDING">Belum Verifikasi</SelectItem>
                      <SelectItem value="REJECTED">Tinjau Ulang</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeId} onValueChange={(v) => setTypeId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Jenis" />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((x) => (
                        <SelectItem key={x} value={x}>
                          {x === "ALL" ? "Semua jenis" : x}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={fieldLabel} onValueChange={(v) => setFieldLabel(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Bidang" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOptions.map((x) => (
                        <SelectItem key={x} value={x}>
                          {x === "ALL" ? "Semua bidang" : x}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Popover open={tagOpen} onOpenChange={setTagOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={tagOpen} className="justify-between font-normal">
                        <span className="truncate">
                          {juara ? juara : tagIds.length ? `${tagIds.length} tag dipilih` : "semua tag"}
                        </span>
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

                      {(juara || tagIds.length) ? (
                        <div className="border-t p-2">
                          <Button variant="ghost" className="w-full" onClick={() => { setJuara(""); setTagIds([]); setTagTexts([]); }}>
                            Hapus filter tag
                          </Button>
                        </div>
                      ) : null}
                    </PopoverContent>
                  </Popover>

                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="gap-2"
                    disabled={
                      !search.trim() &&
                      status === "ALL" &&
                      typeId === "ALL" &&
                      fieldLabel === "ALL" &&
                      !juara &&
                      tagIds.length === 0 &&
                      tagTexts.length === 0
                    }
                  >
                    <X className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <Card className="border-muted/60">
          <CardContent className="pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-muted/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Talenta tampil</CardTitle>
                  <CardDescription>Jumlah talenta (filter)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums">{createdCount}</div>
                </CardContent>
              </Card>

              <Card className="border-muted/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm font-medium">Total Skor</CardTitle>
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <CardDescription>Akumulasi skor akhir semua item</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums">{totalWeightedSum.toFixed(1)}</div>
                </CardContent>
              </Card>

              <Card className="border-muted/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm font-medium">Rata-rata skor</CardTitle>
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <CardDescription>Rata-rata skor akhir (filter)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums">{avgWeighted.toFixed(1)}</div>
                </CardContent>
              </Card>

              <Card className="border-muted/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Dinilai</CardTitle>
                  <CardDescription>Jumlah yang sudah dinilai</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums">
                    {filtered.filter((x) => uiStatusOf(x) === "APPROVED").length}
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-muted/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Daftar Talenta</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="w-full overflow-x-auto">
              <div className="relative rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
                    <TableRow>
                      <TableHead className="min-w-[500px]">Potensi & Klasifikasi</TableHead>
                      <TableHead className="max-w-[140px]">Tag</TableHead>
                      <TableHead className="max-w-[100px] text-right">Skor</TableHead>
                      <TableHead className="w-[200px] text-center">Status</TableHead>
                      <TableHead className="w-[160px] text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading && (
                      <TableRow className={rowClass}>
                        <TableCell colSpan={6} className="text-muted-foreground">
                          Memuat data...
                        </TableCell>
                      </TableRow>
                    )}

                    {!loading && filtered.length === 0 && (
                      <TableRow className={rowClass}>
                        <TableCell colSpan={6} className="py-10">
                          <div className="flex flex-col items-center gap-2 text-center">
                            <p className="text-sm text-muted-foreground">Tidak ada data untuk filter/pencarian ini.</p>
                            <Button onClick={() => setOpenCreate(true)} className="gap-2">
                              <Plus className="h-4 w-4" />
                              Tambah Talenta
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {!loading &&
                      paged.map((s) => {
                        const hierarchy = [
                          s.type?.name ?? "-",
                          s.fieldLabel ?? "-",
                          s.categoryLabel ?? "-",
                          s.subCategoryLabel ?? "-",
                        ].join(" / ");

                        const { shown, more } = compactTags(s.tagsLabel ?? [], 3);
                        const scores = computeScores(s);

                        const hasRejection = s.status === "REJECTED" && !!s.rejectionNote?.trim();
                        const uiStatus = uiStatusOf(s);

                        return (
                          <TableRow
                            key={s.id}
                            className={`cursor-pointer transition-colors hover:bg-muted/50 ${rowClass}`}
                            onClick={() => setSelected(s)}
                          >
                            <TableCell>
                              <div className="text-xs text-muted-foreground leading-4">
                                {hierarchy}
                              </div>
                              <div className="text-sm font-semibold leading-5">{s.activityName}</div>
                            </TableCell>

                            <TableCell>
                              {shown.length ? (
                                <div className="flex flex-wrap gap-2">
                                  {shown.slice(0, 2).map((t) => (
                                    <Badge
                                      key={t}
                                      variant="secondary"
                                      className="rounded-full px-2.5 py-0.5 text-xs max-w-[140px] truncate"
                                      title={t}
                                    >
                                      {t}
                                    </Badge>
                                  ))}
                                  {more > 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="rounded-full px-2.5 py-0.5 text-xs text-muted-foreground"
                                      title={(s.tagsLabel ?? []).join(", ")}
                                    >
                                      +{more} lagi
                                    </Badge>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              <span
                                className="tabular-nums font-semibold"
                                title={scores.isNewModel ? "Skor akhir (weighted)" : "Skor lama (fallback scoreEntries)"}
                              >
                                {Number(scores.totalSkor).toFixed(1)}
                              </span>
                            </TableCell>

                            <TableCell className="text-center whitespace-nowrap">{statusBadge(uiStatus)}</TableCell>

                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="border-muted-500 text-muted-500 hover:bg-muted-50"
                                  onClick={() => setSelected(s)}
                                  title="Detail"
                                >
                                  <Eye className="h-4 w-4" strokeWidth={2.75} absoluteStrokeWidth />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                                  onClick={() => handlePrintSingle(s)}
                                  title="Cetak"
                                >
                                  <Printer className="h-4 w-4" strokeWidth={2.75} absoluteStrokeWidth />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="border-red-400 text-red-400 hover:bg-red-50 hover:text-red-400 hover:border-red-400"
                                  onClick={() => setDeleteTarget(s)}
                                  title="Delete"
                                  disabled={s.status !== "PENDING"}
                                >
                                  <Trash2 className="h-4 w-4" strokeWidth={2.75} absoluteStrokeWidth />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {!loading && filtered.length > 0 && totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                <div className="text-muted-foreground">
                  Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalFiltered)} dari {totalFiltered} data
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Prev
                  </Button>

                  {paginationRange.map((p) => (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <DetailTalentaUserModal
          open={!!selected}
          onOpenChange={() => setSelected(null)}
          onResubmit={doResubmit}
          submission={selected}
          photoUrl={me?.photoUrl ?? null}
          gtkName={me?.name ?? null}
          schoolName={me?.schoolName ?? null}
        />

        <CreateTalentaUserModal
          open={openCreate}
          onOpenChange={setOpenCreate}
          onCreated={async (_result: CreateSubmissionResult) => {
            await loadData();
          }}
        />
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Aksi ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={handleDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
