"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

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

      const go =
        (data as any)?.next ||
        `/auth/choose-role?next=${encodeURIComponent(next)}`;
      window.location.href = go;
    } catch (err) {
      console.error(err);
      setErrorMsg("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f9]">
      <div className="flex w-full min-h-screen bg-white overflow-hidden shadow-2xl">
        <div className="relative hidden md:flex flex-col w-[50%] bg-[#1155a8] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#023366]/95 via-[#0b4b8f]/90 to-[#196fc2]/80" />

          <svg
            className="absolute top-0 right-[-2px] h-full w-[140px] z-10"
            viewBox="0 0 140 768"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M140,0 C90,120 40,320 60,460 C75,560 110,680 140,768 Z"
              fill="white"
            />
          </svg>

          <div className="relative z-20 flex items-center gap-4 p-8 pl-10 mt-4">
            <Image
              src="/logo-dindik.png"
              alt="Logo Dinas Pendidikan"
              width={54}
              height={54}
              className="object-contain"
              priority
            />
            <div className="text-white text-2xl leading-snug font-sans tracking-wide font-murecho">
              <p className="font-semibold">Cabang Dinas Pendidikan Wilayah Malang</p>
              <p className="opacity-90 font-medium">(Kota Malang - Kota Batu)</p>
            </div>
          </div>

          <div className="relative z-20 my-auto mx-auto max-w-[683px] w-full px-6 left-[-20px] font-murecho">
            <div className="bg-black/30 border border-white/10 rounded-2xl p-7 backdrop-blur-md shadow-2xl">
              <p className="text-white text-[64px] font-extrabold mb-1 tracking-wider">SIPODI</p>
              <p className="text-white text-4xl font-semibold mb-4 tracking-wide">
                Sistem Potensi Diri
              </p>
              <p className="text-white/85 text-xl leading-relaxed font-normal text-justify">
                SIPODI adalah sistem untuk mengelola dan menganalisis data
                potensi, kompetensi, pengalaman, dan prestasi tenaga pendidik di
                Malang Raya guna mendukung pengembangan kompetensi serta
                pengambilan keputusan yang lebih akurat.
              </p>
            </div>
          </div>

          <div className="relative z-20 mt-auto w-full text-right pb-8 left-[-40px]">
            <span className="text-white/70 text-[14px] font-medium hover:text-white cursor-pointer transition-colors border-b border-white/30 pb-0.5">
              Buku Panduan
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-center w-full md:w-[40%] bg-white px-8 sm:px-16 md:px-12 lg:px-20 py-10 z-20">
          <div className="max-w-[420px] w-full mx-auto">
            <h1 className="text-[34px] font-bold text-[#111] mb-2 tracking-tight">
              Masuk Ke Akun
            </h1>
            <p className="text-[14px] font-medium text-gray-500 mb-9 leading-relaxed">
              Silakan masuk untuk mengakses sistem pendataan
            </p>

            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <label className="block text-[15px] font-bold text-gray-800 mb-2.5">
                  Username{" "}
                  <span className="font-normal text-gray-400 text-[13.5px] ml-1">
                    (nama lengkap)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={isLoading}
                  className="w-full h-[52px] px-6 rounded-full border border-gray-300 bg-white text-[14.5px] text-gray-950 placeholder:text-gray-400 shadow-sm focus:outline-none focus:border-[#0a65cc] focus:ring-4 focus:ring-[#0a65cc]/10 disabled:opacity-60 transition"
                />
              </div>

              <div>
                <label className="block text-[15px] font-bold text-gray-800 mb-2.5">
                  Password{" "}
                  <span className="font-normal text-gray-400 text-[13.5px] ml-1">
                    (NIK)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="w-full h-[52px] px-6 pr-14 rounded-full border border-gray-300 bg-white text-[14.5px] text-gray-950 placeholder:text-gray-400 shadow-sm focus:outline-none focus:border-[#0a65cc] focus:ring-4 focus:ring-[#0a65cc]/10 disabled:opacity-60 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
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

              {/* Error Alert */}
              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium animate-in fade-in-50 duration-200">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[54px] mt-2 rounded-full bg-gradient-to-r from-[#0a65cc] to-[#004282] hover:opacity-95 active:scale-[0.99] text-white text-[15px] font-bold tracking-widest transition shadow-lg shadow-blue-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "MEMPROSES..." : "MASUK"}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}