import { getDb } from "@/lib/mongodb";
import type { StoredCoexistence } from "@/lib/whatsapp/coexistence";

const STATE = "wa_coexistence_state";
const EVENTS = "wa_webhook_events";

let indexReady: Promise<void> | null = null;

function ensureIndex() {
  if (!indexReady) {
    indexReady = getDb()
      .then((db) => db.collection(EVENTS).createIndex({ key: 1 }, { unique: true }))
      .then(() => undefined)
      .catch(() => undefined);
  }
  return indexReady;
}

const str = (value: unknown) => (typeof value === "string" && value ? value : undefined);

/** Onboarding facts that only the server sets (number check, subscription, syncs, history progress). */
type OnboardingFields = Pick<
  StoredCoexistence,
  | "onboardedAt"
  | "displayNumber"
  | "verifiedName"
  | "isOnBizApp"
  | "platformType"
  | "numberCheckedAt"
  | "isTestNumber"
  | "subscribedAt"
  | "contactsSyncRequestedAt"
  | "historySyncRequestedAt"
  | "historyStatus"
  | "phoneNumberId"
>;

export async function updateOnboardingFields(patch: Partial<OnboardingFields>) {
  const db = await getDb();
  await db.collection(STATE).updateOne({ id: "current" }, { $set: { id: "current", ...patch, updatedAt: new Date().toISOString() } }, { upsert: true });
}

/** A new real signup starts a fresh onboarding: previous number checks, subscription and syncs no longer apply. */
export async function startOnboarding(onboardedAt: string) {
  const db = await getDb();
  await db.collection(STATE).updateOne(
    { id: "current" },
    {
      $set: { id: "current", onboardedAt },
      $unset: {
        displayNumber: "",
        verifiedName: "",
        isOnBizApp: "",
        platformType: "",
        numberCheckedAt: "",
        isTestNumber: "",
        subscribedAt: "",
        contactsSyncRequestedAt: "",
        historySyncRequestedAt: "",
        historyStatus: "",
      },
    },
    { upsert: true }
  );
}

/** Removes stored credentials and onboarding facts (used when an onboarded number is not allowed). */
export async function clearCredentials(lastAttempt: NonNullable<StoredCoexistence["lastAttempt"]>) {
  const db = await getDb();
  await db.collection(STATE).updateOne(
    { id: "current" },
    {
      $set: { id: "current", mode: "none", tokenCiphertext: "", tokenExpiresAt: "", lastAttempt, updatedAt: new Date().toISOString() },
      $unset: {
        onboardedAt: "",
        displayNumber: "",
        verifiedName: "",
        isOnBizApp: "",
        platformType: "",
        numberCheckedAt: "",
        isTestNumber: "",
        subscribedAt: "",
        contactsSyncRequestedAt: "",
        historySyncRequestedAt: "",
        historyStatus: "",
      },
    },
    { upsert: true }
  );
}

export async function readCoexistenceState(): Promise<StoredCoexistence | null> {
  try {
    const db = await getDb();
    const doc = await db.collection(STATE).findOne({ id: "current" });
    if (!doc) return null;
    return {
      mode: doc.mode === "stored" || doc.mode === "simulated" ? doc.mode : "none",
      wabaId: typeof doc.wabaId === "string" ? doc.wabaId : undefined,
      phoneNumberId: typeof doc.phoneNumberId === "string" ? doc.phoneNumberId : undefined,
      businessId: typeof doc.businessId === "string" ? doc.businessId : undefined,
      tokenCiphertext: typeof doc.tokenCiphertext === "string" ? doc.tokenCiphertext : undefined,
      tokenExpiresAt: typeof doc.tokenExpiresAt === "string" ? doc.tokenExpiresAt : undefined,
      usedCodeHashes: Array.isArray(doc.usedCodeHashes) ? doc.usedCodeHashes.filter((item) => typeof item === "string") : undefined,
      webhookHandshakeAt: typeof doc.webhookHandshakeAt === "string" ? doc.webhookHandshakeAt : undefined,
      onboardedAt: str(doc.onboardedAt),
      displayNumber: str(doc.displayNumber),
      verifiedName: str(doc.verifiedName),
      isOnBizApp: typeof doc.isOnBizApp === "boolean" ? doc.isOnBizApp : undefined,
      platformType: str(doc.platformType),
      numberCheckedAt: str(doc.numberCheckedAt),
      isTestNumber: doc.isTestNumber === true,
      subscribedAt: str(doc.subscribedAt),
      contactsSyncRequestedAt: str(doc.contactsSyncRequestedAt),
      historySyncRequestedAt: str(doc.historySyncRequestedAt),
      historyStatus: doc.historyStatus && typeof doc.historyStatus === "object" ? (doc.historyStatus as StoredCoexistence["historyStatus"]) : undefined,
      lastAttempt: doc.lastAttempt && typeof doc.lastAttempt === "object" ? (doc.lastAttempt as StoredCoexistence["lastAttempt"]) : undefined,
    };
  } catch {
    return null;
  }
}

export async function writeCoexistenceState(patch: Partial<StoredCoexistence>) {
  const db = await getDb();
  const current = (await readCoexistenceState()) || { mode: "none" as const };
  const mode = patch.mode || current.mode;
  const tokenCiphertext =
    patch.mode === "stored" ? patch.tokenCiphertext : patch.mode === "simulated" ? undefined : current.tokenCiphertext;
  const tokenExpiresAt = patch.mode === "stored" ? patch.tokenExpiresAt : patch.mode === "simulated" ? undefined : current.tokenExpiresAt;
  const next: StoredCoexistence = {
    ...current,
    ...patch,
    mode,
    tokenCiphertext,
    tokenExpiresAt,
    usedCodeHashes: patch.usedCodeHashes || current.usedCodeHashes,
  };
  await db.collection(STATE).updateOne(
    { id: "current" },
    {
      $set: {
        id: "current",
        mode: next.mode,
        wabaId: next.wabaId || "",
        phoneNumberId: next.phoneNumberId || "",
        businessId: next.businessId || "",
        tokenCiphertext: next.tokenCiphertext || "",
        tokenExpiresAt: next.tokenExpiresAt || "",
        usedCodeHashes: next.usedCodeHashes || [],
        webhookHandshakeAt: next.webhookHandshakeAt || "",
        lastAttempt: next.lastAttempt || null,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true }
  );
}

export async function markWebhookHandshake() {
  try {
    const db = await getDb();
    await db.collection(STATE).updateOne(
      { id: "current" },
      { $set: { id: "current", webhookHandshakeAt: new Date().toISOString() } },
      { upsert: true }
    );
  } catch {
    /* The handshake response still succeeds. Subscription is a separate Meta step. */
  }
}

export async function recordWebhookKey(key: string, meta: { field: string; action: string; reason: string }) {
  try {
    await ensureIndex();
    const db = await getDb();
    await db.collection(EVENTS).insertOne({
      key,
      field: meta.field,
      action: meta.action,
      reason: meta.reason.slice(0, 200),
      at: new Date().toISOString(),
    });
    return { duplicate: false as const };
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
      return { duplicate: true as const };
    }
    return { duplicate: false as const };
  }
}
