"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateSekolahModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Level = "SMA" | "SMK" | "SLB";
type Status = "NEGERI" | "SWASTA";
type BranchOpt = { id: string; name: string; city: string };

export function CreateSekolahModal({ open, onOpenChange, onSuccess }: CreateSekolahModalProps) {
  const [nama, setNama] = useState("");
  const [npsn, setNpsn] = useState("");
  const [level, setLevel] = useState<Level | "">("");
  const [status, setStatus] = useState<Status | "">("");
  const [city, setCity] = useState("");

  // ✅ baru: scope cabang wajib dipilih
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [branchId, setBranchId] = useState<string>("");

  // ✅ baru: kepala sekolah (editable pada create)
  const [headName, setHeadName] = useState("");
  const [headNip, setHeadNip] = useState("");
  const [headRank, setHeadRank] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!branchId) return false;
    if (!nama.trim()) return false;
    if (!npsn.trim()) return false;
    if (!level) return false;
    if (!status) return false;
    if (!city.trim()) return false;
    return true;
  }, [loading, branchId, nama, npsn, level, status, city]);

  const resetForm = () => {
    setNama("");
    setNpsn("");
    setLevel("");
    setStatus("");
    setCity("");

    setBranchId("");

    setHeadName("");
    setHeadNip("");
    setHeadRank("");

    setErrorMsg(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // load branches saat modal dibuka
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadBranches() {
      setLoadingBranches(true);
      setErrorMsg(null);

      try {
        const res = await fetch("/api/super-admin/branches?simple=1", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          setBranches([]);
          setErrorMsg(json?.error ?? "Gagal memuat daftar cabang.");
          return;
        }

        setBranches(Array.isArray(json?.data) ? json.data : []);
      } catch {
        if (!cancelled) {
          setBranches([]);
          setErrorMsg("Terjadi kesalahan jaringan saat memuat cabang.");
        }
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    }

    loadBranches();
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleSubmit() {
    if (!canSubmit) {
      setErrorMsg("Cabang, nama, NPSN, jenjang, status, dan kota wajib diisi.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const payload = {
      branchId,
      npsn: npsn.trim(),
      name: nama.trim(),
      level,
      status,
      city: city.trim(),

      // optional
      headName: headName.trim() ? headName.trim() : null,
      headNip: headNip.trim() ? headNip.trim() : null,
      headRank: headRank.trim() ? headRank.trim() : null,
    };

    try {
      const res = await fetch("/api/super-admin/school-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        // ignore
      }

      if (!res.ok) {
        setErrorMsg(json?.error ?? json?.message ?? "Gagal menyimpan data sekolah. Coba lagi.");
        return;
      }

      onSuccess?.();
      handleClose();
    } catch (e) {
      console.error(e);
      setErrorMsg("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
        else onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Sekolah</DialogTitle>
          <DialogDescription>Input data sekolah baru.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Cabang */}
          <div className="space-y-1.5">
            <Label>Cabang</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingBranches ? "Memuat cabang..." : "Pilih cabang"} />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Wajib dipilih karena SUPER_ADMIN bersifat global.
            </p>
          </div>

          {/* Nama */}
          <div className="space-y-1.5">
            <Label>Nama Sekolah</Label>
            <Input placeholder="Nama Sekolah" value={nama} onChange={(e) => setNama(e.target.value)} />
          </div>

          {/* NPSN */}
          <div className="space-y-1.5">
            <Label>NPSN</Label>
            <Input placeholder="NPSN" value={npsn} onChange={(e) => setNpsn(e.target.value)} />
          </div>

          {/* Jenjang - Status - Kota */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Jenjang</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
                <SelectTrigger>
                  <SelectValue placeholder="Jenjang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMA">SMA</SelectItem>
                  <SelectItem value="SMK">SMK</SelectItem>
                  <SelectItem value="SLB">SLB</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEGERI">Negeri</SelectItem>
                  <SelectItem value="SWASTA">Swasta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Kota</Label>
              <Input placeholder="Kota" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>

          {/* Kepala Sekolah (editable pada create) */}
          <div className="space-y-1.5">
            <Label>Kepala Sekolah</Label>
            <Input
              placeholder="Nama kepala sekolah (opsional)"
              value={headName}
              onChange={(e) => setHeadName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Jika nanti sudah ada GTK jenis &quot;Kepala Sekolah&quot;, UI list akan menampilkan dari GTK; field ini sebagai data awal.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>NIP Kepala Sekolah</Label>
              <Input
                placeholder="NIP (opsional)"
                value={headNip}
                onChange={(e) => setHeadNip(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Pangkat/Gol</Label>
              <Input
                placeholder="Pangkat/Gol (opsional)"
                value={headRank}
                onChange={(e) => setHeadRank(e.target.value)}
              />
            </div>
          </div>

          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Batal
          </Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={handleSubmit} disabled={!canSubmit}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
