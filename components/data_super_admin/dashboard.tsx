"use client";

import { useEffect, useState, useMemo } from "react";
import type { UserRole } from "@/lib/types/role";

import { Users, School, Award, BadgeCheck, Trophy } from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

import DashboardLayout from "@/components/dashboard-layout";
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

type DashboardResponse = {
  totalSchools: number;
  totalGtks: number;
  totalTalents: number;
  totalVerifiedTalents: number;
  totalScoredTalents: number;
  gtkByLevel: { level: "SMA" | "SMK" | "SLB"; total: number }[];
  gtkByCity: { city: string; total: number }[];
  talentByType: { name: string; total: number }[];
  talentByField: { name: string; total: number }[];
  recentGtks: {
    nik: string;
    name: string;
    type: string | null;
    schoolName: string;
    schoolCity: string;
  }[];

  sekolahTopRate: {
    npsn: string;
    name: string;
    city: string;
    totalGtk: number;
    totalTalentaDinilai: number;
    rate: number;
  }[];
  gtkTopScore: {
    nik: string;
    name: string;
    schoolName: string;
    schoolCity: string;
    avgScore: number;
    totalTalentaDinilai: number;
  }[];
  gtkTopTalenta: {
    nik: string;
    name: string;
    schoolName: string;
    schoolCity: string;
    totalTalentaDinilai: number;
  }[];
  recentTalents: {
    id: string;
    typeName: string;
    activityName: string;
    gtkName: string;
    gtkType: "GURU" | "TENDIK" | "KEPALA_SEKOLAH" | "KEPALA_SEKSI" | "KEPALA_CABANG_DINAS" | null;
  }[];
};

const talentTypeChartConfig = {
  total: { label: "Jumlah Talenta", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const talentFieldChartConfig = {
  total: { label: "Jumlah Talenta", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

function pushLainnyaToEnd<T extends { name: string }>(arr: T[]) {
  const idx = arr.findIndex(
    (x) => x.name?.trim().toLowerCase() === "lainnya"
  );
  if (idx === -1) return arr;

  const copy = arr.slice();
  const [item] = copy.splice(idx, 1);
  copy.push(item);
  return copy;
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

  // Peserta pelatihan/workshop/seminar/upskilling
  if (s.includes("peserta") && (s.includes("pelatihan") || s.includes("workshop") || s.includes("seminar") || s.includes("upskilling"))) {
    return "Peserta (Pelatihan / Workshop / Seminar / Upskilling)";
  }

  // Narasumber/Ahli pelatihan/workshop/seminar/upskilling
  if ((s.includes("narasumber") || s.includes("ahli")) && (s.includes("pelatihan") || s.includes("workshop") || s.includes("seminar") || s.includes("upskilling"))) {
    return "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)";
  }

  // Pembimbing lomba
  if (s.includes("pembimbing") && s.includes("lomba")) {
    return "Pembimbing Lomba";
  }

  // Peserta lomba
  if (s.includes("peserta") && s.includes("lomba")) {
    return "Peserta Lomba";
  }

  // Minat/bakat/lainnya
  if (s.includes("minat") || s.includes("bakat") || s.includes("lainnya")) {
    return "Minat / Bakat / Lainnya";
  }

  // fallback: biar kelihatan kalau ada value baru yang belum dimapping
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
  return lines.slice(0, 2); // batasi 2 baris biar rapi
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

function gtkTypeLabel(t: DashboardResponse["recentTalents"][number]["gtkType"]) {
  if (t === "GURU") return "guru";
  if (t === "TENDIK") return "tendik";
  if (t === "KEPALA_SEKOLAH") return "kepsek";
  if (t === "KEPALA_SEKSI") return "kasi";
  if (t === "KEPALA_CABANG_DINAS") return "kacabdin";
  return "gtk";
}

function gtkTypeBadgeClass(t: DashboardResponse["recentTalents"][number]["gtkType"]) {
  if (t === "GURU") return "bg-blue-100 text-blue-700";
  if (t === "TENDIK") return "bg-green-100 text-green-700";
  if (t === "KEPALA_SEKOLAH") return "bg-purple-100 text-purple-700";
  return "bg-muted text-muted-foreground";
}

export default function DashboardClient({
  role,
  userName,
}: {
  role: UserRole;
  userName: string;
}) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const talentTypeDataRaw = data?.talentByType ?? [];
  const talentFieldDataRaw = data?.talentByField ?? [];
  const recentTalents = (data?.recentTalents ?? []).slice(0, 10);

  const talentTypeData = useMemo(() => {
    const map = new Map<string, number>();

    for (const r of talentTypeDataRaw) {
      const label = normalizeTalentTypeLabel(r.name);
      map.set(label, (map.get(label) ?? 0) + (r.total ?? 0));
    }

    const allLabels = [
      "Peserta (Pelatihan / Workshop / Seminar / Upskilling)",
      "Narasumber / Ahli (Pelatihan / Workshop / Seminar / Upskilling)",
      "Pembimbing Lomba",
      "Peserta Lomba",
      "Minat / Bakat / Lainnya",
    ];

    const arr = allLabels.map((label) => ({
      name: label,
      total: map.get(label) ?? 0,
    }));

    arr.sort((a, b) => (TALENT_TYPE_ORDER[a.name] ?? 999) - (TALENT_TYPE_ORDER[b.name] ?? 999));

    return arr;
  }, [talentTypeDataRaw]);

  const talentFieldData = useMemo(
    () => pushLainnyaToEnd(talentFieldDataRaw),
    [talentFieldDataRaw]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch("/api/super-admin/dashboard", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          console.error("dashboard error:", json);
          return;
        }
        if (mounted) setData(json);
      })
      .catch((e) => {
        console.error("dashboard fetch error:", e);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    return [
      {
        label: "Total Sekolah",
        value: data ? data.totalSchools.toLocaleString("id-ID") : "-",
        icon: School,
      },
      {
        label: "Total GTK",
        value: data ? data.totalGtks.toLocaleString("id-ID") : "-",
        icon: Users,
      },
      {
        label: "Total Talenta",
        value: data ? data.totalTalents.toLocaleString("id-ID") : "-",
        icon: Award,
      },
      {
        label: "Talenta Terverifikasi",
        value: data ? data.totalVerifiedTalents.toLocaleString("id-ID") : "-",
        icon: BadgeCheck,
      },
      {
        label: "Talenta Dinilai",
        value: data ? data.totalScoredTalents.toLocaleString("id-ID") : "-",
        icon: Trophy,
      },
    ];
  }, [data]);

  const recentActivity = (data?.recentGtks ?? []).slice(0, 10);
  const gtkByLevel = data?.gtkByLevel ?? [];
  const gtkByCity = data?.gtkByCity ?? [];
  const sekolahTopRate = (data?.sekolahTopRate ?? []).slice(0, 10);
  const gtkTopScore = (data?.gtkTopScore ?? []).slice(0, 10);
  const gtkTopTalenta = (data?.gtkTopTalenta ?? []).slice(0, 10);

  return (
    <DashboardLayout role={role} userName={userName}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Informasi Umum
          </h1>
          <p className="text-gray-600">
            Ringkasan data SIPODI {loading ? "(memuat...)" : ""}
          </p>
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {metrics.map((metric, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <metric.icon className="w-6 h-6 mb-3 text-muted-foreground" />
                <div className="text-2xl font-semibold">{metric.value}</div>
                <div className="text-sm text-muted-foreground">
                  {metric.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* TALENT BAR CHARTS */}
          <div className="xl:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Jenis dan Bidang Talenta</CardTitle>
                <CardDescription>
                  Ringkasan talenta berdasarkan jenis dan bidang
                </CardDescription>
              </CardHeader>

              <Tabs defaultValue="jenis" className="w-full">
                <CardContent>
                  <TabsList className="mb-4">
                    <TabsTrigger value="jenis">Jenis Talenta</TabsTrigger>
                    <TabsTrigger value="bidang">Bidang Talenta</TabsTrigger>
                  </TabsList>

                  <TabsContent value="jenis">
                    <ChartContainer
                      config={talentTypeChartConfig}
                      className="h-80 w-full"
                    >
                      <BarChart data={talentTypeData}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          height={60}
                          tick={<XAxisTickWrap />}
                        />
                        <YAxis tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                          {talentTypeData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={`hsl(var(--chart-${(i % 5) + 1}))`}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </TabsContent>

                  <TabsContent value="bidang">
                    <ChartContainer
                      config={talentFieldChartConfig}
                      className="h-80 w-full"
                    >
                      <BarChart data={talentFieldData}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          angle={-30}
                          height={70}
                          textAnchor="end"
                        />
                        <YAxis tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                          {talentFieldData.map((_, i) => (
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
          </div>

        </div>

        {/* PIE CHARTS GTK */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>GTK per Jenjang</CardTitle>
              <CardDescription>
                Distribusi jumlah GTK berdasarkan jenjang sekolah
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {gtkByLevel.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Belum ada data GTK.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip />
                    <Pie
                      data={gtkByLevel}
                      dataKey="total"
                      nameKey="level"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {gtkByLevel.map((_, index) => (
                        <Cell
                          key={index}
                          fill={`hsl(var(--chart-${(index % 5) + 1}))`}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GTK per Kota</CardTitle>
              <CardDescription>
                Distribusi jumlah GTK berdasarkan kota sekolah
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {gtkByCity.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Belum ada data GTK.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip />
                    <Pie
                      data={gtkByCity}
                      dataKey="total"
                      nameKey="city"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {gtkByCity.map((_, index) => (
                        <Cell
                          key={index}
                          fill={`hsl(var(--chart-${(index % 5) + 1}))`}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* TOP 10 (DINILAI) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sekolah dengan Rate Tertinggi */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle>10 Teratas Rate Sekolah</CardTitle>
              <CardDescription>
                Talenta yang sudah dinilai.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-rounded-full scrollbar-thumb-muted/60 hover:scrollbar-thumb-muted transition-shadow duration-300 hover:shadow-sm">
                {sekolahTopRate.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">Belum ada data.</div>
                )}

                {sekolahTopRate.map((s) => (
                  <div
                    key={s.npsn}
                    className="flex justify-between items-center p-4 border-b last:border-b-0 hover:bg-muted/40 transition-colors duration-150"
                  >
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.city} • GTK: {s.totalGtk.toLocaleString("id-ID")} • Dinilai:{" "}
                        {s.totalTalentaDinilai.toLocaleString("id-ID")}
                      </div>
                    </div>

                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 tabular-nums">
                      {s.rate.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* GTK dengan Skor Tertinggi */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle>10 Teratas Skor GTK</CardTitle>
              <CardDescription>
                Rata-rata skor dari talenta yang sudah dinilai.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-rounded-full scrollbar-thumb-muted/60 hover:scrollbar-thumb-muted transition-shadow duration-300 hover:shadow-sm">
                {gtkTopScore.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">Belum ada data.</div>
                )}

                {gtkTopScore.map((g) => (
                  <div
                    key={g.nik}
                    className="flex justify-between items-center p-4 border-b last:border-b-0 hover:bg-muted/40 transition-colors duration-150"
                  >
                    <div>
                      <div className="text-sm font-medium">{g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {g.schoolName} – {g.schoolCity} • Dinilai:{" "}
                        {g.totalTalentaDinilai.toLocaleString("id-ID")}
                      </div>
                    </div>

                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 tabular-nums">
                      {g.avgScore.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* GTK dengan Talenta Terbanyak */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle>10 Teratas Talenta GTK</CardTitle>
              <CardDescription>
                Jumlah talenta yang sudah dinilai.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-rounded-full scrollbar-thumb-muted/60 hover:scrollbar-thumb-muted transition-shadow duration-300 hover:shadow-sm">
                {gtkTopTalenta.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">Belum ada data.</div>
                )}

                {gtkTopTalenta.map((g) => (
                  <div
                    key={g.nik}
                    className="flex justify-between items-center p-4 border-b last:border-b-0 hover:bg-muted/40 transition-colors duration-150"
                  >
                    <div>
                      <div className="text-sm font-medium">{g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {g.schoolName} – {g.schoolCity}
                      </div>
                    </div>

                    <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 tabular-nums">
                      {g.totalTalentaDinilai.toLocaleString("id-ID")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* GTK TERBARU + TALENTA TERBARU (1 ROW) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* KIRI: GTK Terbaru (10) - existing, saya copy dari Anda */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle>GTK Terbaru (10)</CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-rounded-full scrollbar-thumb-muted/60 hover:scrollbar-thumb-muted transition-shadow duration-300 hover:shadow-sm">
                {recentActivity.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">
                    Belum ada GTK.
                  </div>
                )}

                {recentActivity.map((item) => {
                  const typeLabel =
                    item.type === "GURU"
                      ? "Guru"
                      : item.type === "TENDIK"
                        ? "Tendik"
                        : item.type === "KEPALA_SEKOLAH"
                          ? "Kepala Sekolah"
                          : "GTK";

                  const typeClass =
                    item.type === "GURU"
                      ? "bg-blue-100 text-blue-700"
                      : item.type === "TENDIK"
                        ? "bg-green-100 text-green-700"
                        : "bg-purple-100 text-purple-700";

                  return (
                    <div
                      key={item.nik}
                      className="flex justify-between items-center p-4 border-b last:border-b-0 hover:bg-muted/40 transition-colors duration-150"
                    >
                      <div>
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.schoolName} – {item.schoolCity}
                        </div>
                      </div>

                      <span className={`text-xs px-2 py-1 rounded-full ${typeClass}`}>
                        {typeLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* KANAN: Talenta Terbaru (10) - NEW */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Talenta Terbaru (10)</CardTitle>
              <CardDescription>
                Talenta yang sudah diverifikasi admin sekolah.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-rounded-full scrollbar-thumb-muted/60 hover:scrollbar-thumb-muted transition-shadow duration-300 hover:shadow-sm">
                {recentTalents.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">
                    Belum ada talenta.
                  </div>
                )}

                {recentTalents.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 border-b last:border-b-0 hover:bg-muted/40 transition-colors duration-150"
                  >
                    {/* baris 1: jenis talenta (kecil) */}
                    <div className="text-xs text-muted-foreground">
                      {t.typeName}
                    </div>

                    {/* baris 2: nama kegiatan (lebih besar + bold) */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">
                        {t.activityName}
                      </div>

                      <span
                        className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${gtkTypeBadgeClass(t.gtkType)}`}
                      >
                        {gtkTypeLabel(t.gtkType)}
                      </span>
                    </div>

                    {/* baris 3: nama GTK (kecil) */}
                    <div className="text-xs text-muted-foreground">
                      {t.gtkName}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
