"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";
import { PASSWORD_OTP_FROM } from "@/lib/password-otp-email";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="mx-auto max-w-md px-4 py-10 md:py-12">
      <Link href="/" className="flex justify-center">
        <BrandLogo size="auth" priority />
      </Link>
      <h1 className="mt-6 text-center font-serif text-2xl text-navy-900">Forgot password</h1>
      <p className="mt-2 text-center text-sm text-navy-600">
        We will email a 6-digit code from{" "}
        <a href={`mailto:${PASSWORD_OTP_FROM}`} className="text-[#8C6E28] underline">
          {PASSWORD_OTP_FROM}
        </a>
        .
      </p>

      {step === "email" ? (
        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setLoading(true);
            const res = await fetch("/api/auth/forgot-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const data = await res.json().catch(() => ({}));
            setLoading(false);
            if (!res.ok) {
              setError(data.error ?? "Could not send code.");
              return;
            }
            setMessage(data.message ?? "Check your email for the code.");
            setStep("reset");
          }}
        >
          <input
            className="input"
            type="email"
            required
            placeholder="Your account email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button type="submit" className="btn-gold w-full" disabled={loading}>
            {loading ? "Sending…" : "Send reset code"}
          </button>
        </form>
      ) : (
        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (password !== confirm) {
              setError("Passwords do not match.");
              return;
            }
            setLoading(true);
            const res = await fetch("/api/auth/reset-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, otp, password }),
            });
            const data = await res.json().catch(() => ({}));
            setLoading(false);
            if (!res.ok) {
              setError(data.error ?? "Reset failed.");
              return;
            }
            router.push("/login");
          }}
        >
          {message ? <p className="text-sm text-navy-600">{message}</p> : null}
          <input className="input" placeholder="6-digit code" value={otp} onChange={(e) => setOtp(e.target.value)} required />
          <PasswordInput
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <PasswordInput
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button type="submit" className="btn-gold w-full" disabled={loading}>
            {loading ? "Updating…" : "Reset password"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-[#8C6E28] underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
