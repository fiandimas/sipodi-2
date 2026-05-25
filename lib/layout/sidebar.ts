import {
  Home,
  School,
  Users,
  Award,
  UserCog,
  SlidersHorizontal, // ⬅️ tambahkan ini
} from "lucide-react";

import type { UserRole } from "@/lib/types/role";

export interface SidebarMenu {
  id: string;
  name: string;
  icon: any;
  href?: string;
  roles: UserRole[];
}

export const SIDEBAR_MENU_BY_ROLE: Record<UserRole, SidebarMenu[]> = {
  "super admin": [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: Home,
      href: "/super-admin/dashboard",
      roles: ["super admin"],
    },
    {
      id: "sekolah",
      name: "Sekolah",
      icon: School,
      href: "/super-admin/data-sekolah",
      roles: ["super admin"],
    },
    {
      id: "gtk",
      name: "GTK",
      icon: Users,
      href: "/super-admin/data-gtk",
      roles: ["super admin"],
    },
    {
      id: "talenta",
      name: "Talenta",
      icon: Award,
      href: "/super-admin/data-talenta",
      roles: ["super admin"],
    },
    {
      id: "user",
      name: "User",
      icon: UserCog,
      href: "/super-admin/data-user",
      roles: ["super admin"],
    },
    {
      id: "master-talenta",
      name: "Master Talenta",
      icon: SlidersHorizontal,
      href: "/super-admin/master-talenta",
      roles: ["super admin"],
    },
  ],

  "admin talenta": [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: Home,
      href: "/admin-talenta/dashboard",
      roles: ["admin talenta"],
    },
    {
      id: "talenta",
      name: "Talenta",
      icon: Award,
      href: "/admin-talenta/data-talenta",
      roles: ["admin talenta"],
    },
    // ⬇️ menu baru master talenta
    {
      id: "master-talenta",
      name: "Master Talenta",
      icon: SlidersHorizontal,
      href: "/admin-talenta/master-talenta",
      roles: ["admin talenta"],
    },
  ],

  "admin sekolah": [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: Home,
      href: "/admin-sekolah/dashboard",
      roles: ["admin sekolah"],
    },
    {
      id: "gtk",
      name: "GTK",
      icon: Users,
      href: "/admin-sekolah/data-gtk",
      roles: ["admin sekolah"],
    },
    {
      id: "talenta",
      name: "Talenta",
      icon: Award,
      href: "/admin-sekolah/data-talenta",
      roles: ["admin sekolah"],
    },
  ],

  user: [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: Home,
      href: "/user-gtk/dashboard",
      roles: ["user"],
    },
  ],
};
