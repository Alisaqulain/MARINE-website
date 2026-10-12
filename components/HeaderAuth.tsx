"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import { useT } from "@/lib/i18n/LocaleProvider";

export function HeaderAuth() {
  const { data: session, status } = useSession();
  const t = useT();
  const isAdmin = session?.user?.role === "admin";

  if (status === "loading") {
    return <span className="px-2 py-2 text-[10px] text-white/50">…</span>;
  }

  if (session?.user) {
    if (isAdmin) {
      return (
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/admin/login" })}
          className="inline-flex items-center gap-1.5 px-2 py-2 text-xs font-medium uppercase tracking-[0.12em] text-white/85 hover:text-[#C9A84C]"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>{t("nav.logout")}</span>
        </button>
      );
    }

    const label = session.user.name?.split(" ")[0] ?? "Account";
    return (
      <div className="flex items-center gap-0.5">
        <Link
          href="/account"
          className="inline-flex max-w-[4rem] items-center gap-1 truncate px-1.5 py-2 text-xs font-medium uppercase tracking-[0.1em] text-white/85 hover:text-[#C9A84C] xl:max-w-[7rem] xl:gap-1.5 xl:px-2 xl:tracking-[0.12em]"
          title={session.user.email ?? undefined}
        >
          <User className="h-4 w-4 shrink-0" />
          <span className="hidden truncate xl:inline">{label}</span>
        </Link>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/" })}
          className="inline-flex items-center gap-1 px-2 py-2 text-xs font-medium uppercase tracking-[0.12em] text-white/85 hover:text-[#C9A84C]"
          title={t("nav.logout")}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{t("nav.logout")}</span>
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="inline-flex items-center gap-1.5 px-2 py-2 text-xs font-medium uppercase tracking-[0.14em] text-white/85 hover:text-[#C9A84C]"
    >
      <User className="h-4 w-4 shrink-0" />
      <span>{t("nav.login")}</span>
    </Link>
  );
}
