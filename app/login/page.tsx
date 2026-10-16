"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { WholesaleApplicationFields, wholesaleApplicationPayload } from "@/components/WholesaleForms";
import { useT } from "@/lib/i18n/LocaleProvider";
import { PASSWORD_OTP_FROM } from "@/lib/password-otp-email";

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
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifyMode, setVerifyMode] = useState<"customer" | "wholesale">("customer");
  const [otp, setOtp] = useState("");

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
      const email = String(fd.get("email") ?? "")
        .trim()
        .toLowerCase();
      const password = String(fd.get("password") ?? "");
      const confirm = String(fd.get("confirm") ?? "");
      const contact = String(fd.get("contact") ?? "").trim();

      if (password !== confirm) {
        setLoading(false);
        setError("Passwords do not match.");
        return;
      }

      const payload = wholesaleApplicationPayload(fd);
      const reg = await fetch("/api/auth/register-wholesale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          email,
          password,
          confirm,
        }),
      });
      const regData = await reg.json().catch(() => ({}));
      if (!reg.ok) {
        setLoading(false);
        setError(regData.error ?? "Registration failed.");
        return;
      }

      setLoading(false);
      setVerifyEmail(email);
      setVerifyPassword(password);
      setVerifyMode("wholesale");
      setOtp("");
      setError("");
      return;
    }

    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    const name = String(fd.get("name") ?? "");
    const phone = String(fd.get("phone") ?? "");
    const address = String(fd.get("address") ?? "");

    if (view === "register" && password !== confirm) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    if (view === "register") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, phone, address, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoading(false);
        setError(data.error ?? "Registration failed.");
        return;
      }
      setLoading(false);
      setVerifyEmail(email.trim().toLowerCase());
      setVerifyPassword(password);
      setVerifyMode(mode);
      setOtp("");
      setError("");
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      mode,
      redirect: false,
    });
    setLoading(false);

    if (result?.error) {
      const emailKey = email.trim().toLowerCase();
      const status = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailKey, check: true }),
      }).then((r) => r.json().catch(() => ({})));
      if (status.needsVerification) {
        setVerifyEmail(emailKey);
        setVerifyPassword(password);
        setVerifyMode(mode);
        setOtp("");
        setError("This account is not verified yet. Enter the code from your email.");
        return;
      }
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
        <p className="mt-5 flex items-start justify-center gap-2 rounded-lg border border-[#C9A84C]/80 bg-[#FBF6E8] px-3 py-2 text-[10px] font-medium leading-snug text-navy-900 sm:items-center sm:px-4 sm:text-xs">
          <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-[#8C6E28] sm:mt-0 sm:h-3.5 sm:w-3.5" strokeWidth={2.25} aria-hidden />
          <span className="min-w-0 text-center">{t("login.wholesaleIntro")}</span>
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

      {verifyEmail ? (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setLoading(true);
            const res = await fetch("/api/auth/verify-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: verifyEmail, otp, password: verifyPassword }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setLoading(false);
              setError(typeof data.error === "string" ? data.error : "Verification failed.");
              return;
            }
            const signedIn = await signIn("credentials", {
              email: verifyEmail,
              password: verifyPassword,
              mode: verifyMode,
              redirect: false,
            });
            setLoading(false);
            if (signedIn?.error) {
              setError("Verified, but sign-in failed. Try logging in.");
              setVerifyEmail("");
              return;
            }
            await finishLogin();
          }}
        >
          <h2 className="font-serif text-xl text-navy-900">Verify your email</h2>
          <p className="text-sm text-navy-600">
            We sent a 6-digit code to {verifyEmail} from {PASSWORD_OTP_FROM}.
          </p>
          <input
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button type="submit" className="btn-gold w-full" disabled={loading}>
            {loading ? "Please wait…" : "Verify and continue"}
          </button>
          <button
            type="button"
            className="w-full text-sm text-[#8C6E28] underline"
            onClick={() => {
              void fetch("/api/auth/verify-email", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: verifyEmail }),
              })
                .then(async (res) => {
                  const data = await res.json().catch(() => ({}));
                  setError(
                    res.ok
                      ? `A new code has been sent from ${PASSWORD_OTP_FROM}.`
                      : typeof data.error === "string"
                        ? data.error
                        : "Could not resend the code."
                  );
                })
                .catch(() => setError("Could not resend the code."));
            }}
          >
            Resend code
          </button>
        </form>
      ) : null}

      <form
        className={`${verifyEmail ? "hidden" : ""} ${wholesaleRegister ? "grid gap-4 md:grid-cols-2" : "space-y-4"}`}
        onSubmit={onSubmit}
      >
        {wholesaleRegister ? (
          <>
            <p className="md:col-span-2 font-serif text-lg text-navy-900">{t("login.wholesaleRegisterTitle")}</p>
            <WholesaleApplicationFields />
            <label className="block text-[13px] md:col-span-2">
              <span className="mb-1.5 block text-navy-700">{t("login.password")}</span>
              <PasswordInput name="password" required minLength={8} autoComplete="new-password" />
            </label>
            <label className="block text-[13px] md:col-span-2">
              <span className="mb-1.5 block text-navy-700">{t("login.confirmPassword")}</span>
              <PasswordInput name="confirm" required minLength={8} autoComplete="new-password" />
            </label>
          </>
        ) : (
          <>
            {view === "register" ? (
              <input className="input" name="name" required placeholder={t("login.fullName")} />
            ) : null}
            <input className="input" name="email" type="email" required placeholder={t("login.email")} />
            {view === "register" ? (
              <>
                <input className="input" name="phone" type="tel" required placeholder="Phone number" autoComplete="tel" />
                <input className="input" name="address" required placeholder="Address" autoComplete="street-address" />
              </>
            ) : null}
            <PasswordInput
              name="password"
              required
              minLength={8}
              placeholder={t("login.password")}
              autoComplete={view === "login" ? "current-password" : "new-password"}
            />
            {view === "register" ? (
              <PasswordInput
                name="confirm"
                required
                minLength={8}
                placeholder={t("login.confirmPassword")}
                autoComplete="new-password"
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
