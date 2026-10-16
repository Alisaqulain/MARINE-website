"use client";

import { signOut, useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { canAccessWholesale, isRetailCustomer } from "@/lib/wholesale-access";
import { wholesaleCatalogHref } from "@/lib/wholesale-links";

type WholesaleGateContextValue = {
  /** href for Link — `#` when retail must use the popup first */
  wholesaleEntryHref: (callbackUrl?: string) => string;
  /** Call from Link onClick; opens popup for retail customers */
  handleWholesaleClick: (e: MouseEvent, callbackUrl?: string) => void;
  /** Imperative open (e.g. B2B tab toggle) */
  promptSwitchToWholesale: (callbackUrl?: string) => void;
};

const WholesaleGateContext = createContext<WholesaleGateContextValue | null>(null);

export function WholesaleGateProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("/wholesale");

  const promptSwitchToWholesale = useCallback((next = "/wholesale") => {
    setCallbackUrl(next);
    setOpen(true);
  }, []);

  const wholesaleEntryHref = useCallback(
    (callbackUrl = "/wholesale") => {
      if (canAccessWholesale(session?.user)) return callbackUrl;
      if (isRetailCustomer(session?.user)) return "#";
      return wholesaleCatalogHref(session?.user);
    },
    [session?.user]
  );

  const handleWholesaleClick = useCallback(
    (e: MouseEvent, next = "/wholesale") => {
      if (canAccessWholesale(session?.user)) return;
      if (isRetailCustomer(session?.user)) {
        e.preventDefault();
        promptSwitchToWholesale(next);
      }
    },
    [session?.user, promptSwitchToWholesale]
  );

  async function logoutThenRedirect(loginPath: string) {
    setOpen(false);
    await signOut({ redirect: false });
    window.location.href = loginPath;
  }

  function logoutAndWholesaleSignup() {
    const login = `/login?mode=wholesale&view=register&callbackUrl=${encodeURIComponent(callbackUrl)}`;
    void logoutThenRedirect(login);
  }

  function logoutAndWholesaleLogin() {
    const login = `/login?mode=wholesale&callbackUrl=${encodeURIComponent(callbackUrl)}`;
    void logoutThenRedirect(login);
  }

  const value = useMemo(
    () => ({ wholesaleEntryHref, handleWholesaleClick, promptSwitchToWholesale }),
    [wholesaleEntryHref, handleWholesaleClick, promptSwitchToWholesale]
  );

  return (
    <WholesaleGateContext.Provider value={value}>
      {children}
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-[#031D38]/70 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="relative max-w-md rounded-2xl border border-[#C9A84C]/35 bg-white p-6 shadow-xl">
            <h2 className="font-serif text-xl text-navy-900">Wholesale account required</h2>
            <p className="mt-3 text-sm leading-relaxed text-navy-700">
              You are signed in as a <strong>retail (B2C)</strong> customer. To view wholesale pricing and collections,
              please log out and create or sign in with a <strong>wholesale (B2B)</strong> account.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="flex-1 rounded-full bg-[#031D38] px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#0a3358]"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn-gold flex-1" onClick={logoutAndWholesaleSignup}>
                Log out &amp; wholesale sign up
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-navy-600">
              Already have a trade account?{" "}
              <button
                type="button"
                className="font-semibold text-[#8C6E28] underline"
                onClick={logoutAndWholesaleLogin}
              >
                Log out &amp; wholesale login
              </button>
            </p>
          </div>
        </div>
      ) : null}
    </WholesaleGateContext.Provider>
  );
}

export function useWholesaleGate() {
  const ctx = useContext(WholesaleGateContext);
  if (!ctx) throw new Error("useWholesaleGate must be used within WholesaleGateProvider");
  return ctx;
}
