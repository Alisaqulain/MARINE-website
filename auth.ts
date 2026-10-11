import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { authConfig } from "@/auth.config";
import { ensureAuthEnv } from "@/lib/auth-url";

ensureAuthEnv();
import {
  createUser,
  findUserByEmail,
  findUserById,
  resolveRole,
  verifyPassword,
} from "@/lib/auth-helpers";
import { adminEmailsList } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "customer" | "wholesale" | "admin";
      wholesaleProfileComplete?: boolean;
    };
  }
  interface User {
    role: "customer" | "wholesale" | "admin";
    wholesaleProfileComplete?: boolean;
  }
}

const googleEnabled =
  Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mode: { label: "Mode", type: "text" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim();
        const password = String(credentials?.password ?? "");
        const mode = String(credentials?.mode ?? "customer") as "customer" | "wholesale";
        if (!email || !password) return null;

        let user = await findUserByEmail(email);
        if (!user) return null;
        const ok = await verifyPassword(user, password);
        if (!ok) return null;

        const role = resolveRole(email, user.role === "admin" ? "admin" : mode);
        if (user.role !== role) {
          const { getDb } = await import("@/lib/mongodb");
          const db = await getDb();
          await db.collection("users").updateOne(
            { _id: user._id },
            { $set: { role, updatedAt: new Date() } }
          );
        }

        return {
          id: String(user._id),
          email: user.email,
          name: user.name,
          role,
          wholesaleProfileComplete: user.wholesaleProfileComplete,
        };
      },
    }),
    Credentials({
      id: "admin-portal",
      name: "Admin Portal",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!adminEmailsList().includes(email)) return null;
        const expected = process.env.ADMIN_PASSWORD;
        if (!expected || password !== expected) return null;

        try {
          let user = await findUserByEmail(email);
          if (!user) {
            user = await createUser({
              email,
              name: email.split("@")[0],
              role: "admin",
              password,
            });
          } else if (user.role !== "admin") {
            const { getDb } = await import("@/lib/mongodb");
            const db = await getDb();
            await db.collection("users").updateOne(
              { _id: user._id },
              { $set: { role: "admin", updatedAt: new Date() } }
            );
          }

          return {
            id: String(user!._id),
            email: user!.email,
            name: user!.name,
            role: "admin" as const,
            wholesaleProfileComplete: user!.wholesaleProfileComplete,
          };
        } catch (err) {
          console.error("[admin-portal] MongoDB unavailable — limited env-only session", err);
          return {
            id: `env-admin:${email}`,
            email,
            name: email.split("@")[0],
            role: "admin" as const,
          };
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.wholesaleProfileComplete = user.wholesaleProfileComplete;
      }
      if (token.email) {
        token.role = resolveRole(String(token.email), token.role as "customer" | "wholesale" | "admin" | undefined);
      }
      if (token.sub) {
        const dbUser = await findUserById(token.sub);
        if (dbUser) {
          token.wholesaleProfileComplete = Boolean(dbUser.wholesaleProfileComplete);
          token.role = resolveRole(dbUser.email, dbUser.role);
        }
      }
      return token;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        let existing = await findUserByEmail(user.email);
        if (!existing) {
          let requested: "customer" | "wholesale" = "customer";
          try {
            const jar = await cookies();
            const signupRole = jar.get("signup-role")?.value;
            if (signupRole === "wholesale") requested = "wholesale";
          } catch {
            /* ignore */
          }
          existing = await createUser({
            email: user.email,
            name: user.name ?? user.email.split("@")[0],
            role: resolveRole(user.email, requested),
            googleId: account.providerAccountId,
          });
        } else {
          let requested: "customer" | "wholesale" | undefined;
          try {
            const jar = await cookies();
            if (jar.get("signup-role")?.value === "wholesale") requested = "wholesale";
          } catch {
            /* ignore */
          }
          const role = resolveRole(
            existing.email,
            requested ?? (existing.role === "admin" ? "admin" : existing.role)
          );
          if (existing.role !== role) {
            const { getDb } = await import("@/lib/mongodb");
            const db = await getDb();
            const patch: Record<string, unknown> = { role, updatedAt: new Date() };
            if (role === "wholesale" && requested === "wholesale") {
              patch.wholesaleProfileComplete = false;
            }
            await db.collection("users").updateOne({ _id: existing._id }, { $set: patch });
            const profileComplete =
              patch.wholesaleProfileComplete === false
                ? false
                : existing.wholesaleProfileComplete;
            existing = { ...existing, role, wholesaleProfileComplete: profileComplete };
          }
        }
        user.id = String(existing._id);
        user.role = existing.role;
        user.wholesaleProfileComplete = existing.wholesaleProfileComplete;
      }
      return true;
    },
  },
});
