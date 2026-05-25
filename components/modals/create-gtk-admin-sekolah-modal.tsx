"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

/* ============================================================
   TYPE GTK ADMIN SEKOLAH
============================================================ */

type GtkTypeClient =
  | "GURU"
  | "TENDIK"
  | "KEPALA_SEKOLAH"
  | "KEPALA_SEKSI"
  | "KEPALA_CABANG_DINAS";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;

  /** inject dari parent (Login session) */
  schoolNpsn: string;
}

/* ============================================================
   COMPONENT
============================================================ */

export function CreateGTKModalAdminSekolah({
  open,
  onOpenChange,
  onCreated,
  schoolNpsn,
}: Props) {
  const [saving, setSaving] = useState(false);

  const [nik, setNik] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nuptk, setNuptk] = useState("");
  const [nip, setNip] = useState("");
  const [gender, setGender] = useState<"L" | "P" | "">("");
  const [type, setType] = useState<GtkTypeClient>("GURU");
  const [mapel, setMapel] = useState("");

  const canSubmit = useMemo(
    () => nik.trim() && name.trim(),
    [nik, name]
  );

  function resetForm() {
    setNik("");
    setName("");
    setEmail("");
    setNuptk("");
    setNip("");
    setGender("");
    setType("GURU");
    setMapel("");
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin-sekolah/gtk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nik: nik.trim(),
          name: name.trim(),
          email: email.trim() || undefined,
          nuptk: nuptk.trim() || undefined,
          nip: nip.trim() || undefined,
          gender: gender || undefined,
          type,
          mapel: mapel.trim() || undefined,
          schoolNpsn, // <-- otomatis pakai sekolah admin
        }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {}

      if (!res.ok) {
        alert(json?.error || text || "Gagal menambah GTK.");
        return;
      }

      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error(err);
      alert("Gagal menambah GTK.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="mb-3">Tambah GTK</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>NIK <span className="text-red-600">*</span></Label>
            <Input
              placeholder="3573013213210001"
              value={nik}
              onChange={(e) => setNik(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Nama <span className="text-red-600">*</span></Label>
            <Input
              placeholder="Budi Santoso"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input
              placeholder="nama@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>NUPTK</Label>
            <Input
              placeholder="7456321672130072"
              value={nuptk}
              onChange={(e) => setNuptk(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>NIP</Label>
            <Input
              placeholder="198301012010011002"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Jenis Kelamin</Label>
            <Select
              value={gender || "all"}
              onValueChange={(v) =>
                setGender(v === "all" ? "" : (v as "L" | "P"))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Jenis Kelamin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Pilih Jenis Kelamin</SelectItem>
                <SelectItem value="L">Laki-laki</SelectItem>
                <SelectItem value="P">Perempuan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Jenis GTK</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as GtkTypeClient)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Jenis GTK" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GURU">Guru</SelectItem>
                <SelectItem value="TENDIK">Tendik / Pegawai</SelectItem>
                <SelectItem value="KEPALA_SEKOLAH">Kepala Sekolah</SelectItem>
                <SelectItem value="KEPALA_SEKSI">Kepala Seksi</SelectItem>
                <SelectItem value="KEPALA_CABANG_DINAS">
                  Kepala Cabang Dinas
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Mapel</Label>
            <Input
              placeholder="Mapel (opsional)"
              value={mapel}
              onChange={(e) => setMapel(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
