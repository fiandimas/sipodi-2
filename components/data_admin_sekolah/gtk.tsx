"use client";

import { useEffect, useMemo, useState, useDeferredValue, useCallback } from "react";
import { Search, Plus, Edit, Trash2, Download, FileText } from "lucide-react";

import type { UserRole } from "@/lib/types/role";
import type { GTK } from "@/lib/types/gtk";

import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { toast } from "sonner";

import type { TtdInput } from "@/lib/print-utils-core";
import type { GtkPrintItem } from "@/lib/export-gtk-admin-sekolah-pdf";
import {
    renderAdminSchoolGtkPdfHtml,
    openPrintWindowAdminSchool,
} from "@/lib/export-gtk-admin-sekolah-pdf";

import { CreateGTKModalAdminSekolah } from "@/components/modals/create-gtk-admin-sekolah-modal";
import { EditGTKModalAdminSekolah } from "@/components/modals/edit-gtk-admin-sekolah-modal";
import { DeleteGTKModalAdminSekolah } from "@/components/modals/delete-gtk-admin-sekolah-modal";

const PAGE_SIZE = 20;

type GtkWithTalenta = GTK & {
    talentaCount: number;
    totalSkorDinilai: number;
};

type ApiResponse = {
    data: GtkWithTalenta[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
};

function useDebounced<T>(value: T, delay: number): T {
    const deferred = useDeferredValue(value);
    const [debounced, setDebounced] = useState(deferred);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(deferred), delay);
        return () => clearTimeout(id);
    }, [deferred, delay]);
    return debounced;
}

type PaginationToken = { type: "page"; value: number } | { type: "ellipsis"; key: string };

function buildPagination(current: number, total: number): PaginationToken[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => ({
            type: "page",
            value: i + 1,
        }));
    }
    const tokens: PaginationToken[] = [];
    const clamp = (n: number) => Math.max(1, Math.min(total, n));
    const currentPage = clamp(current);

    const first = 1;
    const last = total;

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(total - 1, currentPage + 1);

    tokens.push({ type: "page", value: first });

    if (start > 2) tokens.push({ type: "ellipsis", key: "left" });
    for (let p = start; p <= end; p++) tokens.push({ type: "page", value: p });
    if (end < total - 1) tokens.push({ type: "ellipsis", key: "right" });

    tokens.push({ type: "page", value: last });
    return tokens;
}

export default function DataGTKPage({
    role,
    userName,
    schoolNpsn,
}: {
    role: UserRole;
    userName: string;
    schoolNpsn: string;
}) {
    const [items, setItems] = useState<GtkWithTalenta[]>([]);
    const [loading, setLoading] = useState(false);

    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounced(search, 350);

    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [jenis, setJenis] = useState("all");
    const [gender, setGender] = useState("all");

    const [activeSort, setActiveSort] = useState<"score" | "talenta">("score");
    const [scoreDir, setScoreDir] = useState<"asc" | "desc">("desc");
    const [talentaDir, setTalentaDir] = useState<"asc" | "desc">("desc");

    const [scoreDirUi, setScoreDirUi] = useState<"asc" | "desc" | undefined>();
    const [talentaDirUi, setTalentaDirUi] = useState<"asc" | "desc" | undefined>();

    const [openCreate, setOpenCreate] = useState(false);
    const [openEdit, setOpenEdit] = useState(false);
    const [openDelete, setOpenDelete] = useState(false);
    const [selected, setSelected] = useState<GTK | null>(null);

    const [selectedNiks, setSelectedNiks] = useState<string[]>([]);
    const hasSelection = selectedNiks.length > 0;

    // TTD modal
    const [ttdOpen, setTtdOpen] = useState(false);
    const [ttdName, setTtdName] = useState("");
    const [ttdNip, setTtdNip] = useState("");
    const [pendingMode, setPendingMode] = useState<null | "filter" | "selected">(null);

    function validateTtd() {
        if (!ttdName.trim()) return { ok: false as const, error: "Nama wajib diisi" };
        if (!ttdNip.trim()) return { ok: false as const, error: "NIP wajib diisi" };
        return { ok: true as const, name: ttdName.trim(), nip: ttdNip.trim() };
    }

    // Load data
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();

            params.set("page", String(page));
            params.set("pageSize", String(PAGE_SIZE));

            params.set("sort", activeSort);
            params.set("dir", activeSort === "score" ? scoreDir : talentaDir);

            if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
            if (schoolNpsn) params.set("schoolNpsn", schoolNpsn);
            if (jenis !== "all") params.set("jenis", jenis);
            if (gender !== "all") params.set("gender", gender);

            const res = await fetch(`/api/admin-sekolah/gtk?${params.toString()}`, {
                cache: "no-store",
            });

            const text = await res.text();
            const json = JSON.parse(text);

            if (!res.ok) {
                console.error(json);
                return;
            }

            setItems(json.data ?? []);
            setTotal(json.total ?? 0);
            setTotalPages(json.totalPages ?? 1);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch, schoolNpsn, jenis, gender, activeSort, scoreDir, talentaDir]);

    useEffect(() => {
        const run = async () => {
            await loadData();
        };
        run();
    }, [loadData]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, jenis, gender, activeSort, scoreDir, talentaDir]);

    const paginationItems = useMemo(
        () => buildPagination(page, totalPages || 1),
        [page, totalPages]
    );

    const toggleSelect = (nik: string) => {
        setSelectedNiks((prev) =>
            prev.includes(nik) ? prev.filter((n) => n !== nik) : [...prev, nik]
        );
    };

    const handleResetSelection = () => setSelectedNiks([]);

    // EXPORT XLS
    const handleExportXLS = async () => {
        if (total === 0) return;

        const params = new URLSearchParams();

        params.set("sort", activeSort);
        params.set("dir", activeSort === "score" ? scoreDir : talentaDir);

        if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
        if (schoolNpsn) params.set("schoolNpsn", schoolNpsn);
        if (jenis !== "all") params.set("jenis", jenis);
        if (gender !== "all") params.set("gender", gender);

        const res = await fetch(`/api/admin-sekolah/gtk/export-xls?${params.toString()}`);

        if (!res.ok) {
            console.error("Export XLS error");
            return;
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `GTK_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    };

    // PRINT (FILTER)
    async function handlePrintFilterWithSigner(signer: TtdInput) {
        const params = new URLSearchParams();

        params.set("sort", activeSort);
        params.set("dir", activeSort === "score" ? scoreDir : talentaDir);

        if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
        if (schoolNpsn) params.set("schoolNpsn", schoolNpsn);
        if (jenis !== "all") params.set("jenis", jenis);
        if (gender !== "all") params.set("gender", gender);

        const res = await fetch(`/api/admin-sekolah/gtk/print?${params.toString()}`);

        const json = await res.json();
        const data = json.data as GtkPrintItem[];

        const { ok, html } = await renderAdminSchoolGtkPdfHtml(data, signer);
        if (!ok) return;

        openPrintWindowAdminSchool(html);

    }

    // PRINT SELECTED
    async function handlePrintSelectedWithSigner(signer: TtdInput) {
        const res = await fetch(`/api/admin-sekolah/gtk/print-selected`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ niks: selectedNiks }),
        });

        const json = await res.json();
        const data = json.data as GtkPrintItem[];

        const { ok, html } = await renderAdminSchoolGtkPdfHtml(data, signer);
        if (!ok) return;

        openPrintWindowAdminSchool(html);

    }

    // UI
    return (
        <DashboardLayout role={role} userName={userName}>
            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
                {/* Header */}
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <h1 className="text-2xl font-semibold tracking-tight">Data GTK</h1>
                            <p className="text-muted-foreground text-sm">
                                Manajemen data Guru & Tenaga Kependidikan.
                            </p>

                            {loading && (
                                <Badge className="rounded-full bg-blue-600 text-white">
                                    Memuat…
                                </Badge>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            {/* Kiri toolbar */}
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleExportXLS}
                                    disabled={loading || total === 0}
                                    className="gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Export XLS
                                </Button>

                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                        setPendingMode("filter");
                                        setTtdOpen(true);
                                    }}
                                    disabled={loading || total === 0}
                                    className="gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    Cetak (filter)
                                </Button>

                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setPendingMode("selected");
                                        setTtdOpen(true);
                                    }}
                                    disabled={loading || !hasSelection}
                                    className="gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    Cetak yang dipilih
                                </Button>

                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!hasSelection}
                                    onClick={handleResetSelection}
                                >
                                    Reset pilihan
                                </Button>
                            </div>

                            {/* Kanan */}
                            {/* <Button
                                size="sm"
                                onClick={() => setOpenCreate(true)}
                                className="gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Tambah GTK
                            </Button> */}
                        </div>
                    </div>
                </div>

                {/* FILTER */}
                <Card className="border-muted/40">
                    <CardContent className="py-4 space-y-3">
                        <div className="flex flex-wrap gap-3 items-center">
                            <div className="relative flex-1 min-w-[260px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari nama, NIK, email…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 items-center">
                            <Select value={jenis} onValueChange={setJenis}>
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Jenis GTK" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Jenis</SelectItem>
                                    <SelectItem value="Guru">Guru</SelectItem>
                                    <SelectItem value="Tendik">Tendik</SelectItem>
                                    <SelectItem value="Kepala Sekolah">Kepala Sekolah</SelectItem>
                                    <SelectItem value="Kepala Seksi">Kepala Seksi</SelectItem>
                                    <SelectItem value="Kepala Cabang Dinas">Kepala Cabang Dinas</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={gender} onValueChange={setGender}>
                                <SelectTrigger className="w-56">
                                    <SelectValue placeholder="Semua Gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Gender</SelectItem>
                                    <SelectItem value="L">L</SelectItem>
                                    <SelectItem value="P">P</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setSearch("");
                                    setJenis("all");
                                    setGender("all");

                                    setActiveSort("score");
                                    setScoreDir("desc");
                                    setTalentaDir("desc");

                                    setScoreDirUi(undefined);
                                    setTalentaDirUi(undefined);

                                    setPage(1);
                                }}
                            >
                                Reset Filter
                            </Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Menampilkan data berdasarkan filter di atas.
                        </p>
                    </CardContent>
                </Card>

                {/* TABLE */}
                <Card className="border-muted/40">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <CardTitle className="text-base font-semibold">Daftar GTK</CardTitle>
                            <CardDescription>
                                {loading
                                    ? "Memuat data..."
                                    : `Menampilkan ${items.length} dari ${total} data.`}
                            </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Sorting Score */}
                            <Select
                                key={scoreDirUi ?? "placeholder-score"}
                                value={scoreDirUi}
                                onValueChange={(v) => {
                                    const dir = v as "asc" | "desc";
                                    if (activeSort !== "score") {
                                        toast.message("Sorting diganti", {
                                            description: "Aktif: Sorting Skor",
                                        });
                                    }
                                    setScoreDirUi(dir);
                                    setScoreDir(dir);
                                    setActiveSort("score");
                                    setTalentaDirUi(undefined);
                                }}
                            >
                                <SelectTrigger
                                    className={
                                        activeSort === "score"
                                            ? "w-[210px]"
                                            : "w-[210px] opacity-70"
                                    }
                                >
                                    <SelectValue placeholder="Sorting Skor" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="desc">Terbesar → Terkecil</SelectItem>
                                    <SelectItem value="asc">Terkecil → Terbesar</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Sorting Talenta */}
                            <Select
                                key={talentaDirUi ?? "placeholder-talenta"}
                                value={talentaDirUi}
                                onValueChange={(v) => {
                                    const dir = v as "asc" | "desc";
                                    if (activeSort !== "talenta") {
                                        toast.message("Sorting diganti", {
                                            description: "Aktif: Sorting Talenta",
                                        });
                                    }
                                    setTalentaDirUi(dir);
                                    setTalentaDir(dir);
                                    setActiveSort("talenta");
                                    setScoreDirUi(undefined);
                                }}
                            >
                                <SelectTrigger
                                    className={
                                        activeSort === "talenta"
                                            ? "w-[240px]"
                                            : "w-[240px] opacity-70"
                                    }
                                >
                                    <SelectValue placeholder="Sorting Talenta" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="desc">Terbanyak → Tersedikit</SelectItem>
                                    <SelectItem value="asc">Tersedikit → Terbanyak</SelectItem>
                                </SelectContent>
                            </Select>

                            <Badge variant="outline" className="rounded-full">
                                Dipilih: {selectedNiks.length}
                            </Badge>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[40px] text-center">Pilih</TableHead>
                                    <TableHead>Nama</TableHead>
                                    <TableHead>NIP</TableHead>
                                    <TableHead>Gender</TableHead>
                                    <TableHead>Jenis</TableHead>
                                    <TableHead>Skor</TableHead>
                                    <TableHead>Talenta</TableHead>
                                    {/* <TableHead className="text-center">Aksi</TableHead> */}
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {!loading &&
                                    items.map((item) => {
                                        const checked = selectedNiks.includes(item.nik);
                                        return (
                                            <TableRow key={item.nik}>
                                                <TableCell className="text-center align-middle">
                                                    <input
                                                        type="checkbox"
                                                        className={
                                                            "h-4 w-4 rounded border-2 " +
                                                            (checked
                                                                ? "border-primary bg-primary"
                                                                : "border-muted bg-background")
                                                        }
                                                        checked={checked}
                                                        onChange={() => toggleSelect(item.nik)}
                                                    />
                                                </TableCell>
                                                <TableCell>{item.name}</TableCell>
                                                <TableCell>{item.nip ?? "-"}</TableCell>
                                                <TableCell className="text-center">
                                                    {item.gender ?? "-"}
                                                </TableCell>
                                                <TableCell>{item.type ?? "-"}</TableCell>
                                                <TableCell className="text-center tabular-nums">
                                                    {(item.totalSkorDinilai ?? 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-center tabular-nums">
                                                    {item.talentaCount ?? 0}
                                                </TableCell>
                                                {/* <TableCell>
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
                                                            <Edit className="w-4 h-4" />
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
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell> */}
                                            </TableRow>
                                        );
                                    })}

                                {!loading && items.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={9}
                                            className="py-8 text-center text-sm text-muted-foreground"
                                        >
                                            Tidak ada data.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>

                            {totalPages > 1 && (
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={9}>
                                            <Pagination>
                                                <PaginationContent>
                                                    <PaginationItem>
                                                        <PaginationPrevious
                                                            onClick={() =>
                                                                setPage((p) => Math.max(1, p - 1))
                                                            }
                                                            className={
                                                                page === 1
                                                                    ? "pointer-events-none opacity-50"
                                                                    : ""
                                                            }
                                                        />
                                                    </PaginationItem>

                                                    {paginationItems.map((it) =>
                                                        it.type === "ellipsis" ? (
                                                            <PaginationItem key={it.key}>
                                                                <PaginationEllipsis />
                                                            </PaginationItem>
                                                        ) : (
                                                            <PaginationItem key={it.value}>
                                                                <PaginationLink
                                                                    isActive={page === it.value}
                                                                    onClick={() => setPage(it.value)}
                                                                >
                                                                    {it.value}
                                                                </PaginationLink>
                                                            </PaginationItem>
                                                        )
                                                    )}

                                                    <PaginationItem>
                                                        <PaginationNext
                                                            onClick={() =>
                                                                setPage((p) =>
                                                                    Math.min(
                                                                        totalPages || 1,
                                                                        p + 1
                                                                    )
                                                                )
                                                            }
                                                            className={
                                                                page === (totalPages || 1)
                                                                    ? "pointer-events-none opacity-50"
                                                                    : ""
                                                            }
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
            </div>

            {/* Modals */}
            {/* <CreateGTKModalAdminSekolah
                open={openCreate}
                onOpenChange={(o) => {
                    setOpenCreate(o);
                    if (!o) loadData();
                }}
                schoolNpsn={schoolNpsn}
                onCreated={loadData}
            />

            <EditGTKModalAdminSekolah
                open={openEdit}
                onOpenChange={(o) => {
                    setOpenEdit(o);
                    if (!o) setSelected(null);
                }}
                gtk={selected}
                schoolName={selected?.school?.name ?? ""}
                onUpdated={loadData}
            />

            <DeleteGTKModalAdminSekolah
                open={openDelete}
                onOpenChange={(o) => {
                    setOpenDelete(o);
                    if (!o) setSelected(null);
                }}
                gtk={selected}
                onDeleted={loadData}
            /> */}

            {/* MODAL TTD */}
            {ttdOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-lg bg-background p-4 shadow-lg">
                        <div className="text-base font-semibold">Pengesahan / TTD</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                            Isi nama dan NIP sebelum mencetak.
                        </div>

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
                                    if (!pendingMode) return alert("Mode cetak tidak valid");

                                    if (pendingMode === "filter") {
                                        await handlePrintFilterWithSigner({
                                            name: v.name,
                                            nip: v.nip,
                                        });
                                    } else {
                                        await handlePrintSelectedWithSigner({
                                            name: v.name,
                                            nip: v.nip,
                                        });
                                    }

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
            )}
        </DashboardLayout>
    );
}
