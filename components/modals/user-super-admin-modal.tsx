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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userLabel?: string;
  onChanged?: () => void;
};

export default function UserSuperAdminModal({
  open,
  onOpenChange,
  userId,
  userLabel = "User",
  onChanged,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);

  const canInteract = useMemo(() => !!userId && !loading && !saving, [userId, loading, saving]);

  useEffect(() => {
    if (!open || !userId) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/super-admin/users/${userId}/super-admin`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok) {
          setErrorMsg(json?.error ?? "Gagal memuat status Super Admin.");
          return;
        }

        setEnabled(!!json?.enabled);
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

  // reset state saat modal ditutup
  useEffect(() => {
    if (open) return;
    setErrorMsg(null);
    setEnabled(false);
    setLoading(false);
    setSaving(false);
  }, [open]);

  async function setSuperAdmin(nextEnabled: boolean) {
    if (!userId) return;

    setSaving(true);
    setErrorMsg(null);

    // optimistic
    setEnabled(nextEnabled);

    try {
      const res = await fetch(`/api/super-admin/users/${userId}/super-admin`, {
        method: nextEnabled ? "POST" : "DELETE",
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setEnabled(!nextEnabled); // rollback
        setErrorMsg(json?.error ?? "Gagal mengubah akses Super Admin.");
        return;
      }

      onChanged?.();
    } catch {
      setEnabled(!nextEnabled); // rollback
      setErrorMsg("Terjadi kesalahan jaringan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kelola Akses Super Admin</DialogTitle>
          <DialogDescription>
            Toggle akses Super Admin untuk: <b>{userLabel}</b>
          </DialogDescription>
        </DialogHeader>

        {errorMsg ? (
          <Card className="border-rose-200">
            <CardContent className="py-3 text-sm text-rose-700">{errorMsg}</CardContent>
          </Card>
        ) : null}

        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Super Admin</div>
            <div className="text-xs text-muted-foreground">
              Role global tanpa scope sekolah/cabang.
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={enabled ? "default" : "secondary"}>
                {enabled ? "Enabled" : "Disabled"}
              </Badge>
              {loading ? (
                <Badge className="bg-blue-600 text-white hover:bg-blue-600">Memuat…</Badge>
              ) : null}
              {saving ? (
                <Badge variant="outline" className="gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menyimpan…
                </Badge>
              ) : null}
            </div>
          </div>

          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              if (!canInteract) return;
              setSuperAdmin(!!v);
            }}
            disabled={!canInteract}
          />
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
