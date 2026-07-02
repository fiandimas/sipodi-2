"use client";

import { useEffect, useMemo, useState } from "react";
import { Presentation, User, Trophy, Users, Star } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid } from "recharts";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type ChartItem = { label: string; value: number };

type AdminTalentaStats = {
  totalGtk: number;

  totalVerifiedSubmissions: number;
  avgVerifiedTalentaPerGtk: number;

  totalScoredSubmissions: number;
  totalScoredPoints: number;
  avgScoredPointsPerGtk: number;

  chartByStatus: ChartItem[];
  chartApprovedByType: ChartItem[];
  chartApprovedByField: ChartItem[];
  range?: { from: string | null; to: string | null; mode?: string };
};

const byTypeChartConfig = {
  value: { label: "Jumlah", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const byFieldChartConfig = {
  value: { label: "Jumlah", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

function truncateLabel(label: string, max: number) {
  if (label.length <= max) return label;
  return label.slice(0, max - 1) + "…";
}

function formatNumber(n: number) {
  return n.toLocaleString("id-ID");
}

const TALENT_TYPE_ORDER: Record<string, number> = {
  "Peserta (Pelatihan / Workshop / Seminar / Upskilling)": 1,
  "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)": 2,
  "Pembimbing Lomba": 3,
  "Peserta Lomba": 4,
  "Minat / Bakat / Lainnya": 5,
};

const iconMap: Record<string, { icon: React.ElementType; color: string }> = {
  "Peserta (Pelatihan / Workshop / Seminar / Upskilling)": { icon: Presentation, color: "#3B82F6" },
  "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)": { icon: User, color: "#2DD4BF" },
  "Pembimbing Lomba": { icon: Trophy, color: "#F59E0B" },
  "Peserta Lomba": { icon: Users, color: "#EC4899" },
  "Minat / Bakat / Lainnya": { icon: Star, color: "#A855F7" },
};

function normalizeTalentTypeLabel(raw: string) {
  const s = (raw ?? "").trim().toLowerCase();

  if (
    s.includes("peserta") &&
    (s.includes("pelatihan") || s.includes("workshop") || s.includes("seminar") || s.includes("upskilling"))
  ) return "Peserta (Pelatihan / Workshop / Seminar / Upskilling)";

  if (
    (s.includes("narasumber") || s.includes("ahli")) &&
    (s.includes("pelatihan") || s.includes("workshop") || s.includes("seminar") || s.includes("upskilling"))
  ) return "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)";

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
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2); // max 2 baris
}

function XAxisTickWrap({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const value = String(payload?.value ?? "");
  const lines = wrapWords(value, 18);
  const item = iconMap[value];
  const Icon = item?.icon;

  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      {Icon && (
        <foreignObject x={-14} y={4} width={28} height={28}>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${item.color}20` }}
          >
            <Icon className="w-4 h-4" style={{ color: item.color }} />
          </div>
        </foreignObject>
      )}
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="hanging"
        fontSize={12}
        fill="hsl(var(--muted-foreground))"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 40 : 14}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

type UiStatusKey = "DINILAI" | "TERVERIFIKASI" | "DITINJAU_ULANG";

const STATUS_ORDER: UiStatusKey[] = ["DINILAI", "TERVERIFIKASI", "DITINJAU_ULANG"];

const STATUS_META: Record<UiStatusKey, { label: string; cls: string }> = {
  DINILAI: { label: "Dinilai", cls: "bg-emerald-50 text-emerald-700" },
  TERVERIFIKASI: { label: "Terverifikasi", cls: "bg-sky-50 text-sky-700" },
  DITINJAU_ULANG: { label: "Ditinjau Ulang", cls: "bg-rose-50 text-rose-700" },
};

export default function DashboardClient() {
  const [data, setData] = useState<AdminTalentaStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin-talenta/dashboard-stats", {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Gagal memuat dashboard");
        setData(json as AdminTalentaStats);
      } catch (e) {
        console.error(e);
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    const raw = data?.chartApprovedByField ?? [];

    const m = new Map<string, number>();
    for (const x of raw) {
      const key = (x.label ?? "").trim();
      const label = key === "" ? "Lainnya" : key; // kalau ada yang kosong
      m.set(label, (m.get(label) ?? 0) + (x.value ?? 0));
    }

    const rows = Array.from(m.entries()).map(([name, value]) => ({
      name,
      shortName: truncateLabel(name, 18),
      value,
    }));

    rows.sort((a, b) => b.value - a.value);

    const TOP = 10;

    if (rows.length <= TOP) return rows;

    const top = rows.slice(0, TOP);
    const rest = rows.slice(TOP);

    const restSum = rest.reduce((sum, r) => sum + r.value, 0);
    if (restSum <= 0) return top;

    const idxLainnya = top.findIndex((x) => x.name.trim().toLowerCase() === "lainnya");
    if (idxLainnya >= 0) {
      const copy = top.slice();
      copy[idxLainnya] = {
        ...copy[idxLainnya],
        value: copy[idxLainnya].value + restSum,
      };
      return copy;
    }

    return [...top, { name: "Lainnya", shortName: "Lainnya", value: restSum }];
  }, [data]);

  const statusRows = useMemo(() => {
    const m = new Map((data?.chartByStatus ?? []).map((x) => [x.label, x.value]));
    return STATUS_ORDER.map((k) => ({ key: k, value: m.get(k) ?? 0 }));
  }, [data]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Chart distribusi jenis/bidang + status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Jenis dan Bidang Talenta</CardTitle>
            <CardDescription>
              Distribusi berdasarkan jenis dan bidang (Status Dinilai).
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
                    Total dinilai:
                    <span className="tabular-nums ml-1">
                      {formatNumber(data?.totalScoredSubmissions ?? 0)}
                    </span>
                  </Badge>
                ) : (
                  <Skeleton className="h-6 w-40" />
                )}
              </div>

              <TabsContent value="jenis" className="mt-0">
                <ChartContainer
                  config={byTypeChartConfig}
                  className="h-[320px] w-full"
                >
                  <BarChart
                    data={typeChartData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 28 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      height={76}
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
              </TabsContent>

              <TabsContent value="bidang" className="mt-0">
                <ChartContainer
                  config={byFieldChartConfig}
                  className="h-[320px] w-full"
                >
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
                      height={100}
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
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Status Submission</CardTitle>
            <CardDescription>
              Total per status untuk semua jenis & bidang.
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
  );
}
