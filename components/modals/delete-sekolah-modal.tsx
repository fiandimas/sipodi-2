"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteSekolahModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  npsn: string | null; // wajib untuk API
  namaSekolah?: string;
  onSuccess?: () => void;
}

export function DeleteSekolahModal({
  open,
  onOpenChange,
  npsn,
  namaSekolah,
  onSuccess,
}: DeleteSekolahModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClose = () => {
    setErrorMsg(null);
    setLoading(false);
    onOpenChange(false);
  };

  async function handleDelete() {
    if (!npsn || loading) return;

    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/super-admin/school-management/${encodeURIComponent(npsn)}`,
        { method: "DELETE" },
      );

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        // ignore
      }

      if (!res.ok) {
        setErrorMsg(json?.error ?? "Gagal menghapus sekolah.");
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Hapus Sekolah</DialogTitle>
          <DialogDescription>
            Apakah Anda yakin ingin menghapus{" "}
            <span className="font-semibold">
              {namaSekolah ?? "(tanpa nama)"}
            </span>
            ? Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || !npsn}
          >
            {loading ? "Menghapus..." : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
