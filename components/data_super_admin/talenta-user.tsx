"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Search, Check, ChevronsUpDown } from "lucide-react";
import type { UserRole } from "@/lib/types/role";
import {
  Printer,
  Trophy,
  X,
} from "lucide-react";

import DetailTalentaUserModal, { type SubmissionItem } from "@/components/modals/detail-talenta-user";

import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

import { useParams } from "next/navigation";

import { cn } from "@/lib/utils";

type MeResponse = {
  gtk: {
    nik: string;
    name: string;
    schoolName: string;
    photoUrl?: string | null;
  } | null;
};

type SubmissionItemWithScores = SubmissionItem & {
  userScore?: number | null;
  tagScore?: number | null;
  jenisScore?: number | null;
  adminScore?: number | null;
  computedScore?: number | null;
};

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

const uiStatusOf = (s: SubmissionItem): UiStatus =>{
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

const statusBadge = (uiStatus: UiStatus) => {
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

export default function DataSuperAdminTalentaPage({ role, userName }: { role: UserRole; userName: string }) {
  const [me, setMe] = useState<MeResponse["gtk"] | null>(null);
  const { nik } = useParams();

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

  const [selected, setSelected] = useState<SubmissionItemWithScores | null>(null);

  const [page, setPage] = useState(1);
  
  const [GTKSubmissions, setGTKSubmissions] = useState<SubmissionItemWithScores[]>([]);

  const loadGTKSubmissions = async () => {
    try {
      setLoading(true);
  
      const res = await fetch(`/api/super-admin/gtk/talent-submissions/${nik}`, { method: "GET" });
      const json = await res.json();

      if (!res.ok) {
        alert(json?.error ?? "Gagal memuat data");
        return;
      }

      setGTKSubmissions((json.submissions ?? []) as SubmissionItemWithScores[]);
    } catch (e) {
      console.error(e);
      alert("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const loadTagOptions = async () => {
    try {
      const res = await fetch(`/api/super-admin/gtk/tags/${nik}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as TagsApiResponse;

      setTagPriority(json.priority ?? []);
      setTagOthers(json.others ?? []);
      setTagFree(json.free ?? []);
    } catch { }
  }

  const loadMe = async () => {
    try {
      const res = await fetch(`/api/super-admin/gtk/${nik}`, { method: "GET" });
      if (!res.ok) return setMe(null);
      const json = (await res.json()) as MeResponse;
      setMe(json.gtk);
    } catch (e) {
      console.error(e);
      setMe(null);
    }
  };

  useEffect(() => {
    loadTagOptions();
    loadGTKSubmissions();
    loadMe();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return GTKSubmissions.filter((s) => {
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
  }, [GTKSubmissions, search, status, typeId, fieldLabel]);

   const typeOptions = useMemo(() => {
      const map = new Map<string, string>();
  
      for (const s of GTKSubmissions) {
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
    }, [GTKSubmissions]);
  
    const fieldOptions = useMemo(() => {
      const set = new Set<string>();
      for (const s of GTKSubmissions) if (s.fieldLabel) set.add(s.fieldLabel);
  
      const arr = Array.from(set);
  
      arr.sort((a, b) => {
        const aIsLainnya = a.trim().toLowerCase() === "lainnya";
        const bIsLainnya = b.trim().toLowerCase() === "lainnya";
        if (aIsLainnya && !bIsLainnya) return 1;   // a ke belakang
        if (!aIsLainnya && bIsLainnya) return -1;  // b ke belakang
        return a.localeCompare(b, "id-ID");        // sisanya alfabetis
      });
  
      return ["ALL", ...arr];
    }, [GTKSubmissions]);

  const totalWeightedSum = useMemo(() =>  filtered.reduce((sum, s) => sum + computeScores(s).totalSkor, 0), [filtered]);
  
  const avgWeighted = useMemo(() => {
    if (filtered.length === 0) return 0;
    return totalWeightedSum / filtered.length;
  }, [filtered.length, totalWeightedSum]);

  const createdCount = filtered.length;

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

  const clearFilters = () => {
    setSearch("");
    setStatus("ALL");
    setTypeId("ALL");
    setFieldLabel("ALL");
    setJuara("");
    setTagIds([]);
    setTagTexts([]);
  };

  const rowClass = "h-10 [&>td]:py-2";

  return (
    <DashboardLayout role={role} userName={userName}>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Talenta {me?.name}</h1>
            <p className="text-sm text-muted-foreground">{me?.schoolName}</p>
          </div>
        </div>

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
                      <SelectItem value="ALL">Semua Status</SelectItem>
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
                      <SelectItem value="ALL">Semua Jenis</SelectItem>
                      <SelectItem value="Peserta (Pelatihan / Workshop / Seminar / Upskilling)">Peserta (Pelatihan / Workshop / Seminar / Upskilling)</SelectItem>
                      <SelectItem value="Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)">Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)</SelectItem>
                      <SelectItem value="Pembimbing Lomba">Pembimbing Lomba</SelectItem>
                      <SelectItem value="Peserta Lomba">Peserta Lomba</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={fieldLabel} onValueChange={(v) => setFieldLabel(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Bidang" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOptions.map((x) => (
                        <SelectItem key={x} value={x}>
                          {x === "ALL" ? "Semua Bidang" : x}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Popover open={tagOpen} onOpenChange={setTagOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={tagOpen} className="justify-between font-normal">
                        <span className="truncate">
                          {juara ? juara : tagIds.length ? `${tagIds.length} tag dipilih` : "Semua Tag"}
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

                  <Button variant="outline" onClick={clearFilters} className="gap-2"
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
                    {/* row 1 */}
                    

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
                            onClick={() => {}}
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
          submission={selected}
          photoUrl={me?.photoUrl ?? null}
          gtkName={me?.name ?? null}
          schoolName={me?.schoolName ?? null}
        />

      </div>
    </DashboardLayout>
  );
}
