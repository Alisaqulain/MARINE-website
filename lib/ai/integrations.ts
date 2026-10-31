import { getDb, pingDatabase } from "@/lib/mongodb";
import { verifyOwnerMail } from "@/lib/mail";
import { getSiteOrigin } from "@/lib/auth-url";
import { getStorefrontProducts } from "@/lib/storefront-catalog";
import { pingGemini, geminiModel } from "@/lib/ai/gemini";
import { assistantDrift, desiredAssistant, getAssistant, vapiGet, vapiRequestAuthorized, vapiStatus } from "@/lib/ai/vapi";
import { exotelCallbackAuthorized, exotelConfig, pingExotel } from "@/lib/ai/exotel";
import { pingWhatsAppCloud, resolveCredentials } from "@/lib/whatsapp/cloud";
import { readFlags, shouldSendWhatsApp, verifyHandshake, verifySignature } from "@/lib/whatsapp/coexistence";
import { readCoexistenceState } from "@/lib/whatsapp/store";
import { measurementProtocolConfigured, pingGa4, validateMeasurementProtocol } from "@/lib/google/analytics";
import { pingSearchConsole } from "@/lib/google/search-console";
import { serviceAccount } from "@/lib/google/auth";
import { SCHEDULED_JOBS } from "@/lib/ai/cron";
import { runPhase2SelfTest } from "@/lib/ai/selftest";
import { AGENTS, type AgentId } from "@/lib/ai/agents";
import { envPresence, rollupStatus, summarise, type CheckStep, type IntegrationStatus } from "@/lib/ai/integration-status";

export type IntegrationReport = {
  id: string;
  name: string;
  purpose: string;
  status: IntegrationStatus;
  steps: CheckStep[];
  env: { name: string; set: boolean; required: boolean }[];
  troubleshooting: string[];
  /** What this page did NOT do, and the last real provider activity seen, so a credential check is never mistaken for a live call/message. */
  liveActivity: string;
  ms: number;
};

const s = (label: string, result: CheckStep["result"], detail: string | undefined, kind: CheckStep["kind"]): CheckStep => ({
  label,
  result,
  detail: detail || (result === "pass" ? "OK" : "No details returned."),
  kind,
});

function envList(required: string[], optional: string[]) {
  return [
    ...envPresence(required).map((row) => ({ ...row, required: true })),
    ...envPresence(optional).map((row) => ({ ...row, required: false })),
  ];
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = Date.now();
  const value = await fn();
  return [value, Date.now() - start];
}

async function lastActivity(query: Record<string, unknown>, collection: string, sortField = "createdAt") {
  try {
    const db = await getDb();
    return await db.collection(collection).findOne(query, { sort: { [sortField]: -1 } });
  } catch {
    return null;
  }
}

async function checkGemini(): Promise<IntegrationReport> {
  const [ping, ms] = await timed(() => pingGemini());
  const steps: CheckStep[] = [s("GEMINI_API_KEY set", ping.configured ? "pass" : "fail", ping.configured ? "Key is set (not shown)." : "Missing.", "config")];
  if (ping.configured) {
    steps.push(s("API key accepted", ping.auth ? "pass" : "fail", ping.authDetail, "credential"));
    if (ping.generation) steps.push(s(`Live generation (${ping.model})`, ping.generation.ok ? "pass" : "fail", `${ping.generation.detail} in ${ping.generation.ms} ms.`, "live"));
  }
  const status = rollupStatus({ requiredSet: ping.configured ? 1 : 0, requiredTotal: 1, steps });
  return {
    id: "gemini",
    name: "Google Gemini API",
    purpose: "Shared AI model for all four agents",
    status,
    steps,
    env: envList(["GEMINI_API_KEY"], ["GEMINI_MODEL"]),
    troubleshooting: [
      "Create an API key at aistudio.google.com/apikey (or Google Cloud → APIs → Generative Language API). A Gemini app/Pro subscription is not an API key.",
      `GEMINI_MODEL defaults to ${geminiModel()}. A 404 means the model name is wrong for this key; a 429 means quota/billing.`,
      "Without a key the agents still answer, from the catalogue only.",
    ],
    liveActivity: ping.configured
      ? "Sent one fixed health-check prompt with no customer data."
      : "Nothing was sent — no key is configured. Chat and WhatsApp answer from the catalogue only.",
    ms,
  };
}

async function checkVapi(): Promise<IntegrationReport> {
  const start = Date.now();
  const status = vapiStatus();
  const steps: CheckStep[] = [];
  const required = ["VAPI_API_KEY", "VAPI_ASSISTANT_ID", "VAPI_WEBHOOK_SECRET"];
  const requiredSet = required.filter((n) => process.env[n]?.trim()).length;
  if (status.apiKey) {
    if (status.assistantId) {
      const assistant = await getAssistant();
      if (!assistant.ok) {
        steps.push(
          s(
            "API key accepted / assistant found",
            "fail",
            assistant.status === 401 ? "Vapi rejected VAPI_API_KEY. Use the private key from dashboard → API Keys (not the public key)." : `Assistant lookup failed: ${assistant.error}`,
            "credential"
          )
        );
      } else {
        steps.push(s("API key accepted / assistant found", "pass", `Assistant "${assistant.data?.name || "unnamed"}" is readable.`, "credential"));
        const drift = assistantDrift(assistant.data || {}, desiredAssistant(getSiteOrigin()));
        steps.push(
          s(
            "Assistant uses Gemini, Marina tools and this webhook",
            drift.length ? "warn" : "pass",
            drift.length ? `${drift.join(" · ")}. Use Admin → Marina AI → Health → "Sync Vapi assistant" to apply.` : `Model provider google (${assistant.data?.model?.model}), tools and server URL match.`,
            "live"
          )
        );
      }
    } else {
      const list = await vapiGet<unknown[]>("/assistant?limit=1");
      steps.push(s("API key accepted", list.ok ? "pass" : "fail", list.ok ? "Vapi accepted the key. Set VAPI_ASSISTANT_ID to check the assistant." : `Vapi rejected the key: ${list.error}`, "credential"));
    }
    const phoneId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
    if (phoneId) {
      const phone = await vapiGet<{ provider?: string; number?: string; credentialId?: string; assistantId?: string }>(`/phone-number/${encodeURIComponent(phoneId)}`);
      const sipId = process.env.VAPI_SIP_CREDENTIAL_ID?.trim();
      const viaExotel = phone.data?.provider === "byo-phone-number" && (!sipId || phone.data?.credentialId === sipId);
      steps.push(
        s(
          "Phone number linked to the SIP trunk (Exotel)",
          !phone.ok ? "fail" : viaExotel ? "pass" : "warn",
          !phone.ok
            ? `Phone number lookup failed: ${phone.error}`
            : viaExotel
              ? `Number …${String(phone.data?.number || "").slice(-4)} is a BYO number on the SIP trunk${phone.data?.assistantId ? "" : " (no inbound assistant assigned yet)"}.`
              : `Number provider is "${phone.data?.provider}"${sipId ? ` with credential ${phone.data?.credentialId || "none"}` : ""}. For Exotel it must be "byo-phone-number" on VAPI_SIP_CREDENTIAL_ID.`,
          "live"
        )
      );
    } else {
      steps.push(s("Phone number", "warn", "VAPI_PHONE_NUMBER_ID not set — needed for inbound routing and outbound calls.", "config"));
    }
    const credId = process.env.VAPI_SIP_CREDENTIAL_ID?.trim();
    if (credId) {
      const cred = await vapiGet<{ provider?: string; gateways?: { ip?: string }[] }>(`/credential/${encodeURIComponent(credId)}`);
      steps.push(
        s(
          "BYO SIP trunk credential",
          !cred.ok ? "fail" : cred.data?.provider === "byo-sip-trunk" && (cred.data.gateways?.length ?? 0) > 0 ? "pass" : "warn",
          !cred.ok
            ? `Credential lookup failed: ${cred.error}`
            : `Provider ${cred.data?.provider}, ${cred.data?.gateways?.length ?? 0} gateway(s). Inbound SIP URI: <number>@${credId}.sip.vapi.ai.`,
          "live"
        )
      );
    } else {
      steps.push(s("BYO SIP trunk credential", "warn", "VAPI_SIP_CREDENTIAL_ID not set — create a byo-sip-trunk credential pointing at the Exotel gateway.", "config"));
    }
  }
  steps.push(
    s(
      "Webhook secret set and enforced",
      status.webhookReady ? (vapiRequestAuthorized({ get: () => null }) ? "fail" : "pass") : "fail",
      status.webhookReady ? "Unauthenticated requests to /api/ai/voice/webhook are rejected (checked in-process)." : "VAPI_WEBHOOK_SECRET missing — the webhook rejects all Vapi traffic.",
      "config"
    )
  );
  steps.push(
    s(
      "Outbound calls",
      status.outboundEnabled ? "pass" : "skip",
      status.outboundEnabled ? "Enabled: owner-approved callbacks only, with recorded consent." : "Off (VAPI_OUTBOUND_ENABLED is not true). Inbound calls are unaffected.",
      "config"
    )
  );
  const last = await lastActivity({ provider: "vapi", endedReason: { $exists: true } }, "ai_calls", "updatedAt");
  return {
    id: "vapi",
    name: "Vapi voice AI",
    purpose: "Agent 2 — inbound/outbound AI calls, transcripts, summaries",
    status: rollupStatus({ requiredSet, requiredTotal: required.length, steps }),
    steps,
    env: envList(required, ["VAPI_PHONE_NUMBER_ID", "VAPI_SIP_CREDENTIAL_ID", "VAPI_OUTBOUND_ENABLED", "VAPI_MODEL", "VAPI_API_BASE"]),
    troubleshooting: [
      "In Vapi → Integrations/Providers, connect Google (Gemini) or use Vapi's default Google integration; the assistant's model.provider must be \"google\".",
      `Server URL: ${getSiteOrigin()}/api/ai/voice/webhook with header x-vapi-secret = VAPI_WEBHOOK_SECRET (Sync does this).`,
      "Exotel has no native Vapi import: create a byo-sip-trunk credential (Exotel gateway IP, port 5070, TCP) and a byo-phone-number with your ExoPhone.",
    ],
    liveActivity: last
      ? `No call was placed by this check. Last real call report received ${String(last.updatedAt).slice(0, 16)} (${last.type}).`
      : "No call was placed by this check. No real Vapi end-of-call report has been received yet, so a live call is NOT verified.",
    ms: Date.now() - start,
  };
}

async function checkExotel(): Promise<IntegrationReport> {
  const start = Date.now();
  const required = ["EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_ACCOUNT_SID"];
  const requiredSet = required.filter((n) => process.env[n]?.trim()).length;
  const ping = requiredSet === required.length ? await pingExotel() : { configured: false, checks: [] };
  const steps: CheckStep[] = ping.checks.map((c) => s(c.label, c.ok === true ? "pass" : c.ok === null ? "warn" : c.live || c.label.startsWith("API") ? "fail" : "warn", c.detail, c.label.startsWith("API") ? "credential" : c.live ? "live" : "config"));
  const token = Boolean(process.env.EXOTEL_WEBHOOK_TOKEN?.trim());
  steps.push(
    s(
      "Missed-call status callback secured",
      token && !exotelCallbackAuthorized(null) && !exotelCallbackAuthorized("wrong-token") ? "pass" : "warn",
      token ? `Point the ExoPhone StatusCallback to ${getSiteOrigin()}/api/ai/voice/webhook?provider=exotel&token=… (token not shown).` : "EXOTEL_WEBHOOK_TOKEN not set — Exotel missed-call callbacks are rejected.",
      "config"
    )
  );
  const last = await lastActivity({ provider: "exotel" }, "ai_calls");
  return {
    id: "exotel",
    name: "Exotel telephony",
    purpose: "Agent 2 — Indian business number, SIP trunk to Vapi, missed calls",
    status: rollupStatus({ requiredSet, requiredTotal: required.length, steps }),
    steps,
    env: envList(required, ["EXOTEL_SUBDOMAIN", "EXOTEL_PHONE_NUMBER", "EXOTEL_TRUNK_SID", "EXOTEL_WEBHOOK_TOKEN"]),
    troubleshooting: [
      `Cluster: EXOTEL_SUBDOMAIN=${exotelConfig().subdomain} (Mumbai = api.in.exotel.com, Singapore = api.exotel.com).`,
      "vSIP/SIP trunking must be enabled on the account by Exotel (KYC and DLT/number compliance apply in India).",
      "Trunk setup: destination <VAPI_SIP_CREDENTIAL_ID>.sip.vapi.ai:5060;transport=tcp, map the ExoPhone, whitelist Vapi SIP IPs 44.229.228.186/32 and 44.238.177.138/32.",
    ],
    liveActivity: last
      ? `No call was placed. Last Exotel callback ${String(last.createdAt).slice(0, 16)} (${last.status || last.type}).`
      : "No call was placed. No Exotel callback has been received yet, so live telephony is NOT verified.",
    ms: Date.now() - start,
  };
}

async function checkWhatsApp(): Promise<IntegrationReport> {
  const start = Date.now();
  const stored = await readCoexistenceState();
  const creds = resolveCredentials(stored);
  const ping = await pingWhatsAppCloud(creds, { handshakeAt: stored?.webhookHandshakeAt });
  const requiredNames = ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID", "META_WEBHOOK_VERIFY_TOKEN", "META_APP_SECRET"];
  const requiredSet = requiredNames.filter((n) => process.env[n]?.trim()).length + (creds.token ? 1 : 0);
  const steps: CheckStep[] = ping.checks.map((c) =>
    s(c.label, c.ok === true ? "pass" : c.ok === null ? "warn" : c.live ? "fail" : "warn", c.detail, c.label.startsWith("Access token") ? "credential" : c.live ? "live" : "config")
  );
  // In-process security checks of the real webhook handlers.
  const secret = process.env.META_WEBHOOK_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim();
  const forged = verifySignature('{"object":"whatsapp_business_account"}', "sha256=deadbeef", secret);
  const wrongToken = verifyHandshake({ mode: "subscribe", token: "wrong", challenge: "1", expected: process.env.META_WEBHOOK_VERIFY_TOKEN });
  steps.push(s("Forged webhooks and wrong verify tokens are rejected", !forged.ok && !wrongToken.ok ? "pass" : "fail", `Forged signature → HTTP ${forged.ok ? 200 : forged.status}; wrong verify token → HTTP ${wrongToken.ok ? 200 : wrongToken.status}.`, "config"));
  const flags = readFlags(process.env);
  steps.push(
    s(
      "Automatic replies",
      shouldSendWhatsApp(process.env) ? "pass" : "skip",
      shouldSendWhatsApp(process.env)
        ? "On: Gemini replies are sent inside the 24-hour window; templates only with opt-in."
        : `Off — replies are drafted and withheld (coexistence ${flags.coexistenceEnabled}, onboarding approved ${flags.productionOnboardingApproved}, outbound ${flags.outboundEnabled}).`,
      "config"
    )
  );
  const sent = await lastActivity({ direction: "out", status: { $in: ["sent", "delivered", "read"] } }, "ai_wa_messages", "at");
  const inbound = await lastActivity({ direction: "in" }, "ai_wa_messages", "at");
  return {
    id: "whatsapp",
    name: "Meta WhatsApp Cloud API",
    purpose: "Agent 4 — WhatsApp sales & support conversations",
    status: rollupStatus({ requiredSet, requiredTotal: requiredNames.length + 1, steps }),
    steps,
    env: [
      ...envList(["WHATSAPP_ACCESS_TOKEN", ...requiredNames], ["META_WEBHOOK_APP_SECRET", "META_GRAPH_API_VERSION", "WHATSAPP_FOLLOWUP_TEMPLATE", "WHATSAPP_TEMPLATE_LANGUAGE", "WHATSAPP_COEXISTENCE_ENABLED", "WHATSAPP_PRODUCTION_ONBOARDING_APPROVED", "WHATSAPP_OUTBOUND_ENABLED"]),
    ].map((row) => (row.name === "WHATSAPP_ACCESS_TOKEN" && creds.source === "signup" ? { ...row, set: true } : row)),
    troubleshooting: [
      "Use a System User permanent token with whatsapp_business_messaging + whatsapp_business_management (temporary tokens expire in 24 h).",
      `Webhook callback: ${getSiteOrigin()}/api/meta/whatsapp/webhook, verify token = META_WEBHOOK_VERIFY_TOKEN, subscribe the "messages" field.`,
      "Templates for follow-ups must be approved in WhatsApp Manager before WHATSAPP_FOLLOWUP_TEMPLATE is used.",
    ],
    liveActivity: `No WhatsApp message was sent by this check. ${inbound ? `Last inbound message ${String(inbound.at).slice(0, 16)}.` : "No inbound message received yet."} ${sent ? `Last delivered reply ${String(sent.at).slice(0, 16)} (${sent.status}).` : "No message has been sent successfully yet, so live sending is NOT verified."}`,
    ms: Date.now() - start,
  };
}

function saRequired() {
  return process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ? ["GOOGLE_SERVICE_ACCOUNT_JSON"] : ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"];
}

async function checkGa4(): Promise<IntegrationReport> {
  const [[ping, mp], ms] = await timed(() => Promise.all([pingGa4(), validateMeasurementProtocol()]));
  const required = [...saRequired(), "GA4_PROPERTY_ID"];
  const requiredSet = required.filter((n) => process.env[n]?.trim()).length;
  const steps: CheckStep[] = [];
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() && !serviceAccount()) steps.push(s("Service account JSON readable", "fail", "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON or base64 JSON with client_email and private_key.", "credential"));
  if (ping.configured) {
    steps.push(s("Service account token", ping.auth ? "pass" : "fail", ping.auth ? "Google issued an analytics.readonly token." : ping.detail, "credential"));
    if (ping.auth) steps.push(s("Read analytics data", ping.data ? "pass" : "fail", ping.detail, "live"));
  }
  steps.push(
    s(
      "Server-side purchase conversions (Measurement Protocol)",
      mp.configured ? (mp.ok ? "pass" : "warn") : "warn",
      mp.configured ? `${mp.detail} The API secret itself is only proven when real purchases appear in GA4.` : "GA4_MEASUREMENT_ID / GA4_API_SECRET not set — paid orders are not sent to GA4 as purchases.",
      "config"
    )
  );
  steps.push(
    s(
      "Browser tag",
      process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() ? "pass" : "warn",
      process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() ? "gtag loads after cookie consent (needs a rebuild after changing)." : "NEXT_PUBLIC_GA4_MEASUREMENT_ID not set — no page tracking.",
      "config"
    )
  );
  return {
    id: "ga4",
    name: "Google Analytics 4",
    purpose: "Agent 3 — traffic, conversions, landing pages, revenue attribution",
    status: rollupStatus({ requiredSet, requiredTotal: required.length, steps }),
    steps,
    env: envList(required, ["GA4_MEASUREMENT_ID", "GA4_API_SECRET", "NEXT_PUBLIC_GA4_MEASUREMENT_ID"]),
    troubleshooting: [
      "Enable the Google Analytics Data API in the service account's Google Cloud project.",
      "GA4 → Admin → Property access management → add the service account email as Viewer. GA4_PROPERTY_ID is the numeric property id, not the G- id.",
      "Measurement Protocol secret: GA4 → Admin → Data streams → web stream → Measurement Protocol API secrets.",
    ],
    liveActivity: measurementProtocolConfigured() ? "Read-only report query; the purchase test used GA4's debug endpoint and was not recorded." : "Read-only report query. No event was recorded.",
    ms,
  };
}

async function checkSearchConsole(): Promise<IntegrationReport> {
  const [ping, ms] = await timed(() => pingSearchConsole());
  const required = [...saRequired(), "SEARCH_CONSOLE_SITE_URL"];
  const requiredSet = required.filter((n) => process.env[n]?.trim()).length;
  const steps: CheckStep[] = [];
  if (ping.configured) {
    steps.push(s("Service account token", ping.auth ? "pass" : "fail", ping.auth ? "Google issued a webmasters.readonly token." : ping.detail, "credential"));
    if (ping.auth) steps.push(s("Property access", ping.access ? "pass" : "fail", ping.access ? `Access to ${process.env.SEARCH_CONSOLE_SITE_URL}.` : ping.detail, "credential"));
    if (ping.auth && ping.access) steps.push(s("Read search performance", ping.data ? "pass" : "fail", ping.detail, "live"));
  }
  return {
    id: "search-console",
    name: "Google Search Console",
    purpose: "Agent 3 — queries, rankings, keyword opportunities",
    status: rollupStatus({ requiredSet, requiredTotal: required.length, steps }),
    steps,
    env: envList(required, []),
    troubleshooting: [
      "Enable the Google Search Console API in the service account's Cloud project.",
      'Domain property: SEARCH_CONSOLE_SITE_URL=sc-domain:marinamuseinternational.com. URL-prefix property: "https://marinamuseinternational.com/" (trailing slash).',
      "Search Console → Settings → Users and permissions → Add user → the service account email.",
    ],
    liveActivity: "Read-only query. Nothing was changed in Search Console.",
    ms,
  };
}

export type PlatformCheck = { name: string; result: CheckStep["result"]; detail: string };

async function platformChecks(): Promise<PlatformCheck[]> {
  const out: PlatformCheck[] = [];
  const db = await pingDatabase();
  out.push({ name: "Database connectivity", result: db.ok ? "pass" : "fail", detail: db.ok ? `MongoDB reachable (${db.connectionMode || "connected"}).` : db.message });
  if (db.ok) {
    try {
      const handle = await getDb();
      const id = `hc_${Date.now()}`;
      await handle.collection("ai_healthcheck").insertOne({ id, at: new Date().toISOString() });
      const read = await handle.collection("ai_healthcheck").findOne({ id });
      await handle.collection("ai_healthcheck").deleteOne({ id });
      out.push({ name: "Database write / read / delete", result: read ? "pass" : "fail", detail: read ? "Round-trip on a scratch document succeeded." : "Written document could not be read back." });
      const names = ["ai_sessions", "ai_messages", "ai_leads", "ai_approvals", "ai_calls", "ai_followups", "ai_consent", "ai_wa_messages", "ai_content", "ai_audit"];
      const counts = await Promise.all(names.map((n) => handle.collection(n).countDocuments()));
      out.push({ name: "CRM & agent collections", result: "pass", detail: names.map((n, i) => `${n.replace("ai_", "")} ${counts[i]}`).join(" · ") });
      const now = Date.now();
      for (const job of SCHEDULED_JOBS) {
        const last = await handle.collection("ai_jobs").findOne({ name: job.name }, { sort: { at: -1 } });
        const age = last ? (now - Date.parse(String(last.at))) / 3_600_000 : null;
        out.push({
          name: `Scheduled job: ${job.name} (${job.schedule})`,
          result: !process.env.CRON_SECRET?.trim() ? "fail" : last == null ? "warn" : !last.ok ? "fail" : age! > job.maxAgeHours ? "warn" : "pass",
          detail: !process.env.CRON_SECRET?.trim()
            ? "CRON_SECRET not set — the scheduler cannot authenticate."
            : last == null
              ? `Never run. Schedule ${job.path} with "Authorization: Bearer $CRON_SECRET".`
              : `Last run ${String(last.at).slice(0, 16)} — ${last.ok ? "ok" : `failed: ${JSON.stringify(last.summary).slice(0, 120)}`}${age! > job.maxAgeHours ? " (overdue)" : ""}.`,
        });
      }
    } catch (err) {
      out.push({ name: "Database write / read / delete", result: "fail", detail: err instanceof Error ? err.message : "failed" });
    }
  }
  const mail = await verifyOwnerMail();
  out.push({ name: "Owner alert email (SMTP)", result: mail.ok ? "pass" : "fail", detail: mail.message });
  out.push({
    name: "/test access control",
    result: process.env.NODE_ENV === "production" ? "pass" : "warn",
    detail: process.env.NODE_ENV === "production" ? "Production: admin sign-in required." : "Development: open without sign-in. In production it requires an admin session.",
  });
  return out;
}

async function agentChecks(integrations: IntegrationReport[]): Promise<{ id: AgentId; name: string; result: CheckStep["result"]; detail: string }[]> {
  const by = (id: string) => integrations.find((i) => i.id === id)?.status ?? "not_configured";
  const products = await getStorefrontProducts().catch(() => []);
  const tests = runPhase2SelfTest();
  const failed = tests.filter((t) => !t.pass).length;
  const brain = by("gemini") === "connected" ? "Gemini replies (fact-checked)" : "catalogue-only replies (Gemini not connected)";
  const level = (deps: IntegrationStatus[]): CheckStep["result"] => (deps.every((d) => d === "connected") ? "pass" : deps.some((d) => d === "failed") ? "fail" : "warn");
  return [
    { id: "chat", name: AGENTS.chat.name, result: products.length && !failed ? level([by("gemini")]) : "fail", detail: `${products.length} products · ${brain} · lead scoring, CRM, owner alerts, approvals, recovery follow-ups.` },
    { id: "voice", name: AGENTS.voice.name, result: level([by("gemini"), by("vapi"), by("exotel")]), detail: `Vapi ${by("vapi")} · Exotel ${by("exotel")} · Gemini ${by("gemini")}. Tools: lookup_product, record_enquiry. Missed calls → owner alert + callback approval.` },
    { id: "growth", name: AGENTS.growth.name, result: level([by("gemini"), by("ga4"), by("search-console")]), detail: `GA4 ${by("ga4")} · Search Console ${by("search-console")} · Gemini ${by("gemini")}. First-party attribution, Shopping feed, content drafts, daily report.` },
    { id: "whatsapp", name: AGENTS.whatsapp.name, result: level([by("gemini"), by("whatsapp")]), detail: `WhatsApp ${by("whatsapp")} · Gemini ${by("gemini")}. Same catalogue, scoring and CRM as chat; STOP/START consent.` },
    { id: "chat", name: "Blueprint self-test (pure logic)", result: failed ? "fail" : "pass", detail: `${tests.length - failed}/${tests.length} checks passed (same as npm run check:phase2).` },
  ];
}

/** Everything /test shows. Each provider check runs in parallel and is time-boxed by its own client. */
export async function runIntegrationChecks() {
  const started = Date.now();
  const settle = async (fn: () => Promise<IntegrationReport>, id: string, name: string): Promise<IntegrationReport> => {
    try {
      return await fn();
    } catch (err) {
      return {
        id,
        name,
        purpose: "",
        status: "failed",
        steps: [s("Check crashed", "fail", err instanceof Error ? err.message.slice(0, 200) : "Unknown error", "live")],
        env: [],
        troubleshooting: [],
        liveActivity: "",
        ms: 0,
      };
    }
  };
  const integrations = await Promise.all([
    settle(checkGemini, "gemini", "Google Gemini API"),
    settle(checkVapi, "vapi", "Vapi voice AI"),
    settle(checkExotel, "exotel", "Exotel telephony"),
    settle(checkWhatsApp, "whatsapp", "Meta WhatsApp Cloud API"),
    settle(checkGa4, "ga4", "Google Analytics 4"),
    settle(checkSearchConsole, "search-console", "Google Search Console"),
  ]);
  const [platform, agents] = await Promise.all([platformChecks(), agentChecks(integrations)]);
  return { integrations, platform, agents, summary: summarise(integrations.map((i) => i.status)), checkedAt: new Date().toISOString(), ms: Date.now() - started };
}
