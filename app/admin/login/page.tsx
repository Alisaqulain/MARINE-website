"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { BrandLogo } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";
import { useT } from "@/lib/i18n/LocaleProvider";

function AdminLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/admin";
  const t = useT();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#031D38] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-[#FAF7F2] p-8 shadow-xl">
        <Link href="/" className="flex justify-center">
          <BrandLogo size="auth" priority />
        </Link>
        <h1 className="mt-6 text-center font-serif text-2xl text-navy-900">{t("admin.login.title")}</h1>
        <p className="mt-2 text-center text-sm text-navy-600">{t("admin.login.subtitle")}</p>

        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setLoading(true);
            const fd = new FormData(e.currentTarget);
            const email = String(fd.get("email") ?? "").trim();
            const password = String(fd.get("password") ?? "");

            const result = await signIn("admin-portal", {
              email,
              password,
              redirect: false,
            });
            setLoading(false);

            if (result?.error) {
              setError("Invalid admin email or password.");
              return;
            }
            router.refresh();
            router.push(callbackUrl);
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block text-navy-700">{t("admin.login.email")}</span>
            <input
              className="input"
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="admin@marinamuseinternational.com"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-navy-700">{t("admin.login.password")}</span>
            <PasswordInput name="password" required autoComplete="current-password" />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button type="submit" className="btn-gold w-full" disabled={loading}>
            {loading ? "…" : t("admin.login.submit")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-[#8C6E28] underline">
            {t("admin.login.back")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#031D38]" />}>
      <AdminLoginInner />
    </Suspense>
  );
}
