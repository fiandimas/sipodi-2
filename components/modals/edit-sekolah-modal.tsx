"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Level = "SMA" | "SMK" | "SLB";
type Status = "NEGERI" | "SWASTA";

type ApiSchool = {
  npsn: string;
  name: string;
  level: Level;
  status: Status;
  city: string;
  headName: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sekolah: ApiSchool | null;
  onSuccess?: () => void;
};

export default function EditSekolahModal({
  open,
  onOpenChange,
  sekolah,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("SMA");
  const [status, setStatus] = useState<Status>("NEGERI");
  const [city, setCity] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sekolah) return;
    setName(sekolah.name ?? "");
    setLevel(sekolah.level);
    setStatus(sekolah.status);
    setCity(sekolah.city ?? "");
    setErrorMsg(null);
  }, [open, sekolah]);

  const handleClose = () => {
    setErrorMsg(null);
    onOpenChange(false);
  };

  async function handleSave() {
    if (!sekolah || loading) return;

    setErrorMsg(null);

    const nameTrim = name.trim();
    const cityTrim = city.trim();

    if (!nameTrim || !cityTrim) {
      setErrorMsg("Nama sekolah dan kota wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/super-admin/school-management/${encodeURIComponent(
          sekolah.npsn,
        )}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nameTrim,
            level,
            status,
            city: cityTrim,
            // headName tidak dikirim: dikontrol dari GTK
          }),
        },
      );

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        // ignore
      }

      if (!res.ok) {
        setErrorMsg(json?.error ?? "Gagal menyimpan perubahan.");
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

  const s = sekolah;
  if (!s) return null;

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
          <DialogTitle>Edit Sekolah</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Nama Sekolah */}
          <div className="space-y-1.5">
            <Label>Nama Sekolah</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* NPSN (readonly) */}
          <div className="space-y-1.5">
            <Label>NPSN</Label>
            <Input value={s.npsn} readOnly className="bg-muted/40" />
            <p className="text-xs text-muted-foreground">
              NPSN tidak bisa diubah.
            </p>
          </div>

          {/* Jenjang - Status - Kota */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Jenjang</Label>
              <Select
                value={level}
                onValueChange={(v) => setLevel(v as Level)}
              >
                <SelectTrigger>
                  <SelectValue />
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
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as Status)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEGERI">Negeri</SelectItem>
                  <SelectItem value="SWASTA">Swasta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Kota</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          {/* Kepala Sekolah (read-only, dari GTK) */}
          <div className="space-y-1.5">
            <Label>Kepala Sekolah</Label>
            <Input
              value={s.headName ?? "-"}
              readOnly
              className="bg-muted/40"
            />
            <p className="text-xs text-muted-foreground">
              Kepala sekolah diambil dari data GTK dengan jenis &quot;Kepala
              Sekolah&quot;.
            </p>
          </div>

          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
