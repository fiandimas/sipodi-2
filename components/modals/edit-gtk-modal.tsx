"use client";

import { useEffect, useMemo, useState } from "react";
import type { GTK } from "@/lib/types/gtk";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gtk: GTK | null;
  onUpdated?: () => void;
}

type GtkTypeClient =
  | "GURU"
  | "TENDIK"
  | "KEPALA_SEKOLAH"
  | "KEPALA_SEKSI"
  | "KEPALA_CABANG_DINAS";

const trimOrNull = (v: string) => (v.trim() ? v.trim() : null);

export function EditGTKModal({ open, onOpenChange, gtk, onUpdated }: Props) {
  const [nik, setNik] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nuptk, setNuptk] = useState("");
  const [nip, setNip] = useState("");
  const [gender, setGender] = useState<"L" | "P" | "">("");
  const [type, setType] = useState<GtkTypeClient>("GURU");
  const [mapel, setMapel] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (!gtk) {
      setNik("");
      setName("");
      setEmail("");
      setNuptk("");
      setNip("");
      setGender("");
      setType("GURU");
      setMapel("");
      setSchoolName("");
      return;
    }

    setNik(gtk.nik);
    setName(gtk.name ?? "");
    setEmail(gtk.email ?? "");
    setNuptk(gtk.nuptk ?? "");
    setNip(gtk.nip ?? "");
    setGender((gtk.gender as "L" | "P" | null) || "");
    setType((gtk.type as GtkTypeClient) ?? "GURU");
    setMapel(gtk.mapel ?? "");
    setSchoolName(gtk.school?.name ?? "");
  }, [gtk, open]);

  const canSubmit = useMemo(
    () => nik.trim().length > 0 && name.trim().length > 0 && !saving,
    [nik, name, saving]
  );

  if (!gtk) return null;

  async function handleSubmit() {
    if (!canSubmit) return;

    // ✅ snapshot supaya TS yakin tidak null dan supaya stabil walau prop berubah saat async
    const gtkNik = nik.trim();
    if (!gtkNik) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/super-admin/gtk/${encodeURIComponent(gtkNik)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: trimOrNull(email),
          nuptk: trimOrNull(nuptk),
          nip: trimOrNull(nip),
          gender: gender || null,
          type,
          mapel: trimOrNull(mapel),
        }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        // ignore
      }

      if (!res.ok) {
        alert(json?.error || text || "Gagal mengubah data GTK.");
        return;
      }

      onOpenChange(false);
      onUpdated?.();
    } catch (e) {
      console.error(e);
      alert("Gagal mengubah data GTK.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit GTK</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <Input disabled value={nik} readOnly className="bg-muted/60 cursor-not-allowed" />
          <Input placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Email (opsional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="NUPTK (opsional)" value={nuptk} onChange={(e) => setNuptk(e.target.value)} />
          <Input placeholder="NIP (opsional)" value={nip} onChange={(e) => setNip(e.target.value)} />

          <Select
            value={gender || "all"}
            onValueChange={(v) => setGender(v === "all" ? "" : (v as "L" | "P"))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Jenis Kelamin (opsional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Pilih Jenis Kelamin</SelectItem>
              <SelectItem value="L">Laki-laki</SelectItem>
              <SelectItem value="P">Perempuan</SelectItem>
            </SelectContent>
          </Select>

          <Select value={type} onValueChange={(v) => setType(v as GtkTypeClient)}>
            <SelectTrigger>
              <SelectValue placeholder="Jenis GTK" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GURU">Guru</SelectItem>
              <SelectItem value="TENDIK">Tendik / Pegawai</SelectItem>
              <SelectItem value="KEPALA_SEKOLAH">Kepala Sekolah</SelectItem>
              <SelectItem value="KEPALA_SEKSI">Kepala Seksi</SelectItem>
              <SelectItem value="KEPALA_CABANG_DINAS">Kepala Cabang Dinas</SelectItem>
            </SelectContent>
          </Select>

          <Input placeholder="Mapel (opsional)" value={mapel} onChange={(e) => setMapel(e.target.value)} />
          <Input disabled value={schoolName} readOnly className="bg-muted/60 cursor-not-allowed" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
