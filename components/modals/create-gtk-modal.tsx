"use client";

import { useEffect, useMemo, useState } from "react";
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

type SchoolOption = {
  npsn: string;
  name: string;
  city: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

// mirror enum GtkType di client
type GtkTypeClient =
  | "GURU"
  | "TENDIK"
  | "KEPALA_SEKOLAH"
  | "KEPALA_SEKSI"
  | "KEPALA_CABANG_DINAS";

export function CreateGTKModal({ open, onOpenChange, onCreated }: Props) {
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [saving, setSaving] = useState(false);

  const [nik, setNik] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nuptk, setNuptk] = useState("");
  const [nip, setNip] = useState("");
  const [gender, setGender] = useState<"L" | "P" | "">("");
  const [type, setType] = useState<GtkTypeClient>("GURU");
  const [mapel, setMapel] = useState("");
  const [schoolNpsn, setSchoolNpsn] = useState("");

  const canSubmit = useMemo(
    () => nik.trim() && name.trim() && schoolNpsn.trim(),
    [nik, name, schoolNpsn],
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadSchools() {
      setLoadingSchools(true);
      try {
        const res = await fetch("/api/super-admin/schools", {
          cache: "no-store",
        });
        if (!res.ok) {
          console.error(await res.text());
          return;
        }
        const json = await res.json();
        if (cancelled) return;

        const list: SchoolOption[] = json.data ?? [];
        setSchools(list);

        if (!schoolNpsn && list.length > 0) {
          setSchoolNpsn(list[0].npsn);
        }
      } catch (e) {
        if (!cancelled) console.error(e);
      } finally {
        if (!cancelled) setLoadingSchools(false);
      }
    }

    loadSchools();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function resetForm() {
    setNik("");
    setName("");
    setEmail("");
    setNuptk("");
    setNip("");
    setGender("");
    setType("GURU");
    setMapel("");
    // schoolNpsn dipertahankan
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/gtk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nik: nik.trim(),
          name: name.trim(),
          email: email.trim() || undefined,
          nuptk: nuptk.trim() || undefined,
          nip: nip.trim() || undefined,
          gender: gender || undefined, // "L" | "P" | undefined
          type, // enum string GtkTypeClient
          mapel: mapel.trim() || undefined,
          schoolNpsn,
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
        alert(json?.error || text || "Gagal menambah GTK.");
        return;
      }

      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      console.error(e);
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
            <Label htmlFor="nik">NIK <span className="text-red-600">*</span></Label>
            <Input id="nik" placeholder="3573013213210001" value={nik} onChange={(e) => setNik(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="name">Nama <span className="text-red-600">*</span></Label>
            <Input id="name" placeholder="Budi Santoso" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" placeholder="nama@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="nuptk">NUPTK</Label>
            <Input id="nuptk" placeholder="7456321672130072" value={nuptk} onChange={(e) => setNuptk(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label>Jenis Kelamin</Label>
            <Select value={gender || "all"} onValueChange={(v) => setGender(v === "all" ? "" : (v as "L" | "P"))}>
              <SelectTrigger id="gender">
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
            <Select value={type} onValueChange={(v) => setType(v as GtkTypeClient)}>
              <SelectTrigger id="gtkType">
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
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="mapel">Mapel</Label>
            <Input id="mapel" placeholder="Mapel (opsional)" value={mapel} onChange={(e) => setMapel(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label>Pilih Sekolah</Label>
            <Select value={schoolNpsn} onValueChange={setSchoolNpsn} disabled={loadingSchools || schools.length === 0}>
              <SelectTrigger id="schoolNpsn">
                <SelectValue placeholder={loadingSchools ? "Memuat sekolah..." : "Pilih Sekolah"} />
              </SelectTrigger>
              <SelectContent>
                {schools.map((s) => (
                  <SelectItem key={s.npsn} value={s.npsn}>
                    {s.name} — {s.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
