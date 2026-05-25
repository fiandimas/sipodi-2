"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type FieldRow = { id: string; name: string; isActive: boolean };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userLabel?: string;
  onChanged?: () => void;
};

export default function UserTalentAdminModal({
  open,
  onOpenChange,
  userId,
  userLabel = "User",
  onChanged,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [fields, setFields] = useState<FieldRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (!open || !userId) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [resFields, resUser] = await Promise.all([
          fetch("/api/super-admin/talent-fields?active=true", { cache: "no-store" }),
          fetch(`/api/super-admin/users/${userId}/talent-fields`, { cache: "no-store" }),
        ]);

        const jsonFields = await resFields.json().catch(() => ({}));
        const jsonUser = await resUser.json().catch(() => ({}));

        if (cancelled) return;

        if (!resFields.ok) {
          setErrorMsg(jsonFields?.error ?? "Gagal memuat daftar bidang.");
          return;
        }
        if (!resUser.ok) {
          setErrorMsg(jsonUser?.error ?? "Gagal memuat bidang user.");
          return;
        }

        const all = Array.isArray(jsonFields?.data) ? jsonFields.data : [];
        const mine = Array.isArray(jsonUser?.data) ? jsonUser.data : [];

        setFields(all);
        setSelectedIds(mine.map((f: any) => f.id));
      } catch {
        if (!cancelled) setErrorMsg("Terjadi kesalahan jaringan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    if (open) return;
    setErrorMsg(null);
    setFields([]);
    setSelectedIds([]);
    setLoading(false);
    setSaving(false);
  }, [open]);

  function toggle(id: string, checked: boolean) {
    setSelectedIds((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)
    );
  }

  async function save() {
    if (!userId) return;

    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/super-admin/users/${userId}/talent-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldIds: selectedIds }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(json?.error ?? "Gagal menyimpan bidang.");
        return;
      }

      onChanged?.();
      onOpenChange(false);
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kelola Admin Talenta</DialogTitle>
          <DialogDescription>
            Pilih bidang talenta yang boleh diakses untuk: <b>{userLabel}</b>
          </DialogDescription>
        </DialogHeader>

        {errorMsg ? (
          <Card className="border-rose-200">
            <CardContent className="py-3 text-sm text-rose-700">{errorMsg}</CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Role: ADMIN_TALENTA</Badge>
          <Badge variant="outline">Dipilih: {selectedIds.length}</Badge>
          {loading ? (
            <Badge className="bg-blue-600 text-white hover:bg-blue-600">Memuat…</Badge>
          ) : null}
        </div>

        <div className="max-h-[360px] overflow-auto rounded-md border p-3 space-y-2">
          {fields.length === 0 && !loading ? (
            <div className="text-sm text-muted-foreground">Tidak ada bidang aktif.</div>
          ) : null}

          {fields.map((f) => (
            <label key={f.id} className="flex items-center gap-3 py-1">
              <Checkbox
                checked={selectedSet.has(f.id)}
                onCheckedChange={(v) => toggle(f.id, v === true)}
                disabled={saving || loading}
              />
              <span className="text-sm">{f.name}</span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
