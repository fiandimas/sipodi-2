"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole } from "@prisma/client";

type BranchOption = { id: string; name: string; city: string };
type SchoolOption = { npsn: string; name: string; city: string };

type GtkOption = {
  nik: string;
  name: string;
  schoolName: string;
  hasUser?: boolean;
  userId?: string | null;
};

type TalentFieldOption = { id: string; name: string; isActive?: boolean };

type UserRow = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  branchId: string | null;
  schoolNpsn: string | null;
  gtkNik: string | null;
  isActive?: boolean;
};

type FormValues = {
  username: string;
  name: string;
  password?: string;
  role: UserRole;

  branchId?: string | null;
  schoolNpsn?: string | null;
  gtkNik?: string | null;

  talentFieldIds: string[];
  isActive?: boolean;
};

interface EditUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserRow | null;
  onSuccess?: () => void;
}

export function EditUserModal({ open, onOpenChange, user, onSuccess }: EditUserModalProps) {
  const router = useRouter();

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      username: "",
      name: "",
      password: "",
      role: "USER_GTK",
      branchId: null,
      schoolNpsn: null,
      gtkNik: null,
      talentFieldIds: [],
      isActive: true,
    },
  });

  const role = watch("role");
  const watchedGtkNik = watch("gtkNik");

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [gtks, setGtks] = useState<GtkOption[]>([]);
  const [talentFields, setTalentFields] = useState<TalentFieldOption[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const GTK_ENDPOINT = user
    ? `/api/super-admin/gtks?simple=1&withUser=1&includeUserId=${user.id}`
    : "/api/super-admin/gtks?simple=1&withUser=1";

  const reloadGtks = async () => {
    try {
      if (!user) return;
      const url = `/api/super-admin/gtks?simple=1&withUser=1&includeUserId=${user.id}`;
      const g = await fetch(url, { cache: "no-store" }).then((r) => r.json());
      setGtks((g.data ?? []) as GtkOption[]);
    } catch (e) {
      console.error("reload gtks error", e);
      setErrorMsg("Gagal memuat ulang data GTK.");
    }
  };

  // load master + detail user bidang
  useEffect(() => {
    if (!open || !user) return;
    setErrorMsg(null);
    setLoadingMeta(true);
    setLoadingUserDetail(true);

    Promise.all([
      fetch("/api/super-admin/branches?simple=1", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/super-admin/schools?simple=1", { cache: "no-store" }).then((r) => r.json()),
      fetch(GTK_ENDPOINT, { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/super-admin/talent-fields?active=true", { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/super-admin/users/${user.id}/detail`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([b, s, g, tf, ud]) => {
        setBranches((b.data ?? []) as BranchOption[]);
        setSchools((s.data ?? []) as SchoolOption[]);
        setGtks((g.data ?? []) as GtkOption[]);
        setTalentFields((tf.data ?? []) as TalentFieldOption[]);

        const ids = (ud?.data?.talentFieldIds ?? []) as string[];
        setValue("talentFieldIds", ids, { shouldDirty: false });
      })
      .catch((e) => {
        console.error("load edit user meta error", e);
        setErrorMsg("Gagal memuat data master / detail user.");
      })
      .finally(() => {
        setLoadingMeta(false);
        setLoadingUserDetail(false);
      });
  }, [open, user, setValue, GTK_ENDPOINT]);

  useEffect(() => {
    if (!open || !user) return;

    reset({
      username: user.username ?? "",
      name: user.name ?? "",
      password: "",
      role: user.role,
      branchId: user.branchId,
      schoolNpsn: user.schoolNpsn,
      gtkNik: user.gtkNik,
      talentFieldIds: watch("talentFieldIds") ?? [],
      isActive: user.isActive ?? true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, reset]);

  // filter GTK: available jika belum punya userId, atau GTK ini adalah milik user yg sedang diedit
  const filteredGtks = useMemo(() => {
    const currentNik = user?.gtkNik ?? null;
    const currentUserId = user?.id ?? null;

    return gtks.filter((g) => {
      const ownedByThisUser =
        (currentNik && g.nik === currentNik) ||
        (currentUserId && g.userId && g.userId === currentUserId);

      const available = !g.userId;
      return available || ownedByThisUser;
    });
  }, [gtks, user?.gtkNik, user?.id]);

  // ✅ tampilkan picker GTK hanya jika role USER_GTK dan user belum punya gtkNik
  const shouldShowGtkPicker = role === "USER_GTK" && !user?.gtkNik;

  // bersihkan field yg tidak relevan saat role berubah
  useEffect(() => {
    if (!open) return;

    if (role !== "USER_GTK") {
      setValue("gtkNik", null);
    }

    if (role === "SUPER_ADMIN") {
      setValue("branchId", null);
      setValue("schoolNpsn", null);
      setValue("talentFieldIds", []);
    }

    if (role === "ADMIN_TALENTA") {
      setValue("schoolNpsn", null);
    }

    if (role === "ADMIN_SEKOLAH") {
      setValue("branchId", null);
      setValue("talentFieldIds", []);
    }

    if (role === "USER_GTK") {
      setValue("branchId", null);
      setValue("schoolNpsn", null);
      setValue("talentFieldIds", []);

      // restore gtkNik lama jika kosong (untuk kasus edit yang sudah punya gtkNik)
      if (!watchedGtkNik && user?.gtkNik) {
        setValue("gtkNik", user.gtkNik, { shouldDirty: false });
      }
    }
  }, [role, open, setValue, watchedGtkNik, user?.gtkNik]);

  const activeTalentFields = useMemo(
    () => (talentFields ?? []).filter((f) => f.isActive !== false),
    [talentFields]
  );

  const selectedTalentFieldIds = watch("talentFieldIds") ?? [];
  const toggleTalentField = (fieldId: string, checked: boolean) => {
    setValue(
      "talentFieldIds",
      checked
        ? Array.from(new Set([...(selectedTalentFieldIds ?? []), fieldId]))
        : (selectedTalentFieldIds ?? []).filter((id) => id !== fieldId),
      { shouldDirty: true }
    );
  };

  // submit disable:
  // - kalau user belum punya gtkNik, maka harus pilih gtkNik baru (filteredGtks harus ada)
  // - kalau user sudah punya gtkNik, jangan blok submit cuma karena filteredGtks kosong
  const cannotSubmit =
    isSubmitting || (role === "USER_GTK" && !user?.gtkNik && filteredGtks.length === 0);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    setErrorMsg(null);

    if (!values.username?.trim()) {
      setErrorMsg("Username wajib diisi.");
      return;
    }

    if (!values.name?.trim()) {
      setErrorMsg("Nama wajib diisi.");
      return;
    }

    const body: any = {
      username: values.username.trim(),
      name: values.name,
      isActive: values.isActive ?? true,
      role: values.role,
    };

    if (values.role === "SUPER_ADMIN") {
      body.branchId = null;
      body.schoolNpsn = null;
      body.gtkNik = null;
      body.talentFieldIds = [];
    } else if (values.role === "ADMIN_TALENTA") {
      if (!values.branchId) {
        setErrorMsg("Pilih cabang untuk Admin Talenta.");
        return;
      }
      if (!values.talentFieldIds || values.talentFieldIds.length === 0) {
        setErrorMsg("Pilih minimal 1 bidang untuk Admin Talenta.");
        return;
      }
      body.branchId = values.branchId;
      body.talentFieldIds = values.talentFieldIds;
      body.schoolNpsn = null;
      body.gtkNik = null;
    } else if (values.role === "ADMIN_SEKOLAH") {
      if (!values.schoolNpsn) {
        setErrorMsg("Pilih sekolah untuk Admin Sekolah.");
        return;
      }
      body.schoolNpsn = values.schoolNpsn;
      body.branchId = null;
      body.gtkNik = null;
      body.talentFieldIds = [];
    } else if (values.role === "USER_GTK") {
      // kalau user belum punya gtkNik, maka wajib pilih
      if (!user?.gtkNik) {
        if (filteredGtks.length === 0) {
          setErrorMsg("Belum ada data GTK yang bisa dipakai. Buat data GTK dulu di menu Data GTK.");
          return;
        }
        if (!values.gtkNik) {
          setErrorMsg("Pilih GTK untuk User GTK.");
          return;
        }
        body.gtkNik = values.gtkNik;
      } else {
        // user sudah punya gtkNik, tidak perlu memaksa pilih lagi.
        // Kalau admin ingin ganti relasi, boleh pilih gtkNik baru:
        if (values.gtkNik) body.gtkNik = values.gtkNik;
      }

      body.branchId = null;
      body.schoolNpsn = null;
      body.talentFieldIds = [];
    }

    if (values.password && values.password.length > 0) {
      if (values.password.length < 6) {
        setErrorMsg("Password minimal 6 karakter.");
        return;
      }
      body.resetPasswordTo = values.password;
    }

    try {
      const res = await fetch(`/api/super-admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(json?.error || "Gagal mengubah user.");
        return;
      }

      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (e) {
      console.error("edit user error", e);
      setErrorMsg("Terjadi kesalahan jaringan.");
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setErrorMsg(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Ubah data user, role, dan relasinya.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="off"
                placeholder="Username login"
                {...register("username", { required: true })}
              />
              <p className="text-xs text-muted-foreground">Username harus unik dan tanpa spasi.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Nama</Label>
              <Input id="name" {...register("name", { required: true })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password baru (opsional)</Label>
            <Input
              id="password"
              type="password"
              placeholder="Kosongkan jika tidak diganti"
              {...register("password")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v as UserRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                      <SelectItem value="ADMIN_TALENTA">Admin Talenta</SelectItem>
                      <SelectItem value="ADMIN_SEKOLAH">Admin Sekolah</SelectItem>
                      <SelectItem value="USER_GTK">User GTK</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">Role menentukan kebutuhan relasi.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value === false ? "false" : "true"}
                    onValueChange={(v) => field.onChange(v === "true")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {role === "ADMIN_TALENTA" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Cabang</Label>
                <Controller
                  name="branchId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v || null)}
                      disabled={loadingMeta}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={loadingMeta ? "Memuat cabang..." : "Pilih cabang"} />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name} – {b.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {role === "ADMIN_SEKOLAH" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Sekolah</Label>
                <Controller
                  name="schoolNpsn"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v || null)}
                      disabled={loadingMeta}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={loadingMeta ? "Memuat sekolah..." : "Pilih sekolah"} />
                      </SelectTrigger>
                      <SelectContent>
                        {schools.map((s) => (
                          <SelectItem key={s.npsn} value={s.npsn}>
                            {s.name} – {s.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {shouldShowGtkPicker && (
              <div className="space-y-3 sm:col-span-2">
                <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-2">
                  <p className="font-medium">Syarat User GTK</p>
                  <p className="text-muted-foreground">
                    Untuk role User GTK, harus memilih data GTK (NIK). Jika daftar kosong, buat data GTK terlebih dahulu
                    di menu Data GTK lalu kembali ke sini.
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => router.push("/super-admin/data-gtk")}>
                      Ke Data GTK
                    </Button>
                    <Button type="button" variant="outline" onClick={reloadGtks} disabled={loadingMeta}>
                      Refresh daftar GTK
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>GTK (wajib)</Label>
                  <Controller
                    name="gtkNik"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(v) => field.onChange(v)}
                        disabled={loadingMeta || filteredGtks.length === 0}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              loadingMeta
                                ? "Memuat GTK..."
                                : filteredGtks.length === 0
                                  ? "Tidak ada GTK tersedia — buat GTK dulu"
                                  : "Pilih GTK"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {filteredGtks.map((g) => (
                            <SelectItem key={g.nik} value={g.nik}>
                              {g.name} – {g.schoolName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            )}
          </div>

          {role === "ADMIN_TALENTA" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Bidang Talenta</Label>
                <span className="text-xs text-muted-foreground">
                  {loadingUserDetail ? "Memuat..." : `Terpilih: ${selectedTalentFieldIds.length}`}
                </span>
              </div>

              <div className="rounded-md border p-3 max-h-56 overflow-auto space-y-2">
                {loadingMeta || loadingUserDetail ? (
                  <div className="text-sm text-muted-foreground">Memuat bidang...</div>
                ) : activeTalentFields.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Tidak ada bidang aktif.</div>
                ) : (
                  activeTalentFields.map((f) => {
                    const checked = selectedTalentFieldIds.includes(f.id);
                    return (
                      <label key={f.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={checked} onCheckedChange={(v) => toggleTalentField(f.id, v === true)} />
                        <span>{f.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {errorMsg && <p className="text-sm text-destructive mt-1">{errorMsg}</p>}

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Batal
            </Button>

            <Button type="submit" className="bg-primary text-primary-foreground" disabled={cannotSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : role === "USER_GTK" && !user?.gtkNik && filteredGtks.length === 0 ? (
                "Buat GTK dulu"
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
