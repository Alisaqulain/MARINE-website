"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { BrandLogo } from "@/components/Logo";
import { WholesaleApplicationFields, wholesaleApplicationPayload } from "@/components/WholesaleForms";

function CompleteWholesaleInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/wholesale";
  const { data: session, status, update } = useSession();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (status === "loading") {
    return <div className="py-20 text-center text-navy-600">Loading…</div>;
  }

  if (!session?.user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-navy-600">Please sign in first.</p>
        <Link href="/login?mode=wholesale" className="btn-gold mt-4 inline-flex">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[820px] px-4 py-10 md:py-12">
      <Link href="/" className="flex justify-center">
        <BrandLogo size="auth" priority />
      </Link>
      <h1 className="mt-6 text-center font-serif text-2xl text-navy-900 md:text-3xl">Create your wholesale account</h1>
      <p className="mt-2 text-center text-sm text-navy-600">
        Signed in as {session.user.email}. Complete your trade details and set a password for email login.
      </p>

      <form
        className="mt-8 grid gap-4 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setLoading(true);
          const fd = new FormData(e.currentTarget);
          const res = await fetch("/api/auth/complete-wholesale", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...wholesaleApplicationPayload(fd),
              password: fd.get("password"),
              confirm: fd.get("confirm"),
              email: session.user.email,
            }),
          });
          const data = await res.json().catch(() => ({}));
          setLoading(false);
          if (!res.ok) {
            setError(data.error ?? "Could not complete registration.");
            return;
          }
          await update();
          router.refresh();
          router.push(next);
        }}
      >
        <WholesaleApplicationFields defaultEmail={session.user.email ?? ""} />
        <label className="block text-[13px]">
          <span className="mb-1.5 block text-navy-700">Password</span>
          <input className="input" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <label className="block text-[13px]">
          <span className="mb-1.5 block text-navy-700">Confirm password</span>
          <input className="input" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        {error ? <p className="text-sm text-red-700 md:col-span-2">{error}</p> : null}
        <button type="submit" className="btn-gold md:col-span-2" disabled={loading}>
          {loading ? "Saving…" : "Complete signup"}
        </button>
      </form>
    </div>
  );
}

export default function CompleteWholesalePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center">Loading…</div>}>
      <CompleteWholesaleInner />
    </Suspense>
  );
}
