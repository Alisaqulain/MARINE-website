import type { NextAuthConfig } from "next-auth";
import { resolveRole } from "@/lib/roles";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    /** Route protection redirects are handled in middleware.ts with absolute URLs. */
    authorized: () => true,
    jwt({ token }) {
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as "customer" | "wholesale" | "admin" | "staff") ?? "customer";
        session.user.wholesaleProfileComplete = Boolean(token.wholesaleProfileComplete);
        session.user.canAddProduct = Boolean(token.canAddProduct);
        session.user.canDelete = Boolean(token.canDelete);
        session.user.manageTeam = Boolean(token.manageTeam);
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
