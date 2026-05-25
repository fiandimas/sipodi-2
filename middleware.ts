import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "sipodi_session";

type Role = "SUPER_ADMIN" | "ADMIN_TALENTA" | "ADMIN_SEKOLAH" | "USER_GTK";

type SessionPayload = {
  sub: string;
  role: Role;
  branchId: string | null;
  schoolNpsn: string | null;
  gtkNik: string | null;
};

async function verifyToken(token: string): Promise<SessionPayload | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("MW: JWT_SECRET not set");
    return null;
  }

  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, {
      issuer: "sipodi",
      audience: "sipodi-web",
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch (e) {
    console.error("MW: jwtVerify failed", e);
    return null;
  }
}

function redirectToLogin(req: NextRequest, nextPath?: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/auth/login";
  url.searchParams.set("next", nextPath ?? req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function dashboardForRole(role: Role) {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin/dashboard";
    case "ADMIN_TALENTA":
      return "/admin-talenta/dashboard";
    case "ADMIN_SEKOLAH":
      return "/admin-sekolah/dashboard";
    case "USER_GTK":
    default:
      return "/user-gtk/dashboard";
  }
}

function redirectToRoleDashboard(req: NextRequest, role: Role) {
  const url = req.nextUrl.clone();
  url.pathname = dashboardForRole(role);
  url.searchParams.delete("next");
  return NextResponse.redirect(url);
}

function unauthorizedJson() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function isRscOrPrefetch(req: NextRequest) {
  // App Router internal requests (Flight/RSC)
  if (req.headers.get("rsc") === "1") return true;

  // Prefetch header (sering ada saat next/link prefetch)
  if (req.headers.has("next-router-prefetch")) return true;

  // Tambahan pengaman: request yang bukan navigation HTML
  const accept = req.headers.get("accept") ?? "";
  const isHtml = accept.includes("text/html");
  if (!isHtml) return true;

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Jangan auth-gate request internal Next (RSC/prefetch/assets fetch)
  if (isRscOrPrefetch(req)) {
    return NextResponse.next();
  }

  // ==== khusus root "/" ====
  if (pathname === "/") {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return redirectToLogin(req, "/dashboard");

    const session = await verifyToken(token);
    if (!session) return redirectToLogin(req, "/dashboard");

    return redirectToRoleDashboard(req, session.role);
  }

  // ==== allowlist public & auth flow ====
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/auth/") ||     // login + choose-role + halaman auth lain
    pathname.startsWith("/api/auth/")    // login + pending + select-mode + cancel + logout
  ) {
    return NextResponse.next();
  }

  const isProtectedPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/admin-talenta") ||
    pathname.startsWith("/admin-sekolah") ||
    pathname.startsWith("/user-gtk");

  const isProtectedApi =
    pathname.startsWith("/api/gtk/talent-master") ||
    pathname.startsWith("/api/gtk/talent-submissions") ||
    pathname.startsWith("/api/gtk/talent-files") ||
    pathname.startsWith("/api/gtk/talent-print-context") ||
    pathname.startsWith("/api/gtk/files") ||
    pathname.startsWith("/api/gtk/me") ||
    pathname.startsWith("/api/gtk/profile-photo") ||
    pathname.startsWith("/api/gtk/settings/change-password") ||
    pathname.startsWith("/api/me") ||
    pathname.startsWith("/api/admin-sekolah") ||
    pathname.startsWith("/api/admin-talenta") ||
    pathname.startsWith("/api/super-admin");

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  // ==== auth check ====
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    console.warn("MW: no token for", pathname);
    return isProtectedApi ? unauthorizedJson() : redirectToLogin(req);
  }

  const session = await verifyToken(token);
  if (!session) {
    console.warn("MW: invalid token for", pathname);
    return isProtectedApi ? unauthorizedJson() : redirectToLogin(req);
  }

  // ==== khusus /dashboard: redirect ke dashboard sesuai role ====
  if (pathname === "/dashboard") {
    return redirectToRoleDashboard(req, session.role);
  }

  // ==== role gate (hanya untuk halaman, bukan API) ====
  if (isProtectedPage) {
    if (pathname.startsWith("/super-admin") && session.role !== "SUPER_ADMIN") {
      return redirectToRoleDashboard(req, session.role);
    }
    if (pathname.startsWith("/admin-talenta") && session.role !== "ADMIN_TALENTA") {
      return redirectToRoleDashboard(req, session.role);
    }
    if (pathname.startsWith("/admin-sekolah") && session.role !== "ADMIN_SEKOLAH") {
      return redirectToRoleDashboard(req, session.role);
    }
    if (pathname.startsWith("/user-gtk") && session.role !== "USER_GTK") {
      return redirectToRoleDashboard(req, session.role);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/super-admin/:path*",
    "/admin-talenta/:path*",
    "/admin-sekolah/:path*",
    "/user-gtk/:path*",

    "/api/gtk/talent-master/:path*",
    "/api/gtk/talent-submissions/:path*",
    "/api/gtk/talent-files/:path*",
    "/api/gtk/talent-print-context/:path*",

    "/api/gtk/files/:path*",
    "/api/gtk/me/:path*",
    "/api/gtk/profile-photo/:path*",
    "/api/gtk/settings/change-password/:path*",

    "/api/admin-sekolah/:path*",
    "/api/admin-talenta/:path*",
    "/api/super-admin/:path*",

    "/api/me",

    "/auth/:path*",
    "/api/auth/:path*",
  ],
};
