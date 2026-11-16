/**
 * Phase 2 F (v1.1 §5): SHA-256 fingerprints of PRODUCTION Meta identifiers and protected recipient numbers.
 * An accidental-misconfiguration guard, not a secret: a 15-digit identifier space is enumerable. Fingerprints grant
 * no access to anything; production credentials are never used for testing.
 *
 * Canonical rule: the value must be a string; ASCII whitespace (space, tab, CR, LF) is trimmed; the result must match
 * ^[0-9]+$ (leading zeros preserved). Fingerprint = lowercase hex SHA-256 of "<kind>:<id>".
 * Meta kinds: waba, phone_number_id, app_id, config_id. Recipients are a SEPARATE list, kind "recipient".
 *
 * Fail closed: missing, unreadable, malformed or invalid configuration refuses; there is no bypass flag and no
 * notice-only mode. Pure apart from reading the file; relative imports only.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const META_KINDS = ["waba", "phone_number_id", "app_id", "config_id"] as const;
export type MetaKind = (typeof META_KINDS)[number];
export type FingerprintKind = MetaKind | "recipient";
export const DEFAULT_FINGERPRINT_FILE = "config/whatsapp-production-fingerprints.json";

export type FingerprintConfig = { version: 1; ids: Record<MetaKind, string[]>; recipients: string[]; liveNumberNotOnCloudApi?: boolean };
export type LoadResult = { ok: true; config: FingerprintConfig } | { ok: false; reason: string };

const HASH = /^[a-f0-9]{64}$/;

export function canonicalize(value: unknown): { ok: true; id: string } | { ok: false; reason: string } {
  if (typeof value !== "string") return { ok: false, reason: "identifier must be a string" };
  const id = value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
  if (!id) return { ok: false, reason: "identifier is empty" };
  if (!/^[0-9]+$/.test(id)) return { ok: false, reason: "identifier must contain digits only" };
  return { ok: true, id };
}

export function fingerprint(kind: FingerprintKind, value: unknown): string | null {
  const c = canonicalize(value);
  return c.ok ? createHash("sha256").update(`${kind}:${c.id}`).digest("hex") : null;
}

/** Structural validation of the parsed JSON. */
export function parseFingerprintConfig(raw: unknown): LoadResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "not a JSON object" };
  const o = raw as Record<string, unknown>;
  const allowedTop = new Set(["version", "note", "ids", "recipients", "liveNumberNotOnCloudApi"]);
  const unknownTop = Object.keys(o).filter((k) => !allowedTop.has(k));
  if (unknownTop.length) return { ok: false, reason: "unknown top-level key" };
  if (o.version !== 1) return { ok: false, reason: "version must be 1" };
  if (!o.ids || typeof o.ids !== "object" || Array.isArray(o.ids)) return { ok: false, reason: "ids must be an object" };
  const ids = o.ids as Record<string, unknown>;
  if (Object.keys(ids).some((k) => !(META_KINDS as readonly string[]).includes(k))) return { ok: false, reason: "unknown identifier kind" };
  const lists = {} as Record<MetaKind, string[]>;
  for (const kind of META_KINDS) {
    const list = ids[kind];
    if (!Array.isArray(list)) return { ok: false, reason: `ids.${kind} must be an array` };
    if (!list.every((h) => typeof h === "string" && HASH.test(h))) return { ok: false, reason: `ids.${kind} contains an invalid hash` };
    lists[kind] = list as string[];
  }
  if (!Array.isArray(o.recipients) || !o.recipients.every((h) => typeof h === "string" && HASH.test(h))) {
    return { ok: false, reason: "recipients must be an array of hashes" };
  }
  // Recorded owner decision (16 Nov 2026): the live business number has no Cloud API WABA / phone-number id yet, so
  // those two lists cannot be populated. Must name who decided and when; app_id and the protected recipients stay required.
  const d = o.liveNumberNotOnCloudApi as Record<string, unknown> | undefined;
  if (d !== undefined && (!d || typeof d !== "object" || typeof d.decidedBy !== "string" || !d.decidedBy.trim() || typeof d.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date))) {
    return { ok: false, reason: "liveNumberNotOnCloudApi must have decidedBy and date (YYYY-MM-DD)" };
  }
  return { ok: true, config: { version: 1, ids: lists, recipients: o.recipients as string[], liveNumberNotOnCloudApi: d !== undefined } };
}

export function loadFingerprintFile(file: string): LoadResult {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return { ok: false, reason: "fingerprint configuration missing or unreadable" };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "fingerprint configuration is not valid JSON" };
  }
  return parseFingerprintConfig(raw);
}

type Env = Record<string, string | undefined>;
const val = (env: Env, name: string) => (env[name] ?? "").trim();

/** WHATSAPP_FINGERPRINT_FILE may point elsewhere (offline tests); the same fail-closed validation always applies. */
export function fingerprintFile(env: Env = process.env, cwd = process.cwd()) {
  return path.resolve(cwd, val(env, "WHATSAPP_FINGERPRINT_FILE") || DEFAULT_FINGERPRINT_FILE);
}

/** Supplied identifiers checked against each kind. */
export const IDENTIFIER_VARS: { name: string; kind: MetaKind }[] = [
  { name: "META_APP_ID", kind: "app_id" },
  { name: "META_CONFIG_ID", kind: "config_id" },
  { name: "WHATSAPP_PHONE_NUMBER_ID", kind: "phone_number_id" },
  { name: "WHATSAPP_TEST_PHONE_NUMBER_ID", kind: "phone_number_id" },
  { name: "WHATSAPP_BUSINESS_ACCOUNT_ID", kind: "waba" },
  { name: "WHATSAPP_TEST_BUSINESS_ACCOUNT_ID", kind: "waba" },
];

/**
 * A run is Meta-related when any Meta/WhatsApp identifier, access token or recipient is supplied (v1.1 §5.3).
 * Webhook secrets alone (the launcher generates synthetic ones every run) cannot reach Meta and do not count.
 */
export const META_RELATED_VARS = [
  ...IDENTIFIER_VARS.map((v) => v.name),
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_TEST_RECIPIENTS",
  "WHATSAPP_COEXISTENCE_TEST_NUMBER",
];
export function isMetaRelated(env: Env) {
  return META_RELATED_VARS.some((name) => Boolean(val(env, name)));
}

export type FingerprintDecision = { ok: boolean; problems: string[] };

/**
 * Full v1.1 §5.3 decision for a non-production run.
 * - Configuration must always load and validate (Gemini-only runs included).
 * - Meta-related runs additionally need populated required lists: waba, phone_number_id, app_id, plus config_id when
 *   META_CONFIG_ID is supplied; and a populated recipients list when WHATSAPP_TEST_RECIPIENTS is supplied.
 * - Any supplied identifier or recipient whose fingerprint is listed is refused.
 * Problems name variables only, never values or hashes.
 */
export function checkFingerprints(env: Env, loaded: LoadResult): FingerprintDecision {
  if (!loaded.ok) return { ok: false, problems: [`fingerprint configuration invalid: ${loaded.reason}`] };
  const cfg = loaded.config;
  const problems: string[] = [];
  const metaRelated = isMetaRelated(env);
  if (metaRelated) {
    const liveIdKinds: MetaKind[] = cfg.liveNumberNotOnCloudApi ? [] : ["waba", "phone_number_id"];
    const required: MetaKind[] = [...liveIdKinds, "app_id", ...(val(env, "META_CONFIG_ID") ? (["config_id"] as MetaKind[]) : [])];
    for (const kind of required) if (!cfg.ids[kind].length) problems.push(`required fingerprint list ids.${kind} is empty`);
    if (val(env, "WHATSAPP_TEST_RECIPIENTS") && !cfg.recipients.length) problems.push("recipients fingerprint list is empty while WHATSAPP_TEST_RECIPIENTS is set");
    // With the live-number decision recorded, the live business number itself must be in the protected recipients.
    if (cfg.liveNumberNotOnCloudApi && !cfg.recipients.length) problems.push("recipients fingerprint list must protect the live business number");
  }
  for (const { name, kind } of IDENTIFIER_VARS) {
    const v = val(env, name);
    if (!v) continue;
    const fp = fingerprint(kind, v);
    if (!fp) problems.push(`${name} is not a valid identifier`);
    else if (cfg.ids[kind].includes(fp)) problems.push(`${name} matches a production fingerprint`);
  }
  for (const r of val(env, "WHATSAPP_TEST_RECIPIENTS").split(",").map((x) => x.replace(/\D/g, "")).filter(Boolean)) {
    const fp = fingerprint("recipient", r);
    if (fp && cfg.recipients.includes(fp)) problems.push("WHATSAPP_TEST_RECIPIENTS contains a protected recipient");
  }
  return { ok: problems.length === 0, problems };
}

/** Runtime check (cached per file mtime) used by lib/whatsapp/mode.ts outside production. */
let cache: { file: string; mtime: number; result: LoadResult } | null = null;
export function runtimeFingerprintCheck(env: Env = process.env): FingerprintDecision {
  const file = fingerprintFile(env);
  let mtime = -1;
  try {
    mtime = fs.statSync(file).mtimeMs;
  } catch {
    /* missing → load fails closed below */
  }
  if (!cache || cache.file !== file || cache.mtime !== mtime) cache = { file, mtime, result: loadFingerprintFile(file) };
  return checkFingerprints(env, cache.result);
}
