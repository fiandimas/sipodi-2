"use client";

import { useEffect, useMemo, useState } from "react";
import type { UserRole } from "@/lib/types/role";

import {
  Users,
  Award,
  BadgeCheck,
  School as SchoolIcon,
  RefreshCcw,
  CalendarRange,
} from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid } from "recharts";

import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";

import type { DateRange } from "react-day-picker";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

type ChartItem = { label: string; value: number };

type DashboardStats = {
  school: { name: string; npsn: string; headName: string | null; headNip: string | null };
  totalGtk: number;

  totalVerifiedSubmissions: number;
  avgVerifiedTalentaPerGtk: number;

  totalScoredPoints: number;
  avgScoredPointsPerGtk: number;

  chartByStatus: ChartItem[];
  chartApprovedByType: ChartItem[];
  chartApprovedByField: ChartItem[];

  range?: { from: string | null; to: string | null; mode?: string };
};

type Preset = "THIS_MONTH" | "7D" | "30D" | "3M" | "1Y" | "ALL" | "CUSTOM";

const byTypeChartConfig = {
  value: { label: "Jumlah", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const byFieldChartConfig = {
  value: { label: "Jumlah", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

function formatNumber(n: number) {
  return n.toLocaleString("id-ID");
}

function formatDecimal(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
}

// YYYY-MM-DD (untuk query param)
function toISODateInput(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function computePreset(p: Preset): DateRange | undefined {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (p === "ALL") return undefined;

  if (p === "THIS_MONTH") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start, to: end };
  }

  if (p === "7D") {
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return { from: start, to: end };
  }

  if (p === "30D") {
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    return { from: start, to: end };
  }

  if (p === "3M") {
    const start = new Date(end);
    start.setMonth(start.getMonth() - 3);
    return { from: start, to: end };
  }

  if (p === "1Y") {
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    return { from: start, to: end };
  }

  return undefined;
}

function presetLabel(p: Preset) {
  if (p === "THIS_MONTH") return "Bulan ini";
  if (p === "7D") return "7 hari terakhir";
  if (p === "30D") return "30 hari terakhir";
  if (p === "3M") return "3 bulan terakhir";
  if (p === "1Y") return "1 tahun terakhir";
  if (p === "ALL") return "Semua waktu";
  return "Custom";
}

function formatRangeText(from?: Date, to?: Date) {
  if (!from && !to) return "Semua waktu";
  if (from && !to) return `${toISODateInput(from)} s/d ...`;
  if (!from && to) return `... s/d ${toISODateInput(to)}`;
  return `${toISODateInput(from!)} s/d ${toISODateInput(to!)}`;
}

function truncateLabel(label: string, max: number) {
  if (label.length <= max) return label;
  return label.slice(0, max - 1) + "…";
}

function ChartEmptyState({ title }: { title: string }) {
  return (
    <div className="flex h-[320px] w-full items-center justify-center rounded-md border border-dashed bg-muted/20 px-4 text-center">
      <div className="space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">
          Tidak ada data untuk range/filter yang dipilih.
        </div>
      </div>
    </div>
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

function wrapWords(text: string, maxCharsPerLine: number) {
  const words = (text ?? "").split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxCharsPerLine) line = next;
    else { if (line) lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function XAxisTickWrap({ x, y, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const value = String(payload?.value ?? "");
  const lines = wrapWords(value, 18);

  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="hanging"
        fontSize={12}
        fill="hsl(var(--muted-foreground))"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 12 : 14}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

type UiStatusKey = "DINILAI" | "TERVERIFIKASI" | "BELUM_VERIFIKASI" | "DITINJAU_ULANG";

const STATUS_META: Record<UiStatusKey, { label: string; cls: string }> = {
  DINILAI: { label: "Dinilai", cls: "bg-emerald-50 text-emerald-700" },
  TERVERIFIKASI: { label: "Terverifikasi", cls: "bg-sky-50 text-sky-700" },
  BELUM_VERIFIKASI: { label: "Belum Verifikasi", cls: "bg-amber-50 text-amber-700" },
  DITINJAU_ULANG: { label: "Ditinjau Ulang", cls: "bg-rose-50 text-rose-700" },
};

const STATUS_ORDER: UiStatusKey[] = ["DINILAI", "TERVERIFIKASI", "BELUM_VERIFIKASI", "DITINJAU_ULANG"];

export default function DashboardAdminSekolah({
  role,
  userName,
}: {
  role: UserRole;
  userName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardStats | null>(null);

  function pushLainnyaToEnd<T extends { name: string }>(arr: T[]) {
    const idx = arr.findIndex((x) => x.name?.trim().toLowerCase() === "lainnya");
    if (idx === -1) return arr;

    const copy = arr.slice();
    const [item] = copy.splice(idx, 1);
    copy.push(item);
    return copy;
  }

  const { toast } = useToast();

  // range filter (modern)
  const [preset, setPreset] = useState<Preset>("THIS_MONTH");
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [rangeOpen, setRangeOpen] = useState(false);

  const load = async (mode: "init" | "refresh" = "init", r?: DateRange) => {
    const effective = r ?? range;

    try {
      mode === "init" ? setLoading(true) : setRefreshing(true);
      setError(null);

      const qs = new URLSearchParams();
      if (effective?.from) qs.set("from", toISODateInput(effective.from));
      if (effective?.to) qs.set("to", toISODateInput(effective.to));

      const url = `/api/admin-sekolah/dashboard-stats${qs.toString() ? `?${qs}` : ""
        }`;

      const res = await fetch(url, { method: "GET", cache: "no-store" });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? "Gagal memuat dashboard");

      setData(json as DashboardStats);
    } catch (e: any) {
      setError(e?.message ?? "Gagal memuat dashboard");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // default: Bulan ini
  useEffect(() => {
    const r = computePreset("THIS_MONTH");
    setRange(r);
    load("init", r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeText = useMemo(
    () => formatRangeText(range?.from, range?.to),
    [range]
  );

  const typeChartData = useMemo(() => {
    const raw = data?.chartApprovedByType ?? [];

    const m = new Map<string, number>();
    for (const x of raw) {
      const label = normalizeTalentTypeLabel(x.label);
      m.set(label, (m.get(label) ?? 0) + (x.value ?? 0));
    }

    const ordered = Object.keys(TALENT_TYPE_ORDER).map((label) => ({
      name: label,
      value: m.get(label) ?? 0,
    }));

    return ordered;
  }, [data]);

  const fieldChartData = useMemo(() => {
    const rows = (data?.chartApprovedByField ?? []).map((x) => ({
      name: x.label,
      shortName: truncateLabel(x.label, 18),
      value: x.value,
    }));

    const TOP = 10;

    let result = rows;
    if (rows.length > TOP) {
      const top = rows.slice(0, TOP);
      const rest = rows.slice(TOP).reduce((sum, r) => sum + r.value, 0);
      result = [...top, { name: "Lainnya", shortName: "Lainnya", value: rest }];
    }

    return pushLainnyaToEnd(result);
  }, [data]);

  const schoolTitle = data?.school?.name ?? "Dashboard Sekolah";

  const statusRows = useMemo(() => {
    const m = new Map((data?.chartByStatus ?? []).map((x) => [x.label, x.value]));
    return STATUS_ORDER.map((k) => ({ key: k, value: m.get(k) ?? 0 }));
  }, [data]);

  const applyRange = () => {
    if (preset !== "ALL") {
      if (!range?.from || !range?.to) {
        toast({
          variant: "destructive",
          title: "Range belum lengkap",
          description: "Pilih tanggal awal dan akhir terlebih dahulu.",
        });
        return;
      }
      if (range.from > range.to) {
        toast({
          variant: "destructive",
          title: "Range tidak valid",
          description:
            "Tanggal awal tidak boleh lebih besar dari tanggal akhir.",
        });
        return;
      }
    }
    load("refresh");
    setRangeOpen(false);
  };

  const resetThisMonth = () => {
    const r = computePreset("THIS_MONTH");
    setPreset("THIS_MONTH");
    setRange(r);
    load("refresh", r);
  };

  return (
    <DashboardLayout role={role} userName={userName}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Informasi Umum
              </h1>
              <p className="text-sm text-muted-foreground">
                Ringkasan data SIPODI Untuk Sekolah Anda.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Badge
                variant="outline"
                className="gap-2 rounded-full border-slate-300/70 bg-white/70"
              >
                <SchoolIcon className="h-3.5 w-3.5" />
                {loading ? (
                  <Skeleton className="h-4 w-40" />
                ) : (
                  <span className="font-medium">{schoolTitle}</span>
                )}
              </Badge>

              <Badge variant="outline" className="rounded-full bg-white/70">
                {loading ? (
                  <Skeleton className="h-4 w-28" />
                ) : (
                  <>
                    NPSN:{" "}
                    <span className="font-medium">{data?.school.npsn}</span>
                  </>
                )}
              </Badge>

              <Badge variant="outline" className="rounded-full bg-white/70">
                {loading ? (
                  <Skeleton className="h-4 w-52" />
                ) : (
                  <>
                    Kepsek:{" "}
                    <span className="font-medium">
                      {data?.school.headName ?? "-"}
                    </span>
                  </>
                )}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Modern range control */}
            <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 shadow-sm hover:bg-white"
                >
                  <CalendarRange className="h-4 w-4 text-primary" />
                  <span className="hidden sm:inline text-xs font-medium text-muted-foreground">
                    {presetLabel(preset)}
                  </span>
                  <span className="text-xs font-semibold tabular-nums">
                    {rangeText}
                  </span>
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-[340px] p-3" align="end">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Range waktu</div>
                    <div className="text-xs text-muted-foreground">
                      Filter untuk metrik & grafik (mode: approvedAt).
                    </div>
                  </div>

                  <Select
                    value={preset}
                    onValueChange={(v) => {
                      const p = v as Preset;
                      setPreset(p);

                      if (p === "ALL") {
                        setRange(undefined);
                        return;
                      }

                      if (p === "CUSTOM") {
                        return;
                      }

                      const r = computePreset(p);
                      setRange(r);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih preset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="THIS_MONTH">Bulan ini</SelectItem>
                      <SelectItem value="7D">7 hari terakhir</SelectItem>
                      <SelectItem value="30D">30 hari terakhir</SelectItem>
                      <SelectItem value="3M">3 bulan terakhir</SelectItem>
                      <SelectItem value="1Y">1 tahun terakhir</SelectItem>
                      <SelectItem value="ALL">Semua waktu</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="rounded-md border">
                    <Calendar
                      mode="range"
                      selected={range}
                      onSelect={(r) => {
                        setPreset("CUSTOM");
                        setRange(r);
                      }}
                      numberOfMonths={1}
                      initialFocus
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={applyRange}
                      disabled={loading || refreshing}
                      title="Ambil data sesuai range"
                    >
                      Terapkan
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={resetThisMonth}
                      disabled={loading || refreshing}
                      title="Kembali ke default (bulan ini)"
                    >
                      Reset
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Aktif:{" "}
                    <span className="font-medium">{presetLabel(preset)}</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => load("refresh")}
              disabled={loading || refreshing}
              className="rounded-full border border-slate-200 bg-white/80 shadow-sm"
              title="Refresh dengan range saat ini"
            >
              <RefreshCcw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* Error */}
        {error ? (
          <Card className="border-destructive/30 bg-red-50/60">
            <CardHeader>
              <CardTitle className="text-base">Gagal memuat data</CardTitle>
              <CardDescription className="text-destructive">
                {error}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => load("refresh")}>
                Coba lagi
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-slate-200/80 bg-white/80 shadow-sm">
            <CardContent className="p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Users className="w-5 h-5 text-sky-500" />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  GTK
                </span>
              </div>
              <div className="text-3xl font-semibold tracking-tight">
                {loading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  formatNumber(data?.totalGtk ?? 0)
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Jumlah GTK Pada Sekolah {schoolTitle}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 bg-white/80 shadow-sm">
            <CardContent className="p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Award className="w-5 h-5 text-emerald-500" />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Terverifikasi
                </span>
              </div>

              <div className="text-3xl font-semibold tracking-tight">
                {loading ? <Skeleton className="h-7 w-24" /> : formatNumber(data?.totalVerifiedSubmissions ?? 0)}
              </div>

              <div className="text-xs text-muted-foreground">
                Talenta yang sudah diverifikasi sekolah
              </div>
            </CardContent>
          </Card>

          {/* CARD BARU: Rerata talenta/GTK */}
          <Card className="border border-slate-200/80 bg-white/80 shadow-sm">
            <CardContent className="p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <BadgeCheck className="w-5 h-5 text-cyan-500" />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Rerata Talenta
                </span>
              </div>
              <div className="text-3xl font-semibold tracking-tight">
                {loading ? (
                  <Skeleton className="h-7 w-28" />
                ) : (
                  formatDecimal(data?.avgVerifiedTalentaPerGtk ?? 0)
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Rerata Talenta Terverifikasi Per GTK
              </div>
            </CardContent>
          </Card>

          {/* Card poin tetap seperti sebelumnya */}
          <Card className="border border-slate-200/80 bg-white/80 shadow-sm">
            <CardContent className="p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <BadgeCheck className="w-5 h-5 text-indigo-500" />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Rata-rata poin
                </span>
              </div>
              <div className="text-3xl font-semibold tracking-tight">
                {loading ? <Skeleton className="h-7 w-28" /> : formatDecimal(data?.avgScoredPointsPerGtk ?? 0)}
              </div>

              <div className="text-xs text-muted-foreground">
                Rerata Poin Per GTK (Dinilai)
              </div>

              {!loading ? (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Total poin dinilai:{" "}
                  <span className="font-medium">{formatNumber(data?.totalScoredPoints ?? 0)}</span>
                </div>
              ) : (
                <div className="mt-2">
                  <Skeleton className="h-4 w-44" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border border-slate-200/80 bg-white/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Jenis dan Bidang Talenta</CardTitle>
              <CardDescription>
                Distribusi berdasarkan jenis dan bidang talenta.
              </CardDescription>
            </CardHeader>

            <Tabs defaultValue="jenis" className="w-full">
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <TabsList className="w-fit rounded-full bg-slate-100 p-1">
                    <TabsTrigger
                      value="jenis"
                      className="rounded-full px-3 py-1 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Jenis Talenta
                    </TabsTrigger>
                    <TabsTrigger
                      value="bidang"
                      className="rounded-full px-3 py-1 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Bidang Talenta
                    </TabsTrigger>
                  </TabsList>

                  {!loading ? (
                    <Badge variant="secondary" className="w-fit rounded-full">
                      Total dinilai:{" "}
                      <span className="tabular-nums ml-1">
                        {formatNumber(data?.chartApprovedByType?.reduce((a, x) => a + (x.value ?? 0), 0) ?? 0)}
                      </span>
                    </Badge>
                  ) : (
                    <Skeleton className="h-6 w-40" />
                  )}
                </div>

                <TabsContent value="jenis" className="mt-0">
                  {loading ? (
                    <Skeleton className="h-[320px] w-full" />
                  ) : typeChartData.length === 0 ? (
                    <ChartEmptyState title="Belum ada data jenis talenta" />
                  ) : (
                    <ChartContainer config={byTypeChartConfig} className="h-[320px] w-full">
                      <BarChart data={typeChartData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          height={72}
                          tick={<XAxisTickWrap />}
                        />
                        <YAxis tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {typeChartData.map((_, i) => (
                            <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </TabsContent>

                <TabsContent value="bidang" className="mt-0">
                  {loading ? (
                    <Skeleton className="h-[320px] w-full" />
                  ) : fieldChartData.length === 0 ? (
                    <ChartEmptyState title="Belum ada data bidang talenta" />
                  ) : (
                    <ChartContainer config={byFieldChartConfig} className="h-[320px] w-full">
                      <BarChart data={fieldChartData}>
                        <CartesianGrid
                          vertical={false}
                          strokeDasharray="3 3"
                          stroke="#e5e7eb"
                        />
                        <XAxis
                          dataKey="shortName"
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          angle={-20}
                          height={70}
                          textAnchor="end"
                        />
                        <YAxis tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {fieldChartData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={`hsl(var(--chart-${(i % 5) + 1}))`}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </TabsContent>

              </CardContent>
            </Tabs>
          </Card>

          <Card className="border border-slate-200/80 bg-white/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Status Submission</CardTitle>
              <CardDescription>
                Total Status Talenta GTK Pada Semua Jenis Talenta dan Bidang.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-2">
                  {statusRows.map((x) => {
                    const meta = STATUS_META[x.key];
                    const base = "flex items-center justify-between rounded-xl px-3 py-2.5";
                    return (
                      <div key={x.key} className={`${base} ${meta.cls}`}>
                        <div className="text-xs font-semibold tracking-wide">{meta.label}</div>
                        <div className="tabular-nums text-base font-semibold">
                          {formatNumber(x.value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
