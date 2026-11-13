// Writes reports/MARINA_MUSE_PRODUCTION_ENV_TEMPLATE.env from lib/ai/env-registry.ts.
// NAMES AND PLACEHOLDERS ONLY: no value from any env file is read or copied.
import fs from "node:fs";
import { ENV_REGISTRY } from "../../../lib/ai/env-registry.ts";
const devOnly = ENV_REGISTRY.filter((v) => v.scope === "development").map((v) => v.name);
// Guard switches that must stay off / unset in production.
const MUST_BE = {
  PAYPAL_MODE: "live",
  PAYPAL_ALLOW_LIVE_OUTSIDE_PRODUCTION: "<unset in production>",
  SHIPGLOBAL_ALLOW_OUTSIDE_PRODUCTION: "<unset in production>",
  WHATSAPP_OUTBOUND_ENABLED: "false",
  WHATSAPP_PRODUCTION_ONBOARDING_APPROVED: "false",
  VAPI_OUTBOUND_ENABLED: "false",
  WHATSAPP_COEXISTENCE_ENABLED: "false",
};
const L = [
  "# Marina Muse — production environment TEMPLATE (names and placeholders only).",
  "# Generated from lib/ai/env-registry.ts by reports/evidence/security/gen-prod-env-template.mjs.",
  "# Contains NO real value. Fill on the production server only (.env.production.local), never in a repository,",
  "# chat, AI tool or another project's folder. Every secret marked [secret] must be a NEW value where the",
  "# security report recommends rotation (MongoDB user, and any secret that was in the exposed .env copy).",
  "# NODE_ENV=production is set by `next start` / the process manager, not here.",
  "",
];
let cat = "";
for (const v of ENV_REGISTRY) {
  if (devOnly.includes(v.name)) continue;
  if (v.category !== cat) { cat = v.category; L.push("", `# ── ${cat} ──`); }
  const tag = [v.required, v.secret ? "secret" : null, v.agents.join("/")].filter(Boolean).join(", ");
  L.push(`# ${v.how.replace(/\n/g, " ")} [${tag}]`);
  const val = MUST_BE[v.name] ?? (v.secret ? "<secret: set on server>" : v.required === "optional" ? "" : "<set on server>");
  L.push(`${v.required === "optional" && !MUST_BE[v.name] ? "# " : ""}${v.name}=${val}`);
}
L.push("", "# ── Development-only (must NOT be set in production) ──", ...devOnly.map((n) => `# ${n}=`));
fs.writeFileSync("reports/MARINA_MUSE_PRODUCTION_ENV_TEMPLATE.env", L.join("\n") + "\n");
console.log(`template: ${ENV_REGISTRY.length - devOnly.length} production variables, ${devOnly.length} development-only listed as must-not-set: ${devOnly.join(", ")}`);
