"use client";

import { useCallback, useEffect, useState } from "react";
import Script from "next/script";

type Status = {
  appId?: string;
  configId?: string;
  graphVersion?: string;
  embeddedSignupVersion?: string;
  featureTypeIncluded?: boolean;
  featureTypeNote?: string;
  appSecretConfigured?: boolean;
  webhookSecretConfigured?: boolean;
  verifyTokenConfigured?: boolean;
  signupAllowed?: boolean;
  outboundDeliveryWired?: boolean;
  credentialsStored?: boolean;
  credentialMode?: string;
  accountState?: string;
  idSource?: string;
  tokenExpiry?: string;
  liveNumberConnected?: boolean;
  syncCallsEnabled?: boolean;
  subscriptionChanged?: boolean;
  wabaIdMasked?: string | null;
  phoneNumberIdMasked?: string | null;
  businessIdMasked?: string | null;
  webhookHandshake?: string;
  webhookSubscription?: string;
  coexistenceVerified?: string;
  liveNumberTouched?: boolean;
  lastAttempt?: { at: string; outcome: string; detail: string; event?: string } | null;
  flags?: { coexistenceEnabled: boolean; productionOnboardingApproved: boolean; outboundEnabled: boolean };
  launch?: { config_id: string; response_type: string; override_default_response_type: boolean; extras: Record<string, never> };
  checklist?: { id: string; label: string; done: boolean; note: string }[];
  blockers?: string[];
  error?: string;
};

type FbLoginResponse = { status?: string; authResponse?: { code?: string } | null };

declare global {
  interface Window {
    FB?: {
      init: (options: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void;
      login: (callback: (response: FbLoginResponse) => void, options: Status["launch"]) => void;
    };
  }
}

const row = "grid gap-1 border-b border-navy-100 py-2 text-sm sm:grid-cols-[12rem_1fr]";

export function AdminWhatsAppPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sdkReady, setSdkReady] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/meta/whatsapp/status");
    const json = (await res.json().catch(() => ({}))) as Status;
    if (!res.ok) {
      setError(json.error || "WhatsApp status is unavailable.");
      return;
    }
    setStatus(json);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function initSdk() {
    if (!status?.signupAllowed || !status.appId || !status.graphVersion || !window.FB) return;
    window.FB.init({
      appId: status.appId,
      autoLogAppEvents: true,
      xfbml: true,
      version: status.graphVersion,
    });
    setSdkReady(true);
  }

  async function postSignup(payload: Record<string, unknown>) {
    setError("");
    setNotice("");
    const res = await fetch("/api/meta/whatsapp/signup/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    if (!res.ok) setError(json.error || json.detail || "Signup was not accepted.");
    else setNotice(json.detail || "Signup result saved without calling Meta.");
    await load();
  }

  function startSignup() {
    if (!status?.signupAllowed || !status.launch || !window.FB) {
      setError("Production signup is disabled. No Facebook window was opened.");
      return;
    }
    let session: Record<string, unknown> | null = null;
    function onMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP") session = data;
      } catch {
        /* Ignore unrelated Facebook messages. */
      }
    }
    window.addEventListener("message", onMessage);
    window.FB.login((response) => {
      window.removeEventListener("message", onMessage);
      const code = response.authResponse?.code;
      void postSignup({
        code,
        loginStatus: response.status,
        session,
      });
    }, status.launch);
  }

  return (
    <div className="space-y-4">
      {status?.signupAllowed ? (
        <Script src="https://connect.facebook.net/en_US/sdk.js" strategy="lazyOnload" onLoad={initSdk} />
      ) : null}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-navy-900">
        Live WhatsApp number is not connected. Account state: {status?.accountState || "not_connected"}. A dry run or saved environment value does not mean Coexistence is active.
      </div>
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg text-navy-900">WhatsApp Business app coexistence</h2>
        <p className="mt-1 text-sm text-navy-600">
          Embedded Signup v4 is prepared and stays closed. The live number is not registered, subscribed, synced, or messaged from this screen.
        </p>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-navy-800">{notice}</p> : null}
        <dl className="mt-4">
          <div className={row}><dt>App ID</dt><dd>{status?.appId || "—"}</dd></div>
          <div className={row}><dt>Configuration ID</dt><dd>{status?.configId || "—"}</dd></div>
          <div className={row}><dt>Embedded Signup</dt><dd>{status?.embeddedSignupVersion || "v4"} · Graph {status?.graphVersion || "—"}</dd></div>
          <div className={row}><dt>featureType sent</dt><dd>{status?.featureTypeIncluded ? "yes" : "no"}</dd></div>
          <div className={row}><dt>App secret</dt><dd>{status?.appSecretConfigured ? "saved on the server" : "missing"}</dd></div>
          <div className={row}><dt>Webhook secret</dt><dd>{status?.webhookSecretConfigured ? "saved on the server" : "missing"}</dd></div>
          <div className={row}><dt>Verify token</dt><dd>{status?.verifyTokenConfigured ? "saved on the server" : "missing"}</dd></div>
          <div className={row}><dt>Account state</dt><dd>{status?.accountState || "not_connected"}</dd></div>
          <div className={row}><dt>Credentials stored</dt><dd>{status?.credentialsStored ? "encrypted on the server" : "no"} · {status?.credentialMode || "none"}</dd></div>
          <div className={row}><dt>Token expiry</dt><dd>{status?.tokenExpiry || "not stored"}</dd></div>
          <div className={row}><dt>Identifier source</dt><dd>{status?.idSource || "none"}</dd></div>
          <div className={row}><dt>WABA ID</dt><dd>{status?.wabaIdMasked || "not stored"}</dd></div>
          <div className={row}><dt>Phone-number ID</dt><dd>{status?.phoneNumberIdMasked || "not stored"}</dd></div>
          <div className={row}><dt>Business ID</dt><dd>{status?.businessIdMasked || "not stored"}</dd></div>
          <div className={row}><dt>Webhook handshake</dt><dd>{status?.webhookHandshake || "not seen"}</dd></div>
          <div className={row}><dt>Webhook subscription</dt><dd>{status?.webhookSubscription || "not verified"}</dd></div>
          <div className={row}><dt>Coexistence verified</dt><dd>{status?.coexistenceVerified || "not verified"}</dd></div>
          <div className={row}><dt>Live number connected</dt><dd>{status?.liveNumberConnected ? "yes" : "no"}</dd></div>
          <div className={row}><dt>Live number touched</dt><dd>{status?.liveNumberTouched ? "yes" : "no"}</dd></div>
          <div className={row}><dt>Contact and history sync</dt><dd>{status?.syncCallsEnabled ? "enabled" : "disabled"}</dd></div>
          <div className={row}><dt>Subscription changes</dt><dd>{status?.subscriptionChanged ? "made" : "none"}</dd></div>
          <div className={row}><dt>Last attempt</dt><dd>{status?.lastAttempt ? `${status.lastAttempt.outcome}: ${status.lastAttempt.detail}` : "none"}</dd></div>
          <div className={row}><dt>Outbound delivery</dt><dd>{status?.outboundDeliveryWired ? "wired" : "not wired, so flags cannot send a WhatsApp message"}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-navy-500">{status?.featureTypeNote}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!status?.signupAllowed || !sdkReady}
            onClick={startSignup}
            className="rounded-md bg-navy-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start production signup
          </button>
          <button
            type="button"
            onClick={() =>
              void postSignup({
                dryRun: true,
                session: {
                  type: "WA_EMBEDDED_SIGNUP",
                  event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
                  data: { waba_id: "102290129340398", phone_number_id: "106540352242922" },
                },
              })
            }
            className="rounded-md border border-navy-200 px-4 py-2 text-sm text-navy-900"
          >
            Simulate finish (no Meta call)
          </button>
          <button type="button" disabled className="rounded-md border border-navy-200 px-4 py-2 text-sm text-navy-400">
            Production onboarding cannot be enabled here
          </button>
        </div>
      </div>
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="font-serif text-base text-navy-900">Readiness</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {(status?.checklist || []).map((item) => (
            <li key={item.id}>
              <span className={item.done ? "text-navy-900" : "text-navy-500"}>{item.done ? "Ready" : "Open"} · {item.label}</span>
              <span className="mt-0.5 block text-xs text-navy-500">{item.note}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="font-serif text-base text-navy-900">Still needs the Meta dashboard</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-navy-600">
          {(status?.blockers || []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
