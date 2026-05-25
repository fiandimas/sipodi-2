"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, X, ChevronDown } from "lucide-react";

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
  const itemActive = "bg-primary/10 text-primary";
  const itemIdle = "text-muted-foreground hover:bg-muted/60 hover:text-foreground";

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
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-background transition-all duration-300",
          "md:translate-x-0",
          sidebarDesktopW,
          "w-64",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Brand */}
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-20 border-b">
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
              <div className="font-bold text-base tracking-tight text-foreground">SIPODI</div>
              <div className="text-[11px] text-muted-foreground">
                Cabang Dinas Pendidikan Wilayah Malang
              </div>
              <div className="text-[11px] text-muted-foreground">(Kota Malang - Kota Batu)</div>
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
                          "w-4 h-4 ml-auto text-muted-foreground transition-transform",
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
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
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

        <div className={`p-3 pt-1 border-t mt-auto ${isSidebarExpanded ? "block" : "hidden"}`}>
          <div className="space-y-0.5 text-center">
            <p className="text-[0.8rem] font-light text-slate-600 leading-none">
              Cabang Dinas Pendidikan
            </p>
            <p className="text-[0.8rem] font-light text-slate-600 leading-none">
              Wilayah Malang
            </p>
            <p className="text-xs font-light text-slate-600 leading-tight max-w-[180px] mx-auto">
              (Kota Malang - Kota Batu)
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={["flex flex-col flex-1 transition-all duration-300 min-w-0", contentDesktopPL].join(" ")}>
        <header className="h-20 border-b bg-background/70 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggle}
              className="text-muted-foreground hover:bg-muted shrink-0"
              title="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </Button>

            <h1 className="text-base sm:text-xl font-bold tracking-tight truncate">
              SIPODI - Sistem Informasi Potensi Diri
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-0 hover:bg-transparent">
                  <Avatar className="w-10 h-10 border-2 border-muted hover:scale-105 transition-transform">
                    <AvatarImage
                      src={avatarSrc}
                      alt={`Foto profil ${userName}`}
                      onError={() => setAvatarSrc(defaultAvatarUrl)}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
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
        </header>

        <main className="flex-1 p-4 sm:p-8 bg-background min-w-0">{children}</main>
      </div>
    </div>
  );
}
