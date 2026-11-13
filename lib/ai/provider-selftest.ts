/**
 * Provider behaviour tests with a mocked fetch: error classification (400/401/403/404/429/5xx/timeout),
 * retries, Retry-After, the Gemini fallback chain, Vapi id/secret validation, Exotel parsing and redaction.
 * No network: globalThis.fetch is replaced for the duration of each case and always restored.
 * Run by `npm run check:phase2`. A pass here proves our handling, not that a real provider works.
 */
import { classifyHttp, isUuid, looksLikePlaceholder, redactSecrets, requestJson } from "./http.ts";
import { clearGeminiCooldowns, DEFAULT_GEMINI_MODEL, generate, geminiCooldown, geminiFailure, geminiModels } from "./gemini.ts";
import { cronAllowed } from "./cron.ts";
import { verifySignature } from "../whatsapp/coexistence.ts";
import { createHmac } from "crypto";
import { vapiRequestAuthorized, vapiValueProblem } from "./vapi.ts";
import { exophoneRows, exotelRegionProblem } from "./exotel.ts";
import type { SelfTestResult } from "./selftest.ts";

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | "timeout" | "network";
type Call = { url: string; headers: Record<string, string> };

/** Replaces fetch with a script of replies chosen by URL. Returns the calls made. */
async function withFetch<T>(route: (url: string, n: number) => Reply, fn: () => Promise<T>): Promise<{ value: T; calls: Call[] }> {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
    const reply = route(url, calls.length);
    if (reply === "timeout") throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    if (reply === "network") throw new Error("getaddrinfo ENOTFOUND");
    const text = typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body ?? {});
    return new Response(text, { status: reply.status, headers: reply.headers });
  }) as typeof fetch;
  try {
    return { value: await fn(), calls };
  } finally {
    globalThis.fetch = original;
  }
}

/** Temporarily sets environment variables (fake values only). */
async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const googleError = (code: number, status: string, message: string, extra: object[] = []) => ({ error: { code, status, message, details: extra } });

export async function runProviderSelfTest(): Promise<SelfTestResult[]> {
  const results: SelfTestResult[] = [];
  let section = "";
  const check = (name: string, pass: boolean, detail = "") => results.push({ section, name, pass, detail: detail.slice(0, 200) });

  section = "HTTP error classification";
  const cls = (status: number, reached = true) => classifyHttp({ status, reached });
  check("401 → credentials rejected", cls(401) === "auth");
  check("403 → provider-side restriction", cls(403) === "restriction");
  check("429 → provider-side quota restriction", cls(429) === "quota");
  check("500/503 → temporary", cls(500) === "temporary" && cls(503) === "temporary");
  check("Timeout / no response → temporary", cls(0, false) === "temporary");
  check("400/404 → code/configuration error", cls(400) === "config" && cls(404) === "config");

  const xml = await withFetch(
    () => ({ status: 400, body: '<?xml version="1.0"?><TwilioResponse><RestException><Status>400</Status><Message>Exotel API Version v2 not supported. Contact Exotel for details.</Message></RestException></TwilioResponse>', headers: { "content-type": "application/xml" } }),
    () => requestJson("https://api.exotel.com/v2/accounts/x/trunks")
  );
  check("Exotel XML error message is extracted", xml.value.error === "HTTP 400: Exotel API Version v2 not supported. Contact Exotel for details.", xml.value.error);
  check("400 is not retried", xml.calls.length === 1);

  const retried = await withFetch((_, n) => (n === 1 ? { status: 503, body: {} } : { status: 200, body: { ok: true } }), () => requestJson("https://x.test/a", { retries: 1 }));
  check("503 is retried once, then succeeds", retried.value.ok && retried.calls.length === 2);
  const longWait = await withFetch(() => ({ status: 429, body: {}, headers: { "retry-after": "60" } }), () => requestJson("https://x.test/a", { retries: 1 }));
  check("429 with a long Retry-After is reported, not slept on", !longWait.value.ok && longWait.calls.length === 1 && longWait.value.retryAfterMs === 60_000);
  const timeout = await withFetch(() => "timeout", () => requestJson("https://x.test/a", { retries: 1, retryTimeouts: false }));
  check("Timeout is not retried when the caller has a fallback", timeout.calls.length === 1 && timeout.value.timedOut === true && timeout.value.status === 0);
  const network = await withFetch(() => "network", () => requestJson("https://x.test/a", { retries: 0 }));
  check("Network error → reached=false, temporary", !network.value.reached && classifyHttp(network.value) === "temporary");

  section = "Gemini key, errors and fallback (mocked)";
  check("Default chain: configured model, then 3.5 Flash, then Flash-Lite", JSON.stringify(geminiModels({ GEMINI_MODEL: "gemini-3.8-flash" })) === JSON.stringify(["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"]));
  check("GEMINI_FALLBACK_MODEL is used (comma-separated)", JSON.stringify(geminiModels({ GEMINI_MODEL: "a-1", GEMINI_FALLBACK_MODEL: "b-2, c-3" })) === JSON.stringify(["a-1", "b-2", "c-3"]));
  check("Default model is not the retired 2.5 Flash", (DEFAULT_GEMINI_MODEL as string) !== "gemini-2.5-flash");
  check("400 API_KEY_INVALID → credentials rejected", geminiFailure({ status: 400, reached: true, data: googleError(400, "INVALID_ARGUMENT", "API key not valid", [{ reason: "API_KEY_INVALID" }]) }) === "auth");
  check("403 SERVICE_DISABLED → activation required", geminiFailure({ status: 403, reached: true, data: googleError(403, "PERMISSION_DENIED", "disabled", [{ reason: "SERVICE_DISABLED" }]) }) === "activation");
  check("429 RESOURCE_EXHAUSTED → quota", geminiFailure({ status: 429, reached: true, data: googleError(429, "RESOURCE_EXHAUSTED", "quota") }) === "quota");
  check("503 UNAVAILABLE → temporary", geminiFailure({ status: 503, reached: true, data: googleError(503, "UNAVAILABLE", "high demand") }) === "temporary");

  const KEY = "AQ.fake-test-key-0123456789abcdefghijkl";
  const ok = (text: string) => ({ status: 200, body: { candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] } });
  const run = (route: (url: string, n: number) => Reply, extra: Record<string, string | undefined> = {}) =>
    withEnv({ GEMINI_API_KEY: KEY, GEMINI_MODEL: "primary-model", GEMINI_FALLBACK_MODEL: "fallback-model", ...extra }, () =>
      withFetch(route, () => generate({ system: "s", turns: [{ role: "user", text: "hi" }], timeoutMs: 10_000 }))
    );
  const byModel = (primary: Reply) => (url: string): Reply => (url.includes("primary-model") ? primary : ok("from fallback"));

  const t1 = await run(byModel("timeout"));
  check("Primary timeout → fallback answers", t1.value.ok && t1.value.model === "fallback-model" && t1.value.attempts[0].failure === "temporary", JSON.stringify(t1.value.attempts));
  check("Timed-out primary is not retried", t1.calls.filter((c) => c.url.includes("primary-model")).length === 1);
  const t2 = await run(byModel({ status: 503, body: googleError(503, "UNAVAILABLE", "high demand") }));
  check("Primary 503 (after one retry) → fallback answers", t2.value.ok && t2.value.model === "fallback-model" && t2.calls.filter((c) => c.url.includes("primary-model")).length === 2);
  const t3 = await run(byModel({ status: 404, body: googleError(404, "NOT_FOUND", "model is no longer available to new users") }));
  check("Primary 404 (retired model) → fallback answers", t3.value.ok && t3.value.model === "fallback-model" && t3.value.attempts[0].failure === "config");
  const t4 = await run(byModel({ status: 429, body: googleError(429, "RESOURCE_EXHAUSTED", "quota", [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "30s" }]) }));
  check("Primary 429 with a 30 s wait → fallback, no sleeping", t4.value.ok && t4.value.model === "fallback-model" && t4.calls.filter((c) => c.url.includes("primary-model")).length === 1);
  const t5 = await run(() => ({ status: 400, body: googleError(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.", [{ reason: "API_KEY_INVALID" }]) }));
  check("Invalid key → stops, no pointless fallback call", !t5.value.ok && t5.value.failure === "auth" && t5.calls.length === 1);
  const t6 = await run(() => "timeout");
  check("Every model times out → temporary failure reported", !t6.value.ok && t6.value.failure === "temporary" && t6.value.attempts.length === 2);
  // Free-tier daily quota (the real 2026-11-08 response): 429 with retryDelay 76879s.
  clearGeminiCooldowns();
  const daily = { status: 429, body: googleError(429, "RESOURCE_EXHAUSTED", "Generate content requests per day limit exceeded on Free Tier.", [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "76879s" }]) } as Reply;
  const q1 = await run(byModel(daily));
  check("Daily quota 429 → fallback answers, model put in cooldown", q1.value.ok && q1.value.model === "fallback-model" && Boolean(geminiCooldown("primary-model")));
  const q2 = await run(byModel(daily));
  check("During cooldown the exhausted model gets no request at all", q2.value.ok && q2.calls.every((c) => !c.url.includes("primary-model")) && q2.value.attempts[0].status === 429 && q2.value.attempts[0].ms === 0);
  check("Cooldown ends at Google's reset time (~21 h), not sooner", (geminiCooldown("primary-model")?.until ?? 0) - Date.now() > 20 * 3_600_000);
  // Recovery: once the reset time has passed, the primary is tried again and answers.
  const store = (globalThis as typeof globalThis & { __geminiCooldown?: Map<string, { until: number; error: string }> }).__geminiCooldown;
  store?.set("primary-model", { until: Date.now() - 1, error: "expired" });
  const q4 = await run(() => ok("back"));
  check("After the reset time the primary model is used again (recovery)", q4.value.ok && q4.value.model === "primary-model" && q4.calls.length === 1);
  clearGeminiCooldowns();
  const q3 = await run(byModel({ status: 429, body: googleError(429, "RESOURCE_EXHAUSTED", "per minute"), headers: { "retry-after": "2" } }));
  check("Short 429 (per-minute) is retried once after the wait, no cooldown", q3.calls.filter((c) => c.url.includes("primary-model")).length === 2 && !geminiCooldown("primary-model"));
  clearGeminiCooldowns();
  const r408 = await run(byModel({ status: 408, body: googleError(408, "DEADLINE_EXCEEDED", "request timeout") }));
  check("Primary 408 (after one retry) → fallback answers", r408.value.ok && r408.value.model === "fallback-model" && r408.calls.filter((c) => c.url.includes("primary-model")).length === 2);
  const net = await run(byModel("network"));
  check("Primary network error (after one retry) → fallback answers", net.value.ok && net.value.model === "fallback-model" && net.calls.filter((c) => c.url.includes("primary-model")).length === 2);
  // Both models on their daily quota: one request each, a quota failure, then no requests at all until the reset.
  const allOut = await run(() => daily);
  check("Every model on daily quota → quota failure, one request per model", !allOut.value.ok && allOut.value.failure === "quota" && allOut.calls.length === 2);
  const allCooling = await run(() => daily);
  check("…and the next reply sends no request (both models cooling down)", !allCooling.value.ok && allCooling.calls.length === 0 && allCooling.value.attempts.every((a) => a.ms === 0));
  clearGeminiCooldowns();
  const t7 = await run(() => ok("OK"));
  check("Healthy primary → no fallback call", t7.value.ok && t7.value.model === "primary-model" && t7.calls.length === 1);
  check("Key is sent in x-goog-api-key, never in the URL", t7.calls[0].headers["x-goog-api-key"] === KEY && !t7.calls[0].url.includes(KEY));
  const leaked = [t1, t2, t3, t4, t5, t6].some((r) => JSON.stringify(r.value).includes(KEY));
  check("Key never appears in results or errors", !leaked);
  check("AQ.-format keys are redacted from text", !redactSecrets(`failed for ${KEY}`).includes(KEY));

  section = "Vapi ids and secrets";
  const uuid = "3f0c2a4e-1b2c-4d5e-8f90-123456789abc";
  check("Placeholder assistant id is rejected before any request", vapiValueProblem("VAPI_ASSISTANT_ID", "YOUR_VAPI_ASSISTANT_ID") === "is placeholder text, not a real value");
  check("Non-UUID id is rejected (Vapi would answer 400)", (vapiValueProblem("VAPI_PHONE_NUMBER_ID", "12345") || "").includes("UUID"));
  check("Real UUID accepted", vapiValueProblem("VAPI_SIP_CREDENTIAL_ID", uuid) === null && isUuid(uuid));
  check("Private key must be a UUID", vapiValueProblem("VAPI_API_KEY", "pk_live_abc") !== null && vapiValueProblem("VAPI_API_KEY", uuid) === null);
  check("Short or placeholder webhook secret rejected", vapiValueProblem("VAPI_WEBHOOK_SECRET", "abc") !== null && vapiValueProblem("VAPI_WEBHOOK_SECRET", "VAPI_WEBHOOK_SECRET") !== null);
  const headers = (value: string) => ({ get: (n: string) => (n === "x-vapi-secret" ? value : null) });
  check("Webhook refuses a request signed with a placeholder secret", !vapiRequestAuthorized(headers("VAPI_WEBHOOK_SECRET"), "VAPI_WEBHOOK_SECRET"));
  check("Webhook accepts the real secret", vapiRequestAuthorized(headers("a".repeat(64)), "a".repeat(64)));

  section = "Cron and webhook authorization";
  const cronReq = (auth?: string) => new Request("https://x.test/api/ai/jobs", { method: "POST", headers: auth ? { authorization: auth } : {} });
  const cronSecret = "c".repeat(64);
  await withEnv({ CRON_SECRET: cronSecret }, async () => {
    check("Cron: correct bearer accepted", cronAllowed(cronReq(`Bearer ${cronSecret}`)));
    check("Cron: wrong bearer rejected", !cronAllowed(cronReq("Bearer wrong-secret")));
    check("Cron: missing header rejected", !cronAllowed(cronReq()));
  });
  await withEnv({ CRON_SECRET: undefined }, async () => check("Cron: no CRON_SECRET → everything rejected", !cronAllowed(cronReq("Bearer anything"))));
  await withEnv({ CRON_SECRET: "YOUR_CRON_SECRET" }, async () => check("Cron: placeholder secret cannot be used to authenticate", !cronAllowed(cronReq("Bearer YOUR_CRON_SECRET"))));
  const body = '{"object":"whatsapp_business_account"}';
  const sign = (secret: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const appSecret = "0123456789abcdef0123456789abcdef";
  check("WhatsApp: correctly signed webhook accepted", verifySignature(body, sign(appSecret), appSecret).ok);
  check("WhatsApp: forged signature rejected (401)", verifySignature(body, sign("other-secret"), appSecret).status === 401);
  check("WhatsApp: placeholder app secret → not configured (503), even with a matching signature", verifySignature(body, sign("YOUR_META_APP_SECRET"), "YOUR_META_APP_SECRET").status === 503);

  section = "Placeholders and Exotel parsing";
  check("SHOUTING_SNAKE values are placeholders", looksLikePlaceholder("YOUR_META_APP_SECRET") && looksLikePlaceholder("VAPI_API_KEY") && looksLikePlaceholder("<token>"));
  check("Real-looking values are not placeholders", !looksLikePlaceholder(uuid) && !looksLikePlaceholder("DHLECS") && !looksLikePlaceholder("9f86d081884c7d659a2feaa0c55ad015"));
  check("One ExoPhone (object) is counted", exophoneRows({ IncomingPhoneNumber: { PhoneNumber: "+6500000000" } }).length === 1);
  check("Several ExoPhones (array) are counted", exophoneRows({ IncomingPhoneNumber: [{ PhoneNumber: "1" }, { PhoneNumber: "2" }] }).length === 2);
  check("No ExoPhone → empty", exophoneRows({}).length === 0);
  check("Singapore region with the Singapore cluster → fine", exotelRegionProblem("Singapore", "api.exotel.com") === null);
  check("Singapore region with the Mumbai cluster → flagged", exotelRegionProblem("Singapore", "api.in.exotel.com") !== null);

  return results;
}
