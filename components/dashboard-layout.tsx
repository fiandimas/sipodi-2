"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { X, ChevronDown, BellIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { SIDEBAR_MENU_BY_ROLE } from "@/lib/layout/sidebar";
import type { SidebarMenu } from "@/lib/layout/sidebar";
import type { UserRole } from "@/lib/types/role";
import { logout } from "@/lib/auth/logout";
import type { SessionTalentField } from "@/app/_lib/session";

import MenuIcon from "@/components/icons/MenuIcon";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: UserRole;
  userName?: string;
  userPhotoUrl?: string | null;
  defaultAvatarUrl?: string;
  talentFields?: SessionTalentField[];

  /**
   * Optional override:
   * - true  => paksa tampil
   * - false => paksa sembunyi
   * - undefined => otomatis dari API /api/auth/modes-count
   */
  canSwitchMode?: boolean;
}

export default function DashboardLayout({
  children,
  role = "super admin",
  userName = "User",
  userPhotoUrl = null,
  defaultAvatarUrl = "/avatar.png",
  talentFields = [],
  canSwitchMode: canSwitchModeProp,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);

  const [avatarSrc, setAvatarSrc] = useState<string>(
    userPhotoUrl?.trim() ? userPhotoUrl : defaultAvatarUrl
  );

  // role USER_GTK di FE Anda = "user"
  const isGtk = role === "user";

  // default: true supaya tidak menghilangkan fitur kalau API gagal
  const [canSwitchModeAuto, setCanSwitchModeAuto] = useState<boolean>(true);

  // ✅ otomatis cek jumlah mode (role) user
  useEffect(() => {
    // kalau di-override manual, tidak perlu fetch
    if (typeof canSwitchModeProp === "boolean") return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/modes-count", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) return;

        const count = Number(json?.count ?? 2);
        if (!cancelled) setCanSwitchModeAuto(count > 1);
      } catch {
        // kalau error: biarkan true (jangan mematikan fitur)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canSwitchModeProp]);

  const canSwitchMode =
    typeof canSwitchModeProp === "boolean" ? canSwitchModeProp : canSwitchModeAuto;

  useEffect(() => {
    setAvatarSrc(userPhotoUrl?.trim() ? userPhotoUrl : defaultAvatarUrl);
  }, [userPhotoUrl, defaultAvatarUrl]);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // ignore
    } finally {
      router.replace("/auth/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  async function handleSwitchMode() {
    if (switchingMode) return;
    setSwitchingMode(true);
    try {
      const res = await fetch("/api/auth/start-mode-switch", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        alert(json?.error ?? "Gagal memulai ganti mode.");
        return;
      }

      const next = pathname || "/dashboard";

      // ✅ hard navigation agar cookie pending langsung kebaca
      window.location.href = `/auth/choose-role?next=${encodeURIComponent(next)}`;
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan saat ganti mode.");
    } finally {
      setSwitchingMode(false);
    }
  }

  const menus: SidebarMenu[] = SIDEBAR_MENU_BY_ROLE[role] ?? [];

  const initials =
    userName
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "U";

  const sidebarDesktopW = isSidebarExpanded ? "md:w-64" : "md:w-20";
  const contentDesktopPL = isSidebarExpanded ? "md:pl-64" : "md:pl-20";

  const handleToggle = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsMobileSidebarOpen(true);
    } else {
      setIsSidebarExpanded((v) => !v);
    }
  };

  const itemBase = "flex items-center rounded-md text-sm font-medium transition-all";
  const itemActive = "bg-[#1e88e5] text-white font-medium";
  const itemIdle = "text-[#c7d7ef] hover:bg-white/5";

  const isAdminTalenta = role === "admin talenta";
  const talentaBaseHref = "/admin-talenta/data-talenta";
  const isTalentaSectionActive = pathname.startsWith(talentaBaseHref);
  const hasTalentFields = isAdminTalenta && talentFields.length > 0;

  const [isTalentaOpen, setIsTalentaOpen] = useState<boolean>(isTalentaSectionActive);

  useEffect(() => {
    if (isTalentaSectionActive) setIsTalentaOpen(true);
  }, [isTalentaSectionActive]);

  return (
    <div className="flex min-h-screen bg-background text-foreground overflow-x-hidden">
      {isMobileSidebarOpen ? (
        <button
          aria-label="Close sidebar"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0b3d7a] transition-all duration-300",
          "md:translate-x-0",
          sidebarDesktopW,
          "w-64",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Brand */}
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-20">
          <div
            className={[
              "flex items-center gap-3 min-w-0",
              isSidebarExpanded ? "" : "md:justify-center md:w-full",
            ].join(" ")}
          >
            <Image
              src="/logo-dindik.png"
              alt="Logo Dindik"
              width={50}
              height={50}
              priority
              className="shrink-0"
            />

            <div className={["min-w-0 leading-tight", isSidebarExpanded ? "block" : "md:hidden"].join(" ")}>
              <div className="font-bold text-base tracking-tight text-white">SIPODI</div>
              <div className="text-[11px] text-white">
                Cabang Dinas Pendidikan Wilayah Malang
              </div>
              <div className="text-[11px] text-white">(Kota Malang - Kota Batu)</div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto px-3 md:px-4 py-6 space-y-1">
          {menus.map((menu) => {
            const Icon = menu.icon;
            const isActive = menu.href ? pathname.startsWith(menu.href) : false;

            const isTalentaMenu = isAdminTalenta && menu.id === "talenta";

            if (isTalentaMenu) {
              return (
                <div key={menu.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setIsTalentaOpen((v) => !v)}
                    title={!isSidebarExpanded ? menu.name : undefined}
                    className={[
                      itemBase,
                      isTalentaSectionActive ? itemActive : itemIdle,
                      "w-full",
                      isSidebarExpanded
                        ? "px-4 py-3 gap-3"
                        : "px-3 py-3 md:justify-center md:px-0",
                    ].join(" ")}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="md:hidden truncate">{menu.name}</span>
                    {isSidebarExpanded ? <span className="hidden md:inline truncate">{menu.name}</span> : null}
                    {hasTalentFields && isSidebarExpanded && (
                      <ChevronDown
                        className={[
                          "w-4 h-4 ml-auto text-white transition-transform",
                          isTalentaOpen ? "rotate-180" : "",
                        ].join(" ")}
                      />
                    )}
                  </button>

                  {hasTalentFields && isTalentaOpen && isSidebarExpanded && (
                    <div className="pl-9 pr-2 space-y-0.5">
                      {talentFields.map((field) => {
                        const fieldHref = `${talentaBaseHref}/${field.id}`;
                        const isFieldActive = pathname.startsWith(fieldHref);
                        return (
                          <Link
                            key={field.id}
                            href={fieldHref}
                            className={[
                              "block rounded-md px-3 py-1.5 text-xs",
                              isFieldActive
                                ? "bg-[#1e88e5] text-white"
                                : "text-[#8FA8C9] hover:bg-white/10 hover:text-white",
                            ].join(" ")}
                          >
                            {field.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={menu.id}
                href={menu.href!}
                title={!isSidebarExpanded ? menu.name : undefined}
                className={[
                  itemBase,
                  isActive ? itemActive : itemIdle,
                  isSidebarExpanded ? "px-4 py-3 gap-3" : "px-3 py-3 md:justify-center md:px-0",
                ].join(" ")}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="md:hidden truncate">{menu.name}</span>
                {isSidebarExpanded ? <span className="hidden md:inline truncate">{menu.name}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className={`p-3 pt-1 mt-auto ${isSidebarExpanded ? "block" : "hidden"}`}>
          <div className="space-y-0.5 text-center">
            <p className="text-[0.8rem] font-light text-white leading-none">
              Cabang Dinas Pendidikan
            </p>
            <p className="text-[0.8rem] font-light text-white leading-none">
              Wilayah Malang
            </p>
            <p className="text-xs font-light text-white leading-tight max-w-[180px] mx-auto">
              (Kota Malang - Kota Batu)
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={["flex flex-col flex-1 transition-all duration-300 min-w-0", contentDesktopPL].join(" ")}>
        <header className="relative h-52 bg-[#064477] overflow-hidden px-4 sm:px-8 flex flex-col justify-center sticky top-0 z-40">
          <svg
            viewBox="0 0 1000 300"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <path d="M400 0 C 550 80, 500 180, 700 130 C 850 100, 900 200, 1000 150 L1000 300 L400 300 Z" fill="#0a4e8a" opacity="0.5" />
            <path d="M500 0 C 650 100, 600 220, 800 160 C 900 130, 950 230, 1000 200 L1000 300 L500 300 Z" fill="#0d5c9e" opacity="0.4" />
          </svg>

          <div className="relative z-10 flex justify-between items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggle}
              className="text-white hover:bg-white/10 shrink-0"
              title="Toggle sidebar"
            >
              <MenuIcon className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                <SearchIcon className="w-5 h-5" />
              </Button>

              <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10">
                <BellIcon className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center p-3 gap-2 cursor-pointer rounded-[10px] bg-white/10 backdrop-blur-sm w-[220px] h-[56px] shadow-[0_3px_5px_0_rgba(0,0,0,0.32)]">
                    <div className="w-9 h-9 rounded-full bg-[#FFE762] shrink-0 flex items-center justify-center">
                      <Avatar className="w-9 h-9">
                        <AvatarImage
                          src={avatarSrc}
                          alt={`Foto profil ${userName}`}
                          onError={() => setAvatarSrc(defaultAvatarUrl)}
                        />
                        <AvatarFallback className="bg-[#FFE762]">{initials}</AvatarFallback>
                      </Avatar>
                    </div>

                    <div className="flex flex-col items-start justify-center min-w-0 flex-1">
                      <span className="text-[14px] font-medium text-white truncate w-full">
                        {userName}
                      </span>
                      <span className="text-[11px] text-[#FFE762] truncate w-full">
                        {role}
                      </span>
                    </div>
                  </div>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{userName}</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {canSwitchMode ? (
                    <>
                      <DropdownMenuItem onClick={handleSwitchMode} disabled={switchingMode}>
                        {switchingMode ? "Memproses..." : "Ganti mode"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}

                  {isGtk ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/user-gtk/profile">Profile</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/user-gtk/settings">Settings</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}

                  <DropdownMenuItem onClick={handleLogout} disabled={loggingOut}>
                    {loggingOut ? "Signing out..." : "Sign out"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Bottom: title + subtitle */}
          <div className="relative z-10 mt-4">
            <h1 className="text-white text-[28px] sm:text-[32px] font-bold tracking-tight truncate">
              Selamat Datang, <span className="text-[#FFC300]">{userName}</span>
            </h1>
            <p className="text-white/70 text-sm mt-1">Dashboard SIPODI</p>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 bg-background min-w-0">{children}</main>
      </div>
    </div>
  );
}
