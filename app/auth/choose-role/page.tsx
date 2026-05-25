"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Mode =
  | { role: "SUPER_ADMIN" }
  | { role: "USER_GTK"; gtkNik: string }
  | { role: "ADMIN_TALENTA"; talentFields: { id: string; name: string }[] }
  | {
      role: "ADMIN_SEKOLAH";
      options: {
        accessId: string;
        branchId: string | null;
        schoolNpsn: string | null;
        label: string;
      }[];
    };

type PendingResp =
  | {
      ok: true;
      user: { id: string; username: string; name: string };
      availableModes: Mode[];
    }
  | { error: string };

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function cancelPending() {
  await fetch("/api/auth/cancel-pending", {
    method: "POST",
    credentials: "include",
  }).catch(() => null);
}

export default function ChooseRolePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [userLabel, setUserLabel] = useState<string>("");
  const [modes, setModes] = useState<Mode[]>([]);
  const [selectedSchoolAccessId, setSelectedSchoolAccessId] = useState<string>("");

  const didLoadRef = useRef(false);
  const didAutoSelectRef = useRef(false);

  const schoolMode = useMemo(
    () =>
      modes.find((m) => m.role === "ADMIN_SEKOLAH") as
        | Extract<Mode, { role: "ADMIN_SEKOLAH" }>
        | undefined,
    [modes]
  );

  const hasAnyMode = !loading && modes.length > 0;

  async function selectMode(body: any) {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/select-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const json = await safeJson(res);
      if (!res.ok) {
        setErrorMsg(json?.error ?? "Gagal memilih role.");
        return;
      }

      // ✅ Hard navigation: paling stabil untuk cookie session baru
      window.location.href = next;
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    // ✅ Guard agar tidak double-run di React Strict Mode (dev)
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMsg(null);

      try {
        const res = await fetch("/api/auth/pending", {
          cache: "no-store",
          credentials: "include",
        });

        const json = (await safeJson(res)) as PendingResp | null;
        if (cancelled) return;

        if (!res.ok || !json || (json as any).error) {
          setErrorMsg(
            (json as any)?.error ??
              "Tidak bisa memuat pilihan role. Silakan login ulang."
          );
          setModes([]);
          setUserLabel("");
          return;
        }

        const ok = json as Extract<PendingResp, { ok: true }>;
        const available = ok.availableModes ?? [];

        setUserLabel(`${ok.user.name} (@${ok.user.username})`);
        setModes(available);

        const sm = available.find((m) => m.role === "ADMIN_SEKOLAH") as
          | Extract<Mode, { role: "ADMIN_SEKOLAH" }>
          | undefined;

        if (sm?.options?.length) setSelectedSchoolAccessId(sm.options[0].accessId);
        else setSelectedSchoolAccessId("");

        // ✅ Auto-select jika hanya 1 mode (hindari double call)
        if (!didAutoSelectRef.current && available.length === 1) {
          didAutoSelectRef.current = true;
          const m = available[0];

          if (m.role === "ADMIN_SEKOLAH") {
            const first = m.options?.[0]?.accessId;
            if (first) await selectMode({ role: "ADMIN_SEKOLAH", accessId: first });
          } else {
            await selectMode({ role: m.role });
          }
        }
      } catch {
        if (!cancelled) setErrorMsg("Terjadi kesalahan jaringan. Silakan coba lagi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goLogin() {
    await cancelPending();
    router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
    router.refresh();
  }

  async function cancelToNext() {
    await cancelPending();
    window.location.href = next;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle>Pilih Mode Akses</CardTitle>
          <CardDescription>
            {loading ? "Memuat..." : `Masuk sebagai: ${userLabel || "-"}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMsg ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </div>
          ) : null}

          {!loading && modes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {modes.map((m, idx) => (
                <Badge key={`${m.role}-${idx}`} variant="secondary">
                  {m.role}
                </Badge>
              ))}
            </div>
          ) : null}

          {!loading && !hasAnyMode ? (
            <div className="flex flex-col gap-2">
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Akun tidak memiliki mode akses (GTK/Talenta/Sekolah/Super Admin).
              </div>
              <Button onClick={goLogin}>Ke Login</Button>
              <Button variant="outline" onClick={cancelToNext}>
                Batal
              </Button>
            </div>
          ) : null}

          {hasAnyMode ? (
            <div className="grid gap-3">
              {modes.some((m) => m.role === "SUPER_ADMIN") && (
                <Button disabled={submitting} onClick={() => selectMode({ role: "SUPER_ADMIN" })}>
                  Masuk sebagai Super Admin
                </Button>
              )}

              {modes.some((m) => m.role === "USER_GTK") && (
                <Button
                  variant="outline"
                  disabled={submitting}
                  onClick={() => selectMode({ role: "USER_GTK" })}
                >
                  Masuk sebagai User GTK
                </Button>
              )}

              {modes.some((m) => m.role === "ADMIN_TALENTA") && (
                <Card>
                  <CardContent className="py-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">Admin Talenta</div>
                        <div className="text-sm text-muted-foreground">
                          Bidang mengikuti permission yang diberikan Super Admin.
                        </div>
                      </div>
                      <Button disabled={submitting} onClick={() => selectMode({ role: "ADMIN_TALENTA" })}>
                        Masuk
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {schoolMode ? (
                <Card>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">Admin Sekolah</div>
                        <div className="text-sm text-muted-foreground">
                          Pilih scope sekolah/cabang yang akan dipakai.
                        </div>
                      </div>
                      <Button
                        disabled={submitting || !selectedSchoolAccessId}
                        onClick={() =>
                          selectMode({
                            role: "ADMIN_SEKOLAH",
                            accessId: selectedSchoolAccessId,
                          })
                        }
                      >
                        Masuk
                      </Button>
                    </div>

                    <Select
                      value={selectedSchoolAccessId}
                      onValueChange={setSelectedSchoolAccessId}
                      disabled={submitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih sekolah/cabang" />
                      </SelectTrigger>
                      <SelectContent>
                        {schoolMode.options.map((o) => (
                          <SelectItem key={o.accessId} value={o.accessId}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              ) : null}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={cancelToNext}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={goLogin}
                  className="flex-1"
                >
                  Login ulang
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
