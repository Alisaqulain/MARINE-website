import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { wholesaleLoginRedirectPath, wholesalePathRequiresAuth } from "@/lib/wholesale-auth";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const origin = req.nextUrl.origin;
  const user = req.auth?.user;

  if (wholesalePathRequiresAuth(pathname) && user?.role === "customer") {
    return NextResponse.redirect(new URL("/retail?notice=retail-wholesale", origin));
  }

  if (wholesalePathRequiresAuth(pathname) && !user) {
    const { callbackUrl, view } = wholesaleLoginRedirectPath(pathname);
    const login = new URL("/login", origin);
    login.searchParams.set("mode", "wholesale");
    login.searchParams.set("callbackUrl", callbackUrl);
    if (view === "register") {
      login.searchParams.set("view", "register");
    }
    return NextResponse.redirect(login);
  }

  if (
    user?.role === "wholesale" &&
    !user.wholesaleProfileComplete &&
    pathname.startsWith("/wholesale") &&
    pathname !== "/wholesale/complete"
  ) {
    const next = new URL("/wholesale/complete", origin);
    next.searchParams.set("next", pathname);
    return NextResponse.redirect(next);
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!user) {
      const login = new URL("/admin/login", origin);
      login.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
    if (user.role !== "admin" && user.role !== "staff") {
      return NextResponse.redirect(new URL("/account?error=admin-access", origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/wholesale", "/wholesale/:path*", "/admin/:path*"],
};
