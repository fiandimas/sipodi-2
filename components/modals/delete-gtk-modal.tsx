"use client";

import { useEffect, useState } from "react";
import type { GTK } from "@/lib/types/gtk";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gtk: GTK | null;
  onDeleted?: () => void;
}

export function DeleteGTKModal({ open, onOpenChange, gtk, onDeleted }: Props) {
  const [nik, setNik] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gtk) {
      setNik("");
      setName("");
      return;
    }
    setNik(gtk.nik);
    setName(gtk.name ?? "");
  }, [gtk, open]);

  if (!gtk) return null;

  async function handleDelete() {
    if (!nik || loading) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/super-admin/gtk/${encodeURIComponent(nik)}`,
        { method: "DELETE" }
      );

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        // ignore
      }

      if (!res.ok) {
        alert(json?.error || text || "Gagal menghapus GTK.");
        return;
      }

      onOpenChange(false);
      onDeleted?.();
    } catch (e) {
      console.error(e);
      alert("Gagal menghapus GTK.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hapus GTK</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Apakah Anda yakin ingin menghapus GTK <strong>{name}</strong>?
          Tindakan ini tidak dapat dibatalkan.
        </p>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Menghapus..." : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
