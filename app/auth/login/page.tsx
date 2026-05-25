"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type ApiLoginOk = {
  ok: true;
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
    branchId: string | null;
    schoolNpsn: string | null;
    gtkNik: string | null;
  };
};

type ApiLoginErr = { error: string };

async function safeReadJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = searchParams.get("next") || "/dashboard";

  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);

    const u = username.trim();
    const p = password.trim();

    if (!u || !p) {
      setErrorMsg("Username dan password wajib diisi.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: u, password: p }),
      });

      const data = (await safeReadJson(res)) as ApiLoginOk | ApiLoginErr | null;

      if (!res.ok) {
        setErrorMsg(
          (data as any)?.error ?? "Login gagal. Periksa username/password."
        );
        return;
      }

      const go = (data as any)?.next || `/auth/choose-role?next=${encodeURIComponent(next)}`;
      window.location.href = go;
    } catch (err) {
      console.error(err);
      setErrorMsg("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-8 space-y-6">
          <div className="flex flex-col items-center text-center">

            <div className="text-sm text-muted-foreground leading-snug">
              <p>PEMERINTAH PROVINSI JAWA TIMUR</p>
              <p>DINAS PENDIDIKAN</p>
            </div>

            <Image
              src="/logo-dindik.png"
              alt="Logo Dinas Pendidikan"
              width={80}
              height={80}
              priority
            />

            <h1 className="text-2xl font-bold tracking-wide">SIPODI</h1>

            <div className="text-sm text-muted-foreground leading-snug">
              <p>SISTEM INFORMASI POTENSI DIRI</p>
              <p>CABANG DINAS PENDIDIKAN WILAYAH MALANG</p>
              <p>(KOTA MALANG - KOTA BATU)</p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan password"
                  className="pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Lihat password"
                  }
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {errorMsg ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMsg}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Memproses..." : "Masuk"}
            </Button>
          </form>

          <div className="text-xs text-muted-foreground text-center">
            Gunakan Nama Lengkap sebagai username dan NIK sebagai password awal.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
