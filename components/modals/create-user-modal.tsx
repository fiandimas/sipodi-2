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
type GtkOption = { nik: string; name: string; schoolName: string; hasUser?: boolean };
type TalentFieldOption = { id: string; name: string; isActive?: boolean };

type FormValues = {
  username: string;
  name: string;
  password: string;
  role: UserRole;

  branchId?: string | null;
  schoolNpsn?: string | null;
  gtkNik?: string | null;

  talentFieldIds: string[];
};

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateUserModal({ open, onOpenChange, onSuccess }: CreateUserModalProps) {
  const router = useRouter();

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
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
    },
  });

  const role = watch("role");

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [gtks, setGtks] = useState<GtkOption[]>([]);
  const [talentFields, setTalentFields] = useState<TalentFieldOption[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const GTK_ENDPOINT = "/api/super-admin/gtks?simple=1&withUser=1";

  const reloadGtks = async () => {
    try {
      const g = await fetch(GTK_ENDPOINT, { cache: "no-store" }).then((r) => r.json());
      setGtks((g.data ?? []) as GtkOption[]);
    } catch (e) {
      console.error("reload gtks error", e);
      setErrorMsg("Gagal memuat ulang data GTK.");
    }
  };

  useEffect(() => {
    if (!open) return;

    setErrorMsg(null);
    setLoadingMeta(true);

    // reset form tiap buka modal
    reset({
      username: "",
      name: "",
      password: "",
      role: "USER_GTK",
      branchId: null,
      schoolNpsn: null,
      gtkNik: null,
      talentFieldIds: [],
    });

    Promise.all([
      fetch("/api/super-admin/branches?simple=1", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/super-admin/schools?simple=1", { cache: "no-store" }).then((r) => r.json()),
      fetch(GTK_ENDPOINT, { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/super-admin/talent-fields?active=true", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([b, s, g, tf]) => {
        setBranches((b.data ?? []) as BranchOption[]);
        setSchools((s.data ?? []) as SchoolOption[]);
        setGtks((g.data ?? []) as GtkOption[]);
        setTalentFields((tf.data ?? []) as TalentFieldOption[]);
      })
      .catch((e) => {
        console.error("load master user error", e);
        setErrorMsg("Gagal memuat data master (cabang/sekolah/GTK/bidang).");
      })
      .finally(() => setLoadingMeta(false));
  }, [open, reset]);

  // tampilkan hanya GTK yang belum punya user
  const filteredGtks = useMemo(() => {
    return gtks.filter((g) => !g.hasUser);
  }, [gtks]);

  const handleGtkChange = (gtkNik: string) => {
    setValue("gtkNik", gtkNik, { shouldDirty: true });

    const g = filteredGtks.find((x) => x.nik === gtkNik);
    if (!g) return;

    // auto-fill hanya jika field masih kosong (biar admin bisa override)
    const currentUsername = (getValues("username") ?? "").trim();
    const currentName = (getValues("name") ?? "").trim();
    const currentPassword = (getValues("password") ?? "").trim();

    if (!currentUsername) setValue("username", g.name, { shouldDirty: true });
    if (!currentName) setValue("name", g.name, { shouldDirty: true });
    if (!currentPassword) setValue("password", g.nik, { shouldDirty: true });
  };

  // bersihkan field yang tidak relevan saat role berubah
  useEffect(() => {
    if (!open) return;

    if (role === "SUPER_ADMIN") {
      setValue("branchId", null);
      setValue("schoolNpsn", null);
      setValue("gtkNik", null);
      setValue("talentFieldIds", []);
    }

    if (role === "ADMIN_TALENTA") {
      setValue("schoolNpsn", null);
      setValue("gtkNik", null);
    }

    if (role === "ADMIN_SEKOLAH") {
      setValue("branchId", null);
      setValue("gtkNik", null);
      setValue("talentFieldIds", []);
    }

    if (role === "USER_GTK") {
      setValue("branchId", null);
      setValue("schoolNpsn", null);
      setValue("talentFieldIds", []);
    }
  }, [role, open, setValue]);

  const toggleTalentField = (fieldId: string, checked: boolean) => {
    const current = watch("talentFieldIds") ?? [];
    setValue(
      "talentFieldIds",
      checked ? Array.from(new Set([...current, fieldId])) : current.filter((id) => id !== fieldId),
      { shouldDirty: true }
    );
  };

  const selectedTalentFieldIds = watch("talentFieldIds") ?? [];
  const activeTalentFields = useMemo(
    () => (talentFields ?? []).filter((f) => f.isActive !== false),
    [talentFields]
  );

  const cannotSubmit =
    isSubmitting || (role === "USER_GTK" && filteredGtks.length === 0);

  const onSubmit = async (values: FormValues) => {
    setErrorMsg(null);

    const usernameForCheck = values.username?.trim();
    const nameForCheck = values.name?.trim();

    if (!usernameForCheck || !nameForCheck || !values.password) {
      setErrorMsg("Username, nama, dan password wajib diisi.");
      return;
    }

    if (/\s/.test(usernameForCheck)) {
      setErrorMsg("Username tidak boleh mengandung spasi.");
      return;
    }

    if (values.password.length < 6) {
      setErrorMsg("Password minimal 6 karakter.");
      return;
    }

    const body: any = {
      username: usernameForCheck,
      name: nameForCheck,
      password: values.password,
      role: values.role,
    };

    if (values.role === "SUPER_ADMIN") {
      body.branchId = null;
      body.schoolNpsn = null;
      body.gtkNik = null;
      body.talentFieldIds = [];
    }

    if (values.role === "ADMIN_TALENTA") {
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
    }

    if (values.role === "ADMIN_SEKOLAH") {
      if (!values.schoolNpsn) {
        setErrorMsg("Pilih sekolah untuk Admin Sekolah.");
        return;
      }
      body.schoolNpsn = values.schoolNpsn;
      body.branchId = null;
      body.gtkNik = null;
      body.talentFieldIds = [];
    }

    if (values.role === "USER_GTK") {
      if (filteredGtks.length === 0) {
        setErrorMsg("Belum ada data GTK yang bisa dipakai. Buat data GTK dulu di menu Data GTK.");
        return;
      }
      if (!values.gtkNik) {
        setErrorMsg("Pilih GTK untuk User GTK.");
        return;
      }
      body.gtkNik = values.gtkNik;
      body.branchId = null;
      body.schoolNpsn = null;
      body.talentFieldIds = [];
    }

    try {
      const res = await fetch("/api/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(json?.error || "Gagal membuat user baru.");
        return;
      }

      if (onSuccess) onSuccess();
      reset();
      onOpenChange(false);
    } catch (e) {
      console.error("create user error", e);
      setErrorMsg("Terjadi kesalahan jaringan.");
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      setErrorMsg(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tambah User</DialogTitle>
          <DialogDescription>
            Buat akun user baru dan tentukan role serta keterkaitannya dengan cabang, sekolah, atau GTK.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="off"
                placeholder="mis. user01"
                {...register("username", { required: true })}
              />
              <p className="text-xs text-muted-foreground">Username untuk login. Disarankan tanpa spasi.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Nama</Label>
              <Input id="name" placeholder="Nama lengkap user" {...register("name", { required: true })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimal 6 karakter"
              {...register("password", { required: true, minLength: 6 })}
            />
            {role === "USER_GTK" && (
              <p className="text-xs text-muted-foreground">
                Untuk User GTK, password bisa otomatis diisi NIK saat GTK dipilih (masih bisa Anda ubah).
              </p>
            )}
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
              <p className="text-xs text-muted-foreground">Role menentukan kewenangan dan kebutuhan relasi.</p>
            </div>

            {role === "ADMIN_TALENTA" && (
              <div className="space-y-1.5">
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
                      <SelectTrigger>
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
              <div className="space-y-1.5">
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
                      <SelectTrigger>
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

            {role === "USER_GTK" && (
              <div className="space-y-3 sm:col-span-2">
                <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-2">
                  <p className="font-medium">Syarat User GTK</p>
                  <p className="text-muted-foreground">
                    Untuk membuat akun User GTK, data GTK (NIK) harus sudah ada di menu Data GTK.
                    Jika daftar GTK kosong, buat data GTK terlebih dahulu lalu kembali ke sini.
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
                        onValueChange={(v) => handleGtkChange(v)}
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
                  <p className="text-xs text-muted-foreground">
                    Hanya GTK yang belum punya akun yang ditampilkan. Field username/nama/password bisa auto-fill saat GTK dipilih.
                  </p>
                </div>
              </div>
            )}
          </div>

          {role === "ADMIN_TALENTA" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Bidang Talenta</Label>
                <span className="text-xs text-muted-foreground">Terpilih: {selectedTalentFieldIds.length}</span>
              </div>

              <div className="rounded-md border p-3 max-h-56 overflow-auto space-y-2">
                {loadingMeta ? (
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

              <p className="text-xs text-muted-foreground">
                Admin Talenta harus memiliki minimal 1 bidang agar bisa login sebagai Admin Talenta.
              </p>
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
              ) : role === "USER_GTK" && filteredGtks.length === 0 ? (
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
