"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";

type BranchOpt = { id: string; name: string; city: string };
type SchoolOpt = { npsn: string; name: string; city: string; branchId: string };

type UserAccessRow = {
  id: string;
  role: "ADMIN_SEKOLAH";
  createdAt: string;
  schoolNpsn: string | null;
  branchId: string | null;
  school?: { npsn: string; name: string; city: string } | null;
  branch?: { id: string; name: string; city: string } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userLabel?: string;
  onChanged?: () => void;
};

export default function UserSchoolAccessModal({
  open,
  onOpenChange,
  userId,
  userLabel = "User",
  onChanged,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [accessList, setAccessList] = useState<UserAccessRow[]>([]);

  // mode pilihan akses baru
  const [mode, setMode] = useState<"branch" | "school">("branch");

  // branchId dipakai:
  // - mode=branch => scope akses cabang
  // - mode=school => hanya sebagai filter daftar sekolah
  const [branchId, setBranchId] = useState<string>("");

  // khusus scope sekolah
  const [schoolNpsn, setSchoolNpsn] = useState<string>("");

  const canSubmit = useMemo(() => {
    if (!userId) return false;
    if (saving) return false;
    if (mode === "branch") return !!branchId;
    return !!schoolNpsn;
  }, [userId, saving, mode, branchId, schoolNpsn]);

  // load branches once (when opened)
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadBranches() {
      try {
        const res = await fetch("/api/super-admin/branches?simple=1", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        setBranches(Array.isArray(json?.data) ? json.data : []);
      } catch {
        // silent
      }
    }

    loadBranches();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // load access list when opened/userId changes
  useEffect(() => {
    if (!open || !userId) return;

    let cancelled = false;

    async function loadAccess() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/super-admin/users/${userId}/access`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          setErrorMsg(json?.error ?? "Gagal memuat akses user.");
          setAccessList([]);
          return;
        }

        setAccessList(Array.isArray(json?.data) ? json.data : []);
      } catch {
        if (!cancelled) setErrorMsg("Terjadi kesalahan jaringan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAccess();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  // reset “schools” saat mode bukan school (biar tidak nyangkut)
  useEffect(() => {
    if (!open) return;

    if (mode === "branch") {
      setSchools([]);
      setSchoolNpsn("");
    } else {
      // mode school
      setSchoolNpsn("");
    }
  }, [open, mode]);

  // load schools when branchId changes (only if mode=school)
  useEffect(() => {
    if (!open) return;
    if (mode !== "school") return;

    if (!branchId) {
      setSchools([]);
      setSchoolNpsn("");
      return;
    }

    let cancelled = false;

    async function loadSchools() {
      try {
        const res = await fetch(`/api/super-admin/schools?branchId=${branchId}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          setSchools([]);
          return;
        }

        const rows = Array.isArray(json?.data) ? json.data : [];
        setSchools(
          rows.map((s: any) => ({
            npsn: s.npsn,
            name: s.name,
            city: s.city,
            branchId: s.branchId,
          }))
        );
      } catch {
        if (!cancelled) setSchools([]);
      }
    }

    loadSchools();
    return () => {
      cancelled = true;
    };
  }, [open, mode, branchId]);

  // reset form when close
  useEffect(() => {
    if (open) return;

    setLoading(false);
    setSaving(false);
    setErrorMsg(null);

    setMode("branch");
    setBranchId("");
    setSchoolNpsn("");
    setSchools([]);
    setAccessList([]);
  }, [open]);

  async function handleAdd() {
    if (!userId) return;
    if (!canSubmit) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      // ✅ body dibuat tegas:
      // - mode branch => kirim branchId saja
      // - mode school => kirim schoolNpsn saja (branchId hanya untuk filter list)
      const body =
        mode === "branch"
          ? { role: "ADMIN_SEKOLAH", branchId }
          : { role: "ADMIN_SEKOLAH", schoolNpsn };

      const res = await fetch(`/api/super-admin/users/${userId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMsg(json?.error ?? "Gagal menambahkan akses.");
        return;
      }

      setAccessList((prev) => [json.data, ...prev]);

      if (mode === "school") setSchoolNpsn("");
      onChanged?.();
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan.");
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(accessId: string) {
    if (!userId) return;

    toast.custom((t) => (
      <div className="flex w-[520px] items-center gap-3 rounded-lg bg-popover px-4 py-3 text-popover-foreground shadow-lg">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Hapus akses?</div>
          <div className="text-sm text-muted-foreground truncate">
            Akses admin sekolah ini akan dihapus dari user.
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="h-8 border-destructive text-destructive hover:bg-destructive/10"
            onClick={() => toast.dismiss(t)}
          >
            Batal
          </Button>

          <Button
            className="h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              toast.dismiss(t);
              void doDelete(accessId);
            }}
          >
            Hapus
          </Button>
        </div>
      </div>
    ), { duration: 10000 });
  }

  async function doDelete(accessId: string) {
    if (!userId) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/super-admin/users/${userId}/access/${accessId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = json?.error ?? "Gagal menghapus akses.";
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }

      setAccessList((prev) => prev.filter((a) => a.id !== accessId));
      toast.success("Akses berhasil dihapus.");
      onChanged?.();
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan.");
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setSaving(false);
    }
  }

  function renderAccessLabel(a: UserAccessRow) {
    if (a.schoolNpsn && a.school) return `Sekolah: ${a.school.name} (${a.school.npsn})`;
    if (a.branchId && a.branch) return `Cabang: ${a.branch.name} (${a.branch.city})`;
    if (a.schoolNpsn) return `Sekolah: ${a.schoolNpsn}`;
    if (a.branchId) return `Cabang: ${a.branchId}`;
    return "Tidak ada scope";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kelola Akses Admin Sekolah</DialogTitle>
          <DialogDescription>
            Tambahkan akses admin sekolah/cabang untuk: <b>{userLabel}</b>
          </DialogDescription>
        </DialogHeader>

        {errorMsg ? (
          <Card className="border-rose-200">
            <CardContent className="py-3 text-sm text-rose-700">{errorMsg}</CardContent>
          </Card>
        ) : null}

        {/* form add */}
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary">Role: ADMIN_SEKOLAH</Badge>
            <Badge variant="outline">Total akses: {accessList.length}</Badge>
            {loading ? (
              <Badge className="bg-blue-600 text-white hover:bg-blue-600">Memuat…</Badge>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Tipe akses</div>
              <Select
                value={mode}
                onValueChange={(v) => {
                  const m = v as "branch" | "school";
                  setMode(m);
                  setErrorMsg(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="branch">Per cabang</SelectItem>
                  <SelectItem value="school">Per sekolah</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {mode === "school" ? "Cabang (filter sekolah)" : "Cabang"}
              </div>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih cabang" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.city})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mode === "school" ? (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Sekolah</div>
                <Select value={schoolNpsn} onValueChange={setSchoolNpsn}>
                  <SelectTrigger>
                    <SelectValue placeholder={branchId ? "Pilih sekolah" : "Pilih cabang dulu"} />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s.npsn} value={s.npsn}>
                        {s.name} ({s.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Button className="w-full gap-2" onClick={handleAdd} disabled={!canSubmit}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Tambah akses cabang
                </Button>
              </div>
            )}
          </div>

          {mode === "school" ? (
            <Button className="gap-2" onClick={handleAdd} disabled={!canSubmit}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Tambah akses sekolah
            </Button>
          ) : null}
        </div>

        {/* list access */}
        <div className="border rounded-md">
          <div className="px-4 py-2 border-b text-sm font-medium">Daftar akses saat ini</div>

          <div className="divide-y">
            {!loading && accessList.length === 0 ? (
              <div className="px-4 py-4 text-sm text-muted-foreground">
                Belum ada akses ADMIN_SEKOLAH.
              </div>
            ) : null}

            {accessList.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{renderAccessLabel(a)}</div>
                  <div className="text-xs text-muted-foreground truncate">ID: {a.id}</div>
                </div>

                <Button
                  size="icon"
                  variant="outline"
                  className="border-destructive text-destructive"
                  onClick={() => requestDelete(a.id)}
                  disabled={saving}
                  title="Hapus akses"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
