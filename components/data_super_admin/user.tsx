"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Download,
  FileText,
  Shield,
  Sparkles,
  School as SchoolIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import DashboardLayout from "@/components/dashboard-layout";
import { CreateUserModal } from "@/components/modals/create-user-modal";
import { EditUserModal } from "@/components/modals/edit-user-modal";
import { DeleteUserModal } from "@/components/modals/delete-user-modal";
import UserSchoolAccessModal from "@/components/modals/user-school-access-modal";
import UserSuperAdminModal from "@/components/modals/user-super-admin-modal";
import UserTalentAdminModal from "@/components/modals/user-talent-admin-modal";

import type { UserRole as PrismaUserRole } from "@prisma/client";
import type { UserRole } from "@/lib/types/role";
import type { GTK } from "@/lib/types/gtk";

import { exportUsersToXLS, type UserExportRow } from "@/lib/export-user-xls";
import { openPrintWindow, printCtx, type UserPrintItem, renderUserPrintHtml, type TtdInput } from "@/lib/print-utils";

const PAGE_SIZE = 20;

type ApiUser = {
  id: string;
  username: string;
  name: string;
  role: PrismaUserRole;
  isActive: boolean;
  branchId: string | null;
  schoolNpsn: string | null;
  gtkNik: string | null;
  createdAt: string;
  branch?: { id: string; name: string; city: string } | null;
  school?: { npsn: string; name: string; city: string } | null;
  gtk?: { nik: string; name: string; schoolNpsn: string; type: GTK["type"] } | null;
  access?: Array<{ role: PrismaUserRole }> | null;
};

type ApiListResponse = {
  data: ApiUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type UiUser = {
  id: string;
  username: string;
  name: string;
  role: PrismaUserRole;
  isActive: boolean;
  gtkName: string | null;
  schoolName: string | null;
  branchName: string | null;
  gtkTypeLabel: string | null;
  roles: string[];
};

type GtkTypeUi = NonNullable<GTK["type"]>;
const GTK_TYPE_LABEL: Record<GtkTypeUi, string> = {
  GURU: "Guru",
  TENDIK: "Tendik",
  KEPALA_SEKOLAH: "Kepala Sekolah",
  KEPALA_SEKSI: "Kepala Seksi",
  KEPALA_CABANG_DINAS: "Kepala Cabang Dinas",
};

function normalizeRole(x: string) {
  return x.replaceAll(" ", "_").toUpperCase();
}

const ROLE_ALIAS: Record<string, string> = {
  USER_GTK: "GTK",
  ADMIN_SEKOLAH: "Admin Sekolah",
  ADMIN_TALENTA: "Admin Talenta",
  SUPER_ADMIN: "Super Admin",
};

function roleLabel(x: string) {
  const norm = x.replaceAll(" ", "_").toUpperCase();

  // Jika ada alias, langsung return TANPA modifikasi
  if (ROLE_ALIAS[norm]) return ROLE_ALIAS[norm];

  // Jika input SUDAH berupa alias (misal "GTK"), langsung return
  if (Object.values(ROLE_ALIAS).includes(x)) return x;

  // Default title case
  return x
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DataUserPage({
  role,
  userName,
}: {
  role: UserRole;
  userName: string;
}) {

  // FILTER STATE
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all"
  );
  const [page, setPage] = useState(1);

  // DATA STATE
  const [items, setItems] = useState<ApiUser[]>([]);
  const uiUsers: UiUser[] = useMemo(
    () =>
      items.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        gtkName: u.gtk?.name ?? null,
        gtkTypeLabel: u.gtk?.type ? GTK_TYPE_LABEL[u.gtk.type] : null,
        schoolName: u.school?.name ?? null,
        branchName: u.branch?.name ?? null,
        roles: (u.access && u.access.length > 0)
          ? u.access.map((a) => ROLE_ALIAS[a.role] ?? a.role)
          : [ROLE_ALIAS[u.role] ?? u.role],
      })),
    [items]
  );

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // MODAL STATE
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  // ✅ modal akses admin sekolah
  const [openAccess, setOpenAccess] = useState(false);
  const [openSuperAdmin, setOpenSuperAdmin] = useState(false);
  const [openTalenta, setOpenTalenta] = useState(false);

  const [selected, setSelected] = useState<ApiUser | null>(null);

  // SELECTION STATE (lintas halaman)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [ttdOpen, setTtdOpen] = useState(false);
  const [ttdName, setTtdName] = useState("");
  const [ttdNip, setTtdNip] = useState("");
  const [pendingMode, setPendingMode] = useState<null | "all" | "selected">(null);

  function validateTtd() {
    const name = ttdName.trim();
    const nip = ttdNip.trim();
    if (!name) return { ok: false as const, error: "Nama penandatangan wajib diisi." };
    if (!nip) return { ok: false as const, error: "NIP wajib diisi." };
    return { ok: true as const, name, nip };
  }

  const hasSelection = selectedIds.length > 0;

  // INIT LETTERHEAD UNTUK CETAK USER
  useEffect(() => {
    if (!printCtx.letterhead) {
      printCtx.letterhead = {
        title: "CABANG DINAS PENDIDIKAN WILAYAH MALANG\n(KOTA MALANG - KOTA BATU)",
        address: "Jalan Anjasmoro Nomor 40, Oro-oro Dowo, Kec. Klojen, Kota Malang, Jawa Timur 65119",
        phone: "(0341) 353155",
        email: "cabdinwilmalangbatu@gmail.com",
        logoPath: null,
      };
    }
    if (!printCtx.branchCity) {
      printCtx.branchCity = "Malang";
    }
  }, []);

  // RESET PAGE saat filter berubah
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (search.trim()) params.set("q", search.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter === "active") params.set("isActive", "true");
      if (statusFilter === "inactive") params.set("isActive", "false");

      const res = await fetch(`/api/super-admin/users?${params.toString()}`, {
        cache: "no-store",
      });

      const text = await res.text();
      let json: ApiListResponse | { error?: string };
      try {
        json = JSON.parse(text);
      } catch {
        console.error("Non-JSON response:", text);
        return;
      }

      if (!res.ok) {
        console.error("Error load users:", json);
        return;
      }

      const data = json as ApiListResponse;
      setItems(data.data ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReloadAfterMutation = () => {
    fetchData();
  };

  // EXPORT XLS BERDASARKAN FILTER
  const handleExportUsersByFilter = useCallback(async () => {
    try {
      if (total === 0) return;

      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("pageSize", String(total));
      if (search.trim()) params.set("q", search.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter === "active") params.set("isActive", "true");
      if (statusFilter === "inactive") params.set("isActive", "false");

      const res = await fetch(`/api/super-admin/users?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("Export users error:", await res.text());
        alert("Gagal mengambil data user untuk export.");
        return;
      }

      const json = (await res.json()) as ApiListResponse;
      const allItems = json.data ?? [];

      if (allItems.length === 0) {
        alert("Tidak ada data user untuk export.");
        return;
      }

      const rows: UserExportRow[] = allItems.map((u) => ({
        username: u.username,
        name: u.name,
        role: ROLE_ALIAS[u.role] ?? u.role,
        isActive: u.isActive,
        gtkName: u.gtk?.name ?? null,
        schoolName: u.school?.name ?? null,
        branchName: u.branch?.name ?? null,
      }));

      exportUsersToXLS(rows);
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan saat export XLS.");
    }
  }, [total, search, roleFilter, statusFilter]);

  // CETAK PDF BERDASARKAN FILTER
  async function handlePrintUsersByFilterWithSigner(signer: TtdInput) {
    try {
      if (total === 0) return;

      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter === "active") params.set("isActive", "true");
      if (statusFilter === "inactive") params.set("isActive", "false");

      const res = await fetch(`/api/super-admin/users/print?${params.toString()}`, { cache: "no-store" });

      const text = await res.text();
      let json: { data?: UserPrintItem[]; error?: string };
      try {
        json = JSON.parse(text);
      } catch {
        alert("Gagal memproses respon server untuk cetak.");
        return;
      }

      if (!res.ok || !json.data) {
        alert(json.error || "Gagal mengambil data user untuk cetak.");
        return;
      }

      const data = json.data;
      if (!data.length) {
        alert("Tidak ada data user untuk dicetak.");
        return;
      }

      const { ok, html, error } = await renderUserPrintHtml(data, signer);
      if (!ok) {
        console.error(error);
        alert("Gagal merender dokumen cetak.");
        return;
      }

      const win = openPrintWindow();
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan saat cetak data user.");
    }
  }

  // SELEKSI USER (checkbox)
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const resetSelection = () => {
    setSelectedIds([]);
  };

  // CETAK PDF USER YANG DIPILIH
  async function handlePrintSelectedUsersWithSigner(signer: TtdInput) {
    if (!hasSelection) return;

    try {
      const res = await fetch("/api/super-admin/users/print-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const text = await res.text();
      let json: { data?: UserPrintItem[]; error?: string };
      try {
        json = JSON.parse(text);
      } catch {
        alert("Gagal memproses respon server untuk cetak terpilih.");
        return;
      }

      if (!res.ok || !json.data) {
        alert(json.error || "Gagal mengambil data user terpilih.");
        return;
      }

      const data = json.data;
      if (!data.length) {
        alert("Tidak ada data user yang valid untuk dicetak.");
        return;
      }

      const { ok, html, error } = await renderUserPrintHtml(data, signer);
      if (!ok) {
        console.error(error);
        alert("Gagal merender dokumen cetak.");
        return;
      }

      const win = openPrintWindow();
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan saat cetak user terpilih.");
    }
  }

  const pageNumbers = useMemo(() => {
    const windowSize = 5;
    if (totalPages <= windowSize) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const half = Math.floor(windowSize / 2);
    let start = Math.max(1, page - half);
    let end = start + windowSize - 1;
    if (end > totalPages) {
      end = totalPages;
      start = end - windowSize + 1;
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <DashboardLayout role={role} userName={userName}>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* HEADER */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Data User</h1>
            <p className="text-muted-foreground mt-1">
              Manajemen akun user (role, GTK, sekolah)
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                Total: {total}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                Dipilih: {selectedIds.length}
              </Badge>
              {loading && (
                <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">
                  Memuat…
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={total === 0}
              onClick={handleExportUsersByFilter}
            >
              <Download className="w-4 h-4" />
              Export XLS (Filter)
            </Button>

            <Button
              variant="secondary"
              className="gap-2"
              disabled={total === 0}
              onClick={() => { setPendingMode("all"); setTtdOpen(true); }}
            >
              <FileText className="w-4 h-4" />
              Cetak PDF (Filter)
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              disabled={!hasSelection}
              onClick={() => { setPendingMode("selected"); setTtdOpen(true); }}
            >
              <FileText className="w-4 h-4" />
              Cetak PDF (Dipilih)
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!hasSelection}
              onClick={resetSelection}
            >
              Reset pilihan
            </Button>

            <Button
              className="gap-2 bg-primary text-primary-foreground"
              onClick={() => setOpenCreate(true)}
            >
              <Plus className="w-4 h-4" />
              Tambah User
            </Button>
          </div>
        </div>

        {/* FILTER */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari username/nama..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                className="border rounded px-3 py-1 text-sm"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
              >
                <option value="all">Semua Role</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN_TALENTA">Admin Talenta</option>
                <option value="ADMIN_SEKOLAH">Admin Sekolah</option>
                <option value="USER_GTK">GTK</option>
              </select>

              <select
                className="border rounded px-3 py-1 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>

              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("all");
                  setStatusFilter("all");
                }}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* TABLE */}
        <Card>
          <CardHeader>
            <CardTitle>Daftar User</CardTitle>
            <CardDescription>
              {loading ? "Memuat data..." : `Menampilkan ${uiUsers.length} dari ${total} user`}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40px] text-center">Pilih</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Sekolah / UPT</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {!loading &&
                  uiUsers.map((u) => {
                    const checked = selectedIds.includes(u.id);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="text-center align-middle">
                          <input
                            type="checkbox"
                            className={
                              "h-4 w-4 rounded border-2 " +
                              (checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted bg-background hover:ring-2 hover:ring-primary/40 cursor-pointer")
                            }
                            checked={checked}
                            onChange={() => toggleSelect(u.id)}
                          />
                        </TableCell>

                        {/* <TableCell className="font-mono text-sm">{u.username}</TableCell> */}
                        <TableCell>{u.name}</TableCell>
                        <TableCell>{u.gtkTypeLabel ?? "-"}</TableCell>
                        <TableCell>{u.schoolName ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="space-y-0.5">
                            {(u.roles?.length ? u.roles : [u.role]).slice(0, 4).map((r) => (
                              <div key={r}>{roleLabel(r)}</div>
                            ))}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={u.isActive ? "outline" : "destructive"}
                            className={u.isActive ? "" : "border-destructive"}
                          >
                            {u.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex justify-center gap-1">
                            {/* ✅ akses admin sekolah */}
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => {
                                setSelected(items.find((it) => it.id === u.id) ?? null);
                                setOpenAccess(true);
                              }}
                              title="Kelola akses admin sekolah"
                            >
                              <SchoolIcon className="w-4 h-4" strokeWidth={1.5} absoluteStrokeWidth />
                            </Button>

                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => {
                                setSelected(items.find((it) => it.id === u.id) ?? null);
                                setOpenSuperAdmin(true);
                              }}
                              title="Kelola akses Super Admin"
                            >
                              <Shield className="w-4 h-4" strokeWidth={1.5} absoluteStrokeWidth />
                            </Button>

                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => {
                                setSelected(items.find((it) => it.id === u.id) ?? null);
                                setOpenTalenta(true);
                              }}
                              title="Kelola bidang Admin Talenta"
                            >
                              <Sparkles className="w-4 h-4" strokeWidth={1.5} absoluteStrokeWidth />
                            </Button>

                            <Button
                              size="icon"
                              variant="outline"
                              className="border-primary text-primary"
                              onClick={() => {
                                setSelected(items.find((it) => it.id === u.id) ?? null);
                                setOpenEdit(true);
                              }}
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
                            </Button>

                            <Button
                              size="icon"
                              variant="outline"
                              className="border-destructive text-destructive"
                              onClick={() => {
                                setSelected(items.find((it) => it.id === u.id) ?? null);
                                setOpenDelete(true);
                              }}
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={2.75} absoluteStrokeWidth />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                {!loading && uiUsers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Tidak ada user untuk filter/pencarian saat ini.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>

              {totalPages > 1 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={8} className="p-4">
                      <div className="flex justify-center">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                              />
                            </PaginationItem>

                            {pageNumbers.map((p) => (
                              <PaginationItem key={p}>
                                <PaginationLink
                                  isActive={page === p}
                                  onClick={() => setPage(p)}
                                >
                                  {p}
                                </PaginationLink>
                              </PaginationItem>
                            ))}

                            <PaginationItem>
                              <PaginationNext
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* MODALS */}
      <CreateUserModal
        open={openCreate}
        onOpenChange={(o) => {
          setOpenCreate(o);
          if (!o) handleReloadAfterMutation();
        }}
        onSuccess={handleReloadAfterMutation}
      />

      <EditUserModal
        open={openEdit}
        onOpenChange={(o) => {
          setOpenEdit(o);
          if (!o) setSelected(null);
        }}
        user={selected}
        onSuccess={handleReloadAfterMutation}
      />

      <DeleteUserModal
        open={openDelete}
        onOpenChange={(o) => {
          setOpenDelete(o);
          if (!o) setSelected(null);
        }}
        user={
          selected
            ? {
              id: selected.id,
              username: selected.username,
              name: selected.name,
            }
            : null
        }
        onSuccess={handleReloadAfterMutation}
      />

      <UserSchoolAccessModal
        open={openAccess}
        onOpenChange={(o) => {
          setOpenAccess(o);
          if (!o) setSelected(null);
        }}
        userId={selected?.id ?? null}
        userLabel={selected ? `${selected.name} (@${selected.username})` : "User"}
        onChanged={handleReloadAfterMutation}
      />

      <UserSuperAdminModal
        open={openSuperAdmin}
        onOpenChange={(o) => {
          setOpenSuperAdmin(o);
          if (!o) setSelected(null);
        }}
        userId={selected?.id ?? null}
        userLabel={selected ? `${selected.name} (@${selected.username})` : "User"}
        onChanged={handleReloadAfterMutation}
      />

      <UserTalentAdminModal
        open={openTalenta}
        onOpenChange={(o) => {
          setOpenTalenta(o);
          if (!o) setSelected(null);
        }}
        userId={selected?.id ?? null}
        userLabel={selected ? `${selected.name} (@${selected.username})` : "User"}
        onChanged={handleReloadAfterMutation}
      />

      {ttdOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pengesahan / TTD"
        >
          <div className="w-full max-w-md rounded-lg bg-background p-4 shadow-lg">
            <div className="text-base font-semibold">Pengesahan / TTD</div>
            <div className="mt-1 text-sm text-muted-foreground">Isi nama dan NIP sebelum mencetak.</div>

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
                  if (!pendingMode) return alert("Pilih mode cetak dulu.");

                  const signer: TtdInput = { name: v.name, nip: v.nip };

                  try {
                    if (pendingMode === "all") {
                      await handlePrintUsersByFilterWithSigner(signer);
                    } else {
                      await handlePrintSelectedUsersWithSigner(signer);
                    }

                    setTtdOpen(false);
                    setPendingMode(null);
                    setTtdName("");
                    setTtdNip("");
                  } catch (e: any) {
                    alert(e?.message ?? "Gagal mencetak.");
                  }
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
