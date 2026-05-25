"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type MeResponse = {
  gtk: {
    nik: string;
    name: string;
    schoolName: string;
    photoUrl?: string | null;
  };
};

export default function GtkSettingsPage() {
  const [me, setMe] = useState<MeResponse["gtk"] | null>(null);

  // upload avatar
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // change password
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);

  const initials = useMemo(() => {
    const name = me?.name ?? "User";
    return (
      name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "U"
    );
  }, [me?.name]);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const loadMe = async () => {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as MeResponse;
    setMe(json.gtk);
  };

  useEffect(() => {
    loadMe();
  }, []);

  const handleUpload = async () => {
    if (uploading) return;

    if (!file) {
      toast.error("Pilih file dulu.");
      return;
    }

    setUploading(true);

    const p = (async () => {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/gtk/profile-photo", {
        method: "POST",
        body: form,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Gagal upload foto");
      }

      await loadMe();
      setFile(null);
      return true;
    })();

    toast.promise(p, {
      loading: "Mengupload foto...",
      success: "Foto profil berhasil diperbarui",
      error: (e) => (e instanceof Error ? e.message : "Gagal upload foto"),
    });

    try {
      await p;
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async () => {
    if (changing) return;

    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("Semua field password wajib diisi.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password tidak sama.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password baru minimal 8 karakter.");
      return;
    }

    setChanging(true);

    const p = (async () => {
      const res = await fetch("/api/gtk/settings/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Gagal mengganti password");
      }

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      return true;
    })();

    toast.promise(p, {
      loading: "Mengubah password...",
      success: "Password berhasil diubah",
      error: (e) =>
        e instanceof Error ? e.message : "Gagal mengganti password",
    });

    try {
      await p;
    } finally {
      setChanging(false);
    }
  };

  return (
    <DashboardLayout
      role="user"
      userName={me?.name ?? "-"}
      userPhotoUrl={me?.photoUrl ?? "/avatar.png"}
    >
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Ubah foto profil dan password akun GTK.
          </p>
        </div>

        {/* Foto profil */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Foto profil</CardTitle>
            <CardDescription>Upload PNG/JPG/WebP (max 2MB).</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage
                  src={previewUrl ?? me?.photoUrl ?? "/avatar.png"}
                />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-2">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                />

                <div className="flex gap-2">
                  <Button onClick={handleUpload} disabled={!file || uploading}>
                    {uploading ? "Uploading..." : "Upload"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setFile(null)}
                    disabled={!file || uploading}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ubah password */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ubah password</CardTitle>
            <CardDescription>
              Masukkan password lama, lalu password baru.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">Password lama</Label>
              <Input
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={changing}
                placeholder="Password lama"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Password baru</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={changing}
                placeholder="Minimal 8 karakter"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Konfirmasi password baru</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={changing}
                placeholder="Ulangi password baru"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleChangePassword} disabled={changing}>
                {changing ? "Menyimpan..." : "Simpan password"}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={changing}
                onClick={() => {
                  setOldPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  toast.message("Form direset");
                }}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
