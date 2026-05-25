"use client";

import type { UserRole } from "@/lib/types/role";

import { Users, School, Award, BadgeCheck } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid } from "recharts";

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

const metricsData = [
  { label: "Total Sekolah", value: "237", icon: School },
  { label: "Total GTK", value: "987", icon: Users },
  { label: "Total Talenta", value: "38", icon: Award },
  { label: "Talenta Terverifikasi", value: "1,423", icon: BadgeCheck },
];

const talentTypeData = [
  { name: "Peserta Kegiatan", total: 420 },
  { name: "Narasumber Kegiatan", total: 85 },
  { name: "Peserta Lomba", total: 260 },
  { name: "Pembimbing Lomba", total: 140 },
  { name: "Minat / Bakat", total: 560 },
];

const talentFieldData = [
  { name: "Keagamaan", total: 120 },
  { name: "Akademik", total: 320 },
  { name: "Inovasi", total: 95 },
  { name: "Bahasa & Sastra", total: 180 },
  { name: "Teknologi", total: 260 },
  { name: "Seni", total: 210 },
  { name: "Olahraga", total: 190 },
  { name: "Sosial", total: 140 },
  { name: "Kepemimpinan", total: 110 },
  { name: "Kewirausahaan", total: 90 },
  { name: "Lainnya", total: 45 },
];

const recentActivity = [
  { name: "Ahmad Fauzi", school: "SMKN 4 Malang", type: "guru" },
  { name: "Siti Rahmawati", school: "SMKN 4 Malang", type: "tendik" },
  { name: "Budi Santoso", school: "SMKN 4 Malang", type: "kepala" },
  { name: "Dewi Lestari", school: "SMKN 4 Malang", type: "guru" },
  { name: "Rizky Pratama", school: "SMKN 4 Malang", type: "tendik" },
];

const talentTypeChartConfig = {
  total: { label: "Jumlah Talenta", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const talentFieldChartConfig = {
  total: { label: "Jumlah Talenta", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

export default function DashboardClient({ role }: { role: UserRole }) {
  return (
    <DashboardLayout role={role} userName="User">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Informasi Umum
          </h1>
          <p className="text-gray-600">Ringkasan data SIPODI</p>
        </div>

        <div className="grid grid-cols-4 gap-6">
          {metricsData.map((metric, index) => (
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

        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribusi Talenta</CardTitle>
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

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>GTK Terbaru</CardTitle>
              </CardHeader>

              <CardContent className="p-0">
                {recentActivity.map((item, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-4 border-b last:border-b-0 hover:bg-muted/40"
                  >
                    <div>
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.school}
                      </div>
                    </div>

                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        item.type === "guru"
                          ? "bg-blue-100 text-blue-700"
                          : item.type === "tendik"
                          ? "bg-green-100 text-green-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {item.type === "guru"
                        ? "Guru"
                        : item.type === "tendik"
                        ? "Tendik"
                        : "Kepala"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
