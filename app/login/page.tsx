"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/Logo";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { WholesaleApplicationFields, wholesaleApplicationPayload } from "@/components/WholesaleForms";
import { useT } from "@/lib/i18n/LocaleProvider";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialMode = params.get("mode") === "wholesale" ? "wholesale" : "customer";
  const initialView = params.get("view") === "register" ? "register" : "login";

  const callbackUrl = useMemo(() => {
    const raw = params.get("callbackUrl");
    if (raw) return raw;
    return initialMode === "wholesale" ? "/wholesale" : "/account";
  }, [params, initialMode]);

  const [view, setView] = useState<"login" | "register">(initialView);
  const [mode, setMode] = useState<"customer" | "wholesale">(initialMode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const wholesaleRegister = mode === "wholesale" && view === "register";
  const t = useT();
  const { update } = useSession();

  async function finishLogin() {
    await update();
    router.refresh();
    router.push(callbackUrl);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    if (wholesaleRegister) {
      const email = String(fd.get("email") ?? "").trim();
      const password = String(fd.get("password") ?? "");
      const confirm = String(fd.get("confirm") ?? "");
      const contact = String(fd.get("contact") ?? "").trim();

      if (password !== confirm) {
        setLoading(false);
        setError("Passwords do not match.");
        return;
      }

      const reg = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: contact, mode: "wholesale" }),
      });
      const regData = await reg.json().catch(() => ({}));
      if (!reg.ok) {
        setLoading(false);
        setError(regData.error ?? "Registration failed.");
        return;
      }

      const signedIn = await signIn("credentials", {
        email,
        password,
        mode: "wholesale",
        redirect: false,
      });
      if (signedIn?.error) {
        setLoading(false);
        setError("Account created but sign-in failed.");
        return;
      }

      const app = await fetch("/api/wholesale/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wholesaleApplicationPayload(fd)),
      });
      setLoading(false);
      if (!app.ok) {
        const appData = await app.json().catch(() => ({}));
        setError(appData.error ?? "Trade application could not be saved.");
        finishLogin();
        return;
      }
      finishLogin();
      return;
    }

    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    const name = String(fd.get("name") ?? "");

    if (view === "register" && password !== confirm) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    if (view === "register") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoading(false);
        setError(data.error ?? "Registration failed.");
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      mode,
      redirect: false,
    });
    setLoading(false);

    if (result?.error) {
      setError(view === "login" ? "Invalid email or password." : "Account created but sign-in failed.");
      return;
    }

    finishLogin();
  }

  return (
    <div className={`mx-auto w-full px-4 py-10 md:py-12 ${mode === "wholesale" ? "max-w-[820px]" : "max-w-md"}`}>
      <Link href="/" className="flex justify-center">
        <BrandLogo size="auth" priority />
      </Link>
      <h1 className="sr-only">{view === "login" ? "Login" : "Register"}</h1>

      {mode === "wholesale" ? (
        <p className="mt-5 flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#C9A84C]/80 bg-[#FBF6E8] px-4 py-2.5 text-[13px] font-medium tracking-[0.01em] text-navy-900">
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#8C6E28]" strokeWidth={2.25} aria-hidden />
          <span>{t("login.wholesaleIntro")}</span>
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-2 rounded-full bg-cream-300 p-1 text-sm">
        <button
          type="button"
          className={`rounded-full py-2 ${view === "login" ? "bg-white shadow" : ""}`}
          onClick={() => setView("login")}
        >
          {t("login.tab.login")}
        </button>
        <button
          type="button"
          className={`rounded-full py-2 ${view === "register" ? "bg-white shadow" : ""}`}
          onClick={() => setView("register")}
        >
          {t("login.tab.register")}
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 rounded-full bg-[#EDE6D9] p-1 text-sm">
        <button
          type="button"
          className={`rounded-full py-2 font-medium transition ${
            mode === "customer" ? "bg-[#0B1D36] text-white shadow" : "text-navy-700"
          }`}
          onClick={() => setMode("customer")}
        >
          {t("login.tab.customer")}
        </button>
        <button
          type="button"
          className={`rounded-full py-2 font-medium transition ${
            mode === "wholesale" ? "bg-[#C9A84C] text-[#0B1D36] shadow" : "text-navy-700"
          }`}
          onClick={() => setMode("wholesale")}
        >
          {t("login.tab.wholesale")}
        </button>
      </div>

      <div className="mt-6">
        <GoogleAuthButton mode={mode} callbackUrl={callbackUrl} />
        <p className="my-4 text-center text-xs uppercase tracking-wider text-navy-500">{t("login.orEmail")}</p>
      </div>

      <form
        className={wholesaleRegister ? "grid gap-4 md:grid-cols-2" : "space-y-4"}
        onSubmit={onSubmit}
      >
        {wholesaleRegister ? (
          <>
            <p className="md:col-span-2 font-serif text-lg text-navy-900">{t("login.wholesaleRegisterTitle")}</p>
            <WholesaleApplicationFields />
            <label className="block text-[13px]">
              <span className="mb-1.5 block text-navy-700">{t("login.password")}</span>
              <input className="input" name="password" type="password" required minLength={8} />
            </label>
            <label className="block text-[13px]">
              <span className="mb-1.5 block text-navy-700">{t("login.confirmPassword")}</span>
              <input className="input" name="confirm" type="password" required minLength={8} />
            </label>
          </>
        ) : (
          <>
            {view === "register" ? (
              <input className="input" name="name" required placeholder={t("login.fullName")} />
            ) : null}
            <input className="input" name="email" type="email" required placeholder={t("login.email")} />
            <input
              className="input"
              name="password"
              type="password"
              required
              minLength={8}
              placeholder={t("login.password")}
            />
            {view === "register" ? (
              <input
                className="input"
                name="confirm"
                type="password"
                required
                minLength={8}
                placeholder={t("login.confirmPassword")}
              />
            ) : null}
          </>
        )}

        {view === "login" && !wholesaleRegister ? (
          <p className={`text-right text-sm ${wholesaleRegister ? "md:col-span-2" : ""}`}>
            <Link href="/login/forgot" className="text-[#8C6E28] underline">
              Forgot password?
            </Link>
          </p>
        ) : null}
        {error ? <p className={`text-sm text-red-700 ${wholesaleRegister ? "md:col-span-2" : ""}`}>{error}</p> : null}
        <button
          type="submit"
          className={`btn-gold w-full ${wholesaleRegister ? "md:col-span-2" : ""}`}
          disabled={loading}
        >
          {loading
            ? "Please wait…"
            : wholesaleRegister
              ? t("login.submitWholesale")
              : view === "login"
                ? t("login.signIn")
                : t("login.createAccount")}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-navy-600">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
