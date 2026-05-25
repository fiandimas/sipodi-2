"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type UserForDelete = {
  id: string;
  username: string;
  name: string;
};

interface DeleteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserForDelete | null;
  onSuccess?: () => void;
}

export function DeleteUserModal({
  open,
  onOpenChange,
  user,
  onSuccess,
}: DeleteUserModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  if (!user) return null;

  const handleDelete = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/users/${user.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setErrorMsg(json?.error || "Gagal menghapus user.");
        setLoading(false);
        return;
      }

      if (onSuccess) onSuccess();
      setLoading(false);
      onOpenChange(false);
    } catch (e) {
      console.error("delete user error", e);
      setErrorMsg("Terjadi kesalahan jaringan.");
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setErrorMsg(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hapus User</DialogTitle>
          <DialogDescription>
            Anda akan menghapus user{" "}
            <span className="font-semibold">{user.username}</span> (
            {user.name}). Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <p className="text-sm text-destructive mb-2">{errorMsg}</p>
        )}

        <DialogFooter className="space-x-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menghapus...
              </>
            ) : (
              "Hapus"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
