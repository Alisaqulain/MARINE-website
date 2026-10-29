import { requireAdminSession } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/ai/crm";
import {
  acceptSignupPost,
  encryptToken,
  exchangeAuthorizationCode,
  graphVersion,
  originMatches,
  rememberAuthorizationCode,
  redact,
  signupActorAllowed,
  SUPPLIED_APP_ID,
  type SignupBody,
} from "@/lib/whatsapp/coexistence";
import { readCoexistenceState, writeCoexistenceState } from "@/lib/whatsapp/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;
  if (!signupActorAllowed(auth.session?.user?.role)) {
    return NextResponse.json({ error: "Only the main admin can run WhatsApp signup." }, { status: 403 });
  }
  if (!originMatches(req.headers.get("origin"), req.headers.get("host"))) {
    return NextResponse.json({ error: "Signup was refused." }, { status: 403 });
  }
  const actor = auth.session.user.email || "admin";
  if (!rateLimit(`wa-signup:${actor}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many signup attempts. Please wait a minute." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as SignupBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Signup payload was not valid." }, { status: 400 });
  }
  const decision = acceptSignupPost(body, process.env);
  const at = new Date().toISOString();
  if (decision.outcome !== "exchanged") {
    if (decision.store === "simulated" && decision.wabaId && decision.phoneNumberId) {
      await writeCoexistenceState({
        mode: "simulated",
        wabaId: decision.wabaId,
        phoneNumberId: decision.phoneNumberId,
        businessId: decision.businessId,
        lastAttempt: { at, outcome: "simulated", event: decision.event, detail: decision.detail },
      }).catch(() => undefined);
    } else if (decision.outcome !== "invalid") {
      await writeCoexistenceState({
        lastAttempt: { at, outcome: decision.outcome, event: decision.event, detail: decision.detail },
      }).catch(() => undefined);
    }
    console.info("[whatsapp] signup", decision.outcome);
    return NextResponse.json(
      {
        ok: decision.status === 200,
        dryRun: body.dryRun === true,
        calledMeta: false,
        stored: false,
        credentialMode: decision.store === "simulated" ? "simulated" : "none",
        error: decision.status === 200 ? undefined : decision.detail,
        detail: decision.detail,
      },
      { status: decision.status }
    );
  }

  const secret = process.env.META_APP_SECRET?.trim() || "";
  const current = await readCoexistenceState();
  const replay = rememberAuthorizationCode(current?.usedCodeHashes, decision.code || "");
  if (replay.replay) {
    console.info("[whatsapp] signup replay_blocked");
    return NextResponse.json(
      { ok: false, calledMeta: false, stored: false, error: "This authorization code was already used. Meta was not called again." },
      { status: 409 }
    );
  }
  const exchanged = await exchangeAuthorizationCode({
    code: decision.code || "",
    appId: process.env.META_APP_ID?.trim() || SUPPLIED_APP_ID,
    appSecret: secret,
    version: graphVersion(process.env.META_GRAPH_API_VERSION),
    allowNetwork: true,
  });
  if (!exchanged.ok || !exchanged.token) {
    const detail = redact(exchanged.error || "Token exchange failed.", [secret, decision.code || ""]);
    await writeCoexistenceState({
      lastAttempt: { at, outcome: "exchange_failed", event: decision.event, detail },
    }).catch(() => undefined);
    console.info("[whatsapp] signup exchange_failed");
    return NextResponse.json({ ok: false, calledMeta: exchanged.calledMeta, stored: false, error: detail }, { status: exchanged.status });
  }

  const authSecret = process.env.AUTH_SECRET?.trim() || "";
  let tokenCiphertext = "";
  try {
    tokenCiphertext = encryptToken(exchanged.token, authSecret);
    await writeCoexistenceState({
      mode: "stored",
      wabaId: decision.wabaId,
      phoneNumberId: decision.phoneNumberId,
      businessId: decision.businessId,
      tokenCiphertext,
      tokenExpiresAt: exchanged.tokenExpiresAt,
      usedCodeHashes: replay.hashes,
      lastAttempt: {
        at,
        outcome: "exchanged",
        event: decision.event,
        detail: "Token stored on the server. The phone number was not registered.",
      },
    });
  } catch {
    console.info("[whatsapp] signup store_failed");
    return NextResponse.json(
      { ok: false, calledMeta: true, stored: false, error: "The token could not be stored." },
      { status: 500 }
    );
  }
  console.info("[whatsapp] signup exchanged");
  return NextResponse.json({
    ok: true,
    calledMeta: true,
    stored: true,
    credentialMode: "stored",
    coexistenceVerified: "not verified",
    webhookSubscription: "not verified",
    detail: "Token stored on the server. The phone number was not registered and coexistence is not verified.",
  });
}
