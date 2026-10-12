"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@/lib/db/types";

type Profile = {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    wholesaleProfileComplete: boolean;
    createdAt: string;
  };
  wholesaleApplication: {
    id: string;
    company: string;
    contact: string;
    phone: string;
    website?: string;
    businessType: string;
    taxId: string;
    productInterest: string;
    status: string;
    createdAt: string;
  } | null;
};

export function AccountDashboard({
  fallbackName,
  fallbackEmail,
  role,
}: {
  fallbackName: string;
  fallbackEmail: string;
  role: UserRole;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/account/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setProfile(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const user = profile?.user ?? {
    id: "",
    name: fallbackName,
    email: fallbackEmail,
    role,
    wholesaleProfileComplete: false,
    createdAt: "",
  };
  const isWholesale = user.role === "wholesale";
  const app = isWholesale ? profile?.wholesaleApplication : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-12">
      <h1 className="font-serif text-3xl md:text-4xl">Your account</h1>
      <p className="mt-2 text-navy-600">
        {isWholesale ? "Your profile and trade account details." : "Your retail profile details."}
      </p>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-soft">
        <h2 className="font-serif text-2xl text-navy-900">Profile</h2>
        {loading ? <p className="mt-3 text-sm text-navy-500">Loading…</p> : null}
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-navy-500">Name</dt>
            <dd className="font-medium text-navy-900">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-navy-500">Email</dt>
            <dd className="font-medium text-navy-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-navy-500">Account type</dt>
            <dd className="font-medium capitalize text-navy-900">{user.role}</dd>
          </div>
          {user.createdAt ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">Member since</dt>
              <dd className="font-medium text-navy-900">{new Date(user.createdAt).toLocaleDateString()}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {app ? (
        <section className="mt-6 rounded-2xl border border-[#C9A84C]/30 bg-[#FBF6E8] p-6">
          <h2 className="font-serif text-2xl text-navy-900">Wholesale application</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">Company</dt>
              <dd>{app.company || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">Contact</dt>
              <dd>{app.contact}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">Phone</dt>
              <dd>{app.phone}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">Business type</dt>
              <dd>{app.businessType}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">Tax ID / GST</dt>
              <dd>{app.taxId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">Product interest</dt>
              <dd>{app.productInterest}</dd>
            </div>
            {app.website ? (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-navy-500">Website</dt>
                <dd>{app.website}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
