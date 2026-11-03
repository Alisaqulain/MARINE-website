/**
 * Every environment variable the app reads: who provides it, where to get it, whether it is required, which
 * agent uses it, and a format check. Single source for /test, docs/phase2/ENVIRONMENT_SETUP.md
 * (`npm run docs:env`) and the env consistency test. Values are never returned — only set/valid flags.
 * Pure (no imports), so plain Node and the browser-free tests can load it.
 */

export type EnvAgent = "chat" | "voice" | "growth" | "whatsapp" | "platform";

export type EnvVar = {
  name: string;
  category: string;
  provider: string;
  /** Where the value is created. */
  where: string;
  /** How to obtain or choose it. */
  how: string;
  required: "required" | "optional" | "required-for-feature";
  agents: EnvAgent[];
  scope: "both" | "production" | "development";
  secret: boolean;
  /** Returns a problem description, or null when the value looks right. Never echoes the value. */
  validate?: (value: string) => string | null;
};

const digits = (min: number, max: number, label: string) => (v: string) =>
  new RegExp(`^\\d{${min},${max}}$`).test(v) ? null : `${label} should be ${min}–${max} digits`;
const oneOf = (options: string[]) => (v: string) => (options.includes(v) ? null : `should be one of: ${options.join(", ")}`);
const bool = oneOf(["true", "false"]);
const url = (v: string) => (/^https?:\/\/[^\s]+$/.test(v) ? null : "should be a full URL starting with http:// or https://");
const minLen = (n: number) => (v: string) => (v.length >= n ? null : `should be at least ${n} characters`);
const email = (v: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "should be an email address");
const emails = (v: string) => (v.split(",").every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())) ? null : "should be comma-separated email addresses");
const phone = (v: string) => (/^\+?[\d\s-]{10,16}$/.test(v) ? null : "should be a phone number with country code, e.g. +91…");

export const ENV_REGISTRY: EnvVar[] = [
  // ── Platform: database, auth, site ──
  { name: "MONGODB_URI", category: "Database (MongoDB Atlas)", provider: "MongoDB Atlas", where: "cloud.mongodb.com → Database → Connect → Drivers", how: "Copy the SRV connection string and insert the database user's password.", required: "required", agents: ["platform"], scope: "both", secret: true, validate: (v) => (/^mongodb(\+srv)?:\/\//.test(v) ? null : "should start with mongodb:// or mongodb+srv://") },
  { name: "MONGODB_URI_STANDARD", category: "Database (MongoDB Atlas)", provider: "MongoDB Atlas", where: "Connect → Drivers → standard connection string", how: "Only if SRV DNS fails on the server; overrides MONGODB_URI.", required: "optional", agents: ["platform"], scope: "both", secret: true, validate: (v) => (/^mongodb:\/\//.test(v) ? null : "should start with mongodb://") },
  { name: "MONGODB_DB_NAME", category: "Database (MongoDB Atlas)", provider: "You", where: ".env", how: "Database name, e.g. marina_muse.", required: "required", agents: ["platform"], scope: "both", secret: false },
  { name: "MONGODB_PREFER_IPV4", category: "Database (MongoDB Atlas)", provider: "You", where: ".env", how: "1 to prefer IPv4 (recommended on the VPS).", required: "optional", agents: ["platform"], scope: "both", secret: false, validate: oneOf(["0", "1"]) },
  { name: "MONGODB_NODE_PROCESSES", category: "Database (MongoDB Atlas)", provider: "You", where: ".env", how: "Number of app processes sharing the Atlas connection limit (e.g. 2 under PM2).", required: "optional", agents: ["platform"], scope: "production", secret: false, validate: digits(1, 2, "MONGODB_NODE_PROCESSES") },
  { name: "MONGODB_EXTERNAL_CLIENTS", category: "Database (MongoDB Atlas)", provider: "You", where: ".env", how: "Connections reserved for other clients (default 40).", required: "optional", agents: ["platform"], scope: "production", secret: false, validate: digits(1, 4, "MONGODB_EXTERNAL_CLIENTS") },
  { name: "MONGODB_MAX_POOL_SIZE", category: "Database (MongoDB Atlas)", provider: "You", where: ".env", how: "Override the per-process pool size.", required: "optional", agents: ["platform"], scope: "both", secret: false, validate: digits(1, 3, "MONGODB_MAX_POOL_SIZE") },
  { name: "MONGODB_CONNECTION_BUDGET", category: "Database (MongoDB Atlas)", provider: "You", where: ".env", how: "Total Atlas connection budget (advanced).", required: "optional", agents: ["platform"], scope: "production", secret: false, validate: digits(1, 5, "MONGODB_CONNECTION_BUDGET") },
  { name: "MONGODB_DIRECT", category: "Database (MongoDB Atlas)", provider: "You", where: ".env", how: "Advanced connection mode switch (1/0). Leave unset unless troubleshooting.", required: "optional", agents: ["platform"], scope: "both", secret: false, validate: oneOf(["0", "1"]) },
  { name: "MONGODB_SRV_ONLY", category: "Database (MongoDB Atlas)", provider: "You", where: ".env", how: "1 = use SRV only (advanced).", required: "optional", agents: ["platform"], scope: "both", secret: false, validate: oneOf(["0", "1"]) },
  { name: "MONGODB_SKIP_SRV_FALLBACK", category: "Database (MongoDB Atlas)", provider: "You", where: ".env", how: "1/0 to force or skip the SRV fallback (advanced).", required: "optional", agents: ["platform"], scope: "both", secret: false, validate: oneOf(["0", "1"]) },
  { name: "MONGODB_SERVER_API", category: "Database (MongoDB Atlas)", provider: "You", where: ".env", how: "0 disables the Stable API declaration (advanced).", required: "optional", agents: ["platform"], scope: "both", secret: false, validate: oneOf(["0", "1"]) },
  { name: "MONGODB_AUTO_SELECT_FAMILY", category: "Database (MongoDB Atlas)", provider: "You", where: ".env", how: "1/0 Node autoSelectFamily for IPv4/IPv6 (advanced).", required: "optional", agents: ["platform"], scope: "both", secret: false, validate: oneOf(["0", "1"]) },
  { name: "MONGODB_FORCE_IPV4", category: "Database (MongoDB Atlas)", provider: "You", where: ".env", how: "1 forces IPv4 lookups (advanced).", required: "optional", agents: ["platform"], scope: "both", secret: false, validate: oneOf(["0", "1"]) },
  { name: "MONGODB_REPLICA_SET", category: "Database (MongoDB Atlas)", provider: "MongoDB Atlas", where: "Cluster overview → replica set name", how: "Only for direct-shard connections (advanced).", required: "optional", agents: ["platform"], scope: "both", secret: false },
  { name: "AUTH_SECRET", category: "Site & sign-in", provider: "You", where: "Generate locally: openssl rand -base64 32", how: "Long random string. Also encrypts the stored WhatsApp token — changing it makes that token unreadable.", required: "required", agents: ["platform", "whatsapp"], scope: "both", secret: true, validate: minLen(24) },
  { name: "AUTH_URL", category: "Site & sign-in", provider: "You", where: ".env", how: "Full site URL, e.g. https://marinamuseinternational.com (no trailing characters).", required: "required", agents: ["platform"], scope: "both", secret: false, validate: url },
  { name: "NEXTAUTH_URL", category: "Site & sign-in", provider: "You", where: ".env", how: "Same as AUTH_URL.", required: "required", agents: ["platform"], scope: "both", secret: false, validate: url },
  { name: "NEXT_PUBLIC_SITE_URL", category: "Site & sign-in", provider: "You", where: ".env", how: "Public site URL used for absolute links, feeds and webhooks.", required: "optional", agents: ["platform", "growth", "voice"], scope: "production", secret: false, validate: url },
  { name: "GOOGLE_CLIENT_ID", category: "Site & sign-in", provider: "Google Cloud", where: "console.cloud.google.com → APIs & Services → Credentials → OAuth client", how: "Web OAuth client for “Sign in with Google”.", required: "optional", agents: ["platform"], scope: "both", secret: false },
  { name: "GOOGLE_CLIENT_SECRET", category: "Site & sign-in", provider: "Google Cloud", where: "Same OAuth client", how: "Client secret of that OAuth client.", required: "optional", agents: ["platform"], scope: "both", secret: true },
  { name: "ADMIN_EMAILS", category: "Site & sign-in", provider: "You", where: ".env", how: "Comma-separated admin emails.", required: "required", agents: ["platform"], scope: "both", secret: false, validate: emails },
  { name: "ADMIN_PASSWORD", category: "Site & sign-in", provider: "You", where: ".env", how: "Strong admin password. Never reuse the sample value.", required: "required", agents: ["platform"], scope: "both", secret: true, validate: (v) => (v === "Admin@marinamuse" ? "is still the sample value from .env.example" : v.length < 10 ? "should be at least 10 characters" : null) },
  { name: "NEXT_PUBLIC_SHOP_UTC_OFFSET", category: "Site & sign-in", provider: "You", where: ".env", how: "Shop time zone for sale dates, default +05:30 (India).", required: "optional", agents: ["platform", "growth"], scope: "both", secret: false, validate: (v) => (/^[+-]\d{2}:\d{2}$/.test(v) ? null : "should look like +05:30") },
  { name: "CONTACT_EMAILS", category: "Site & sign-in", provider: "You", where: ".env", how: "Shown on the site (currently read from lib/company).", required: "optional", agents: ["platform"], scope: "both", secret: false, validate: emails },

  // ── Email ──
  { name: "SMTP_HOST", category: "Email & owner alerts", provider: "Your mail host", where: "Mail host's SMTP settings", how: "e.g. mail.marinamuseinternational.com", required: "required-for-feature", agents: ["platform", "chat", "voice", "growth"], scope: "both", secret: false },
  { name: "SMTP_PORT", category: "Email & owner alerts", provider: "Your mail host", where: "SMTP settings", how: "587 (STARTTLS) or 465 (SSL).", required: "required-for-feature", agents: ["platform", "chat", "voice", "growth"], scope: "both", secret: false, validate: oneOf(["25", "465", "587", "2525"]) },
  { name: "SMTP_USER", category: "Email & owner alerts", provider: "Your mail host", where: "Mailbox login", how: "Mailbox address used to send.", required: "required-for-feature", agents: ["platform", "chat", "voice", "growth"], scope: "both", secret: false, validate: email },
  { name: "SMTP_PASS", category: "Email & owner alerts", provider: "Your mail host", where: "Mailbox password / app password", how: "Password for SMTP_USER.", required: "required-for-feature", agents: ["platform", "chat", "voice", "growth"], scope: "both", secret: true },
  { name: "SMTP_FROM", category: "Email & owner alerts", provider: "You", where: ".env", how: "Kept for compatibility; the sender is set in lib/password-otp-email.", required: "optional", agents: ["platform"], scope: "both", secret: false, validate: email },
  { name: "OWNER_ALERT_EMAILS", category: "Email & owner alerts", provider: "You", where: ".env", how: "Who receives lead/missed-call alerts and the daily report (defaults to ADMIN_EMAILS).", required: "optional", agents: ["chat", "voice", "whatsapp", "growth"], scope: "both", secret: false, validate: emails },
  { name: "AI_OWNER_ALERT_SCORE", category: "Email & owner alerts", provider: "You", where: ".env", how: "Lead score (1–100) that alerts the owner. Default 81.", required: "optional", agents: ["chat", "voice", "whatsapp"], scope: "both", secret: false, validate: (v) => (Number(v) >= 1 && Number(v) <= 100 ? null : "should be 1–100") },
  { name: "AI_OWNER_ALERT_VALUE_USD", category: "Email & owner alerts", provider: "You", where: ".env", how: "Estimated deal value (USD) that alerts the owner. Default 5000.", required: "optional", agents: ["chat", "voice", "whatsapp"], scope: "both", secret: false, validate: (v) => (Number(v) > 0 ? null : "should be a positive number") },
  { name: "RESEND_API_KEY", category: "Email & owner alerts", provider: "Resend", where: "resend.com → API Keys", how: "Optional: order confirmation emails via Resend.", required: "optional", agents: ["platform"], scope: "both", secret: true, validate: (v) => (v.startsWith("re_") ? null : "Resend keys start with re_") },
  { name: "ORDER_EMAIL_FROM", category: "Email & owner alerts", provider: "You", where: ".env", how: "Sender for order emails sent through Resend.", required: "optional", agents: ["platform"], scope: "both", secret: false },

  // ── Payments, shipping, uploads (existing store) ──
  { name: "PAYPAL_CLIENT_ID", category: "Payments & shipping (existing store)", provider: "PayPal", where: "developer.paypal.com → Apps & Credentials", how: "Client ID of the live (or sandbox) app.", required: "required-for-feature", agents: ["platform"], scope: "both", secret: false },
  { name: "PAYPAL_CLIENT_SECRET", category: "Payments & shipping (existing store)", provider: "PayPal", where: "Same app", how: "Secret of that app.", required: "required-for-feature", agents: ["platform"], scope: "both", secret: true },
  { name: "PAYPAL_MODE", category: "Payments & shipping (existing store)", provider: "You", where: ".env", how: "sandbox or live.", required: "required-for-feature", agents: ["platform"], scope: "both", secret: false, validate: oneOf(["sandbox", "live"]) },
  { name: "PAYPAL_WEBHOOK_ID", category: "Payments & shipping (existing store)", provider: "PayPal", where: "App → Webhooks → Add webhook (…/api/paypal/webhook)", how: "Webhook ID shown after creating it.", required: "required-for-feature", agents: ["platform"], scope: "production", secret: false },
  { name: "RAZORPAY_KEY_ID", category: "Payments & shipping (existing store)", provider: "Razorpay", where: "dashboard.razorpay.com → Settings → API Keys", how: "Only if Razorpay checkout is used.", required: "optional", agents: ["platform"], scope: "both", secret: false },
  { name: "RAZORPAY_KEY_SECRET", category: "Payments & shipping (existing store)", provider: "Razorpay", where: "Same page", how: "Key secret.", required: "optional", agents: ["platform"], scope: "both", secret: true },
  { name: "SHIPGLOBAL_EMAIL", category: "Payments & shipping (existing store)", provider: "ShipGlobal", where: "labels.shipglobal.in login", how: "Label-portal login email.", required: "required-for-feature", agents: ["platform"], scope: "both", secret: false, validate: email },
  { name: "SHIPGLOBAL_PASSWORD", category: "Payments & shipping (existing store)", provider: "ShipGlobal", where: "Label-portal password", how: "Password for SHIPGLOBAL_EMAIL.", required: "required-for-feature", agents: ["platform"], scope: "both", secret: true },
  { name: "SHIPGLOBAL_SERVICE", category: "Payments & shipping (existing store)", provider: "ShipGlobal", where: "Label portal service codes", how: "e.g. DHLECS.", required: "optional", agents: ["platform"], scope: "both", secret: false },
  { name: "SHIPGLOBAL_API_BASE", category: "Payments & shipping (existing store)", provider: "ShipGlobal", where: "ShipGlobal docs", how: "Default https://labels.shipglobal.in/api/v1.", required: "optional", agents: ["platform"], scope: "both", secret: false, validate: url },
  { name: "SHIPGLOBAL_HSN", category: "Payments & shipping (existing store)", provider: "You", where: ".env", how: "HSN code for customs (optional).", required: "optional", agents: ["platform"], scope: "both", secret: false },
  { name: "SHIPGLOBAL_CSB5", category: "Payments & shipping (existing store)", provider: "You", where: ".env", how: "1 for CSB-V shipments (optional).", required: "optional", agents: ["platform"], scope: "both", secret: false },
  { name: "SHIPGLOBAL_IOSS", category: "Payments & shipping (existing store)", provider: "You", where: ".env", how: "EU IOSS number (optional).", required: "optional", agents: ["platform"], scope: "both", secret: false },
  { name: "SHIPGLOBAL_SELLER_FIRST", category: "Payments & shipping (existing store)", provider: "You", where: ".env", how: "Seller first name on labels (optional).", required: "optional", agents: ["platform"], scope: "both", secret: false },
  { name: "SHIPGLOBAL_SELLER_LAST", category: "Payments & shipping (existing store)", provider: "You", where: ".env", how: "Seller last name on labels (optional).", required: "optional", agents: ["platform"], scope: "both", secret: false },
  { name: "KVM2_UPLOAD_URL", category: "Payments & shipping (existing store)", provider: "Your image host", where: "Your upload server", how: "Remote image host exposing POST /upload; empty = save under public/uploads.", required: "optional", agents: ["platform"], scope: "production", secret: false, validate: url },
  { name: "KVM2_UPLOAD_TOKEN", category: "Payments & shipping (existing store)", provider: "Your image host", where: "Your upload server", how: "Bearer token for that upload endpoint.", required: "optional", agents: ["platform"], scope: "production", secret: true },
  { name: "KVM2_UPLOAD_SKIP", category: "Payments & shipping (existing store)", provider: "You", where: ".env", how: "1 = never use the remote image host (local development).", required: "optional", agents: ["platform"], scope: "development", secret: false, validate: oneOf(["0", "1"]) },

  // ── Gemini & agent controls ──
  { name: "GEMINI_API_KEY", category: "Gemini (shared AI)", provider: "Google AI Studio", where: "aistudio.google.com/apikey (or Google Cloud → APIs → Generative Language API → Credentials)", how: "Create an API key. A Gemini app/Pro subscription is not an API key. Enable billing for production quotas.", required: "required", agents: ["chat", "voice", "growth", "whatsapp"], scope: "both", secret: true, validate: (v) => (/^AIza[0-9A-Za-z_-]{20,}$/.test(v) ? null : "Gemini API keys normally start with AIza") },
  { name: "GEMINI_MODEL", category: "Gemini (shared AI)", provider: "Google", where: "ai.google.dev/gemini-api/docs/models", how: "Model id; default gemini-2.5-flash.", required: "optional", agents: ["chat", "voice", "growth", "whatsapp"], scope: "both", secret: false, validate: (v) => (/^[a-z0-9.-]{3,60}$/i.test(v) ? null : "should be a model id like gemini-2.5-flash") },
  { name: "AI_AGENTS_DISABLED", category: "Gemini (shared AI)", provider: "You", where: ".env", how: "Comma-separated agents to switch off: chat, voice, growth, whatsapp. Empty = all on.", required: "optional", agents: ["chat", "voice", "growth", "whatsapp"], scope: "both", secret: false, validate: (v) => (v.split(",").every((a) => ["chat", "voice", "growth", "whatsapp", ""].includes(a.trim())) ? null : "allowed: chat, voice, growth, whatsapp") },

  // ── Jobs ──
  { name: "CRON_SECRET", category: "Scheduled jobs", provider: "You", where: "Generate locally: openssl rand -hex 32", how: "Send as Authorization: Bearer … from your scheduler to /api/ai/jobs (every 15 min) and /api/ai/report/daily (daily).", required: "required", agents: ["chat", "growth", "whatsapp"], scope: "production", secret: true, validate: minLen(24) },

  // ── Vapi ──
  { name: "VAPI_API_KEY", category: "Vapi (voice AI)", provider: "Vapi", where: "dashboard.vapi.ai → Organization → API Keys (private key)", how: "Use the PRIVATE key, not the public key.", required: "required-for-feature", agents: ["voice"], scope: "both", secret: true, validate: (v) => (/^[0-9a-f-]{30,}$/i.test(v) ? null : "Vapi private keys look like a UUID") },
  { name: "VAPI_ASSISTANT_ID", category: "Vapi (voice AI)", provider: "Vapi", where: "dashboard.vapi.ai → Assistants → your assistant → ID", how: "Create an assistant, then Admin → Marina AI → Health → “Sync Vapi assistant”.", required: "required-for-feature", agents: ["voice"], scope: "both", secret: false, validate: (v) => (/^[0-9a-f-]{30,}$/i.test(v) ? null : "should be the assistant UUID") },
  { name: "VAPI_WEBHOOK_SECRET", category: "Vapi (voice AI)", provider: "You", where: "Generate locally: openssl rand -hex 32", how: "Vapi sends it as x-vapi-secret to /api/ai/voice/webhook (the Sync button configures this).", required: "required-for-feature", agents: ["voice"], scope: "both", secret: true, validate: minLen(24) },
  { name: "VAPI_PHONE_NUMBER_ID", category: "Vapi (voice AI)", provider: "Vapi", where: "dashboard.vapi.ai → Phone Numbers → your BYO number → ID", how: "Create a byo-phone-number for your ExoPhone on the SIP trunk credential.", required: "required-for-feature", agents: ["voice"], scope: "both", secret: false, validate: (v) => (/^[0-9a-f-]{30,}$/i.test(v) ? null : "should be the phone-number UUID") },
  { name: "VAPI_SIP_CREDENTIAL_ID", category: "Vapi (voice AI)", provider: "Vapi", where: "API: POST /credential {provider: byo-sip-trunk} (or dashboard → Integrations → SIP trunk)", how: "BYO SIP trunk credential pointing at the Exotel gateway.", required: "required-for-feature", agents: ["voice"], scope: "both", secret: false, validate: (v) => (/^[0-9a-f-]{30,}$/i.test(v) ? null : "should be the credential UUID") },
  { name: "VAPI_OUTBOUND_ENABLED", category: "Vapi (voice AI)", provider: "You", where: ".env", how: "true only after testing — enables owner-approved, billable callbacks.", required: "optional", agents: ["voice"], scope: "production", secret: false, validate: bool },
  { name: "VAPI_MODEL", category: "Vapi (voice AI)", provider: "Vapi / Google", where: "docs.vapi.ai/providers/model/gemini", how: "Gemini model for the assistant (defaults to GEMINI_MODEL).", required: "optional", agents: ["voice"], scope: "both", secret: false },
  { name: "VAPI_API_BASE", category: "Vapi (voice AI)", provider: "Vapi", where: "docs.vapi.ai", how: "https://api.vapi.ai (default) or https://api.eu.vapi.ai for EU orgs.", required: "optional", agents: ["voice"], scope: "both", secret: false, validate: oneOf(["https://api.vapi.ai", "https://api.eu.vapi.ai"]) },
  { name: "VOICE_LANGUAGES", category: "Vapi (voice AI)", provider: "You", where: ".env", how: "Languages your voice/transcriber really supports, e.g. en,hi.", required: "optional", agents: ["voice"], scope: "both", secret: false, validate: (v) => (/^[a-z]{2}(,[a-z]{2})*$/.test(v.replace(/\s/g, "")) ? null : "comma-separated 2-letter codes") },
  { name: "VOICE_PROVIDER", category: "Vapi (voice AI)", provider: "You", where: ".env", how: "Only for a non-Vapi provider using the generic HMAC webhook.", required: "optional", agents: ["voice"], scope: "both", secret: false },
  { name: "VOICE_WEBHOOK_SECRET", category: "Vapi (voice AI)", provider: "You", where: "Generate locally", how: "HMAC secret for the generic voice webhook (non-Vapi).", required: "optional", agents: ["voice"], scope: "both", secret: true, validate: minLen(24) },

  // ── Exotel ──
  { name: "EXOTEL_API_KEY", category: "Exotel (telephony)", provider: "Exotel", where: "my.exotel.com → Settings → API Settings", how: "API key of your Exotel account.", required: "required-for-feature", agents: ["voice"], scope: "both", secret: false },
  { name: "EXOTEL_API_TOKEN", category: "Exotel (telephony)", provider: "Exotel", where: "my.exotel.com → API Settings", how: "API token for that key.", required: "required-for-feature", agents: ["voice"], scope: "both", secret: true },
  { name: "EXOTEL_ACCOUNT_SID", category: "Exotel (telephony)", provider: "Exotel", where: "my.exotel.com → API Settings (Account SID)", how: "Your account SID.", required: "required-for-feature", agents: ["voice"], scope: "both", secret: false },
  { name: "EXOTEL_SUBDOMAIN", category: "Exotel (telephony)", provider: "Exotel", where: "API Settings (cluster)", how: "api.in.exotel.com (Mumbai) or api.exotel.com (Singapore).", required: "optional", agents: ["voice"], scope: "both", secret: false, validate: oneOf(["api.in.exotel.com", "api.exotel.com", "api.us.exotel.com"]) },
  { name: "EXOTEL_PHONE_NUMBER", category: "Exotel (telephony)", provider: "Exotel", where: "my.exotel.com → ExoPhones", how: "The ExoPhone customers call, in E.164 (+91…). Requires KYC.", required: "required-for-feature", agents: ["voice"], scope: "both", secret: false, validate: phone },
  { name: "EXOTEL_TRUNK_SID", category: "Exotel (telephony)", provider: "Exotel", where: "vSIP trunk created by Exotel / via /v2/accounts/{sid}/trunks", how: "Trunk routing the ExoPhone to <VAPI_SIP_CREDENTIAL_ID>.sip.vapi.ai. vSIP must be enabled by Exotel.", required: "required-for-feature", agents: ["voice"], scope: "both", secret: false },
  { name: "EXOTEL_WEBHOOK_TOKEN", category: "Exotel (telephony)", provider: "You", where: "Generate locally: openssl rand -hex 24", how: "Put in the ExoPhone StatusCallback URL: /api/ai/voice/webhook?provider=exotel&token=…", required: "required-for-feature", agents: ["voice"], scope: "both", secret: true, validate: minLen(20) },

  // ── WhatsApp Cloud API & coexistence ──
  { name: "WHATSAPP_ACCESS_TOKEN", category: "WhatsApp Cloud API", provider: "Meta", where: "business.facebook.com → Business settings → System users → Generate token (app 1588276335845243)", how: "Permanent System User token with whatsapp_business_messaging + whatsapp_business_management. Optional if Embedded Signup stored a token.", required: "required-for-feature", agents: ["whatsapp"], scope: "both", secret: true, validate: (v) => (v.startsWith("EAA") ? null : "Meta tokens start with EAA") },
  { name: "WHATSAPP_PHONE_NUMBER_ID", category: "WhatsApp Cloud API", provider: "Meta", where: "developers.facebook.com → your app → WhatsApp → API Setup (Phone number ID)", how: "Numeric phone-number ID (not the phone number). Filled automatically after a coexistence signup.", required: "required-for-feature", agents: ["whatsapp"], scope: "both", secret: false, validate: digits(6, 20, "Phone number ID") },
  { name: "WHATSAPP_BUSINESS_ACCOUNT_ID", category: "WhatsApp Cloud API", provider: "Meta", where: "WhatsApp → API Setup (WhatsApp Business Account ID)", how: "Numeric WABA ID.", required: "required-for-feature", agents: ["whatsapp"], scope: "both", secret: false, validate: digits(6, 20, "WABA ID") },
  { name: "WHATSAPP_FOLLOWUP_TEMPLATE", category: "WhatsApp Cloud API", provider: "Meta", where: "business.facebook.com → WhatsApp Manager → Message templates", how: "Name of an APPROVED template for consented follow-ups outside the 24-hour window.", required: "optional", agents: ["whatsapp", "chat"], scope: "both", secret: false, validate: (v) => (/^[a-z0-9_]{1,512}$/.test(v) ? null : "template names are lowercase letters, digits and _") },
  { name: "WHATSAPP_TEMPLATE_LANGUAGE", category: "WhatsApp Cloud API", provider: "Meta", where: "Template details", how: "Language code of that template, e.g. en or en_US.", required: "optional", agents: ["whatsapp"], scope: "both", secret: false, validate: (v) => (/^[a-z]{2}(_[A-Z]{2})?$/.test(v) ? null : "e.g. en or en_US") },
  { name: "META_APP_ID", category: "WhatsApp Cloud API", provider: "Meta", where: "developers.facebook.com → your app → App settings → Basic", how: "1588276335845243 (supplied).", required: "required-for-feature", agents: ["whatsapp"], scope: "both", secret: false, validate: digits(10, 20, "App ID") },
  { name: "META_APP_SECRET", category: "WhatsApp Cloud API", provider: "Meta", where: "App settings → Basic → App secret (Show)", how: "Server only. Verifies webhook signatures and exchanges signup codes.", required: "required-for-feature", agents: ["whatsapp"], scope: "both", secret: true, validate: (v) => (/^[0-9a-f]{32}$/.test(v) ? null : "Meta app secrets are 32 hex characters") },
  { name: "META_WEBHOOK_APP_SECRET", category: "WhatsApp Cloud API", provider: "Meta", where: "Same as META_APP_SECRET", how: "Optional; defaults to META_APP_SECRET.", required: "optional", agents: ["whatsapp"], scope: "both", secret: true, validate: (v) => (/^[0-9a-f]{32}$/.test(v) ? null : "Meta app secrets are 32 hex characters") },
  { name: "META_WEBHOOK_VERIFY_TOKEN", category: "WhatsApp Cloud API", provider: "You", where: "Generate locally, then paste in App → WhatsApp → Configuration → Webhook", how: "Any random string; Meta echoes it during webhook verification.", required: "required-for-feature", agents: ["whatsapp"], scope: "both", secret: true, validate: minLen(16) },
  { name: "META_GRAPH_API_VERSION", category: "WhatsApp Cloud API", provider: "Meta", where: "developers.facebook.com/docs/graph-api/changelog", how: "Default v26.0.", required: "optional", agents: ["whatsapp"], scope: "both", secret: false, validate: (v) => (/^v\d+\.\d+$/.test(v) ? null : "should look like v26.0") },
  { name: "META_CONFIG_ID", category: "WhatsApp coexistence", provider: "Meta", where: "App → Facebook Login for Business → Configurations", how: "1760993601871515 (supplied): Embedded Signup v4 configuration.", required: "required-for-feature", agents: ["whatsapp"], scope: "both", secret: false, validate: digits(10, 20, "Configuration ID") },
  { name: "WHATSAPP_COEXISTENCE_ENABLED", category: "WhatsApp coexistence", provider: "You", where: ".env", how: "true to open Embedded Signup (test mode needs WHATSAPP_COEXISTENCE_TEST_NUMBER).", required: "optional", agents: ["whatsapp"], scope: "both", secret: false, validate: bool },
  { name: "WHATSAPP_COEXISTENCE_TEST_NUMBER", category: "WhatsApp coexistence", provider: "You", where: ".env", how: "The only number that may be onboarded before production approval (10 digits = India).", required: "optional", agents: ["whatsapp"], scope: "development", secret: false, validate: phone },
  { name: "WHATSAPP_PRODUCTION_ONBOARDING_APPROVED", category: "WhatsApp coexistence", provider: "You (written approval)", where: ".env", how: "true only after written approval to onboard the client's live number.", required: "optional", agents: ["whatsapp"], scope: "production", secret: false, validate: bool },
  { name: "WHATSAPP_OUTBOUND_ENABLED", category: "WhatsApp coexistence", provider: "You (written approval)", where: ".env", how: "true to let the AI send replies (inside the 24-hour window).", required: "optional", agents: ["whatsapp"], scope: "production", secret: false, validate: bool },

  // ── Google ──
  { name: "GOOGLE_SERVICE_ACCOUNT_JSON", category: "Google Analytics & Search Console", provider: "Google Cloud", where: "console.cloud.google.com → IAM & Admin → Service accounts → Keys → Add key (JSON)", how: "Paste the JSON (or base64 of it). Enable the Analytics Data API and Search Console API in that project.", required: "required-for-feature", agents: ["growth"], scope: "both", secret: true, validate: (v) => {
    try {
      const j = JSON.parse(v.trim().startsWith("{") ? v : Buffer.from(v, "base64").toString("utf8"));
      return j.client_email && j.private_key ? null : "JSON is missing client_email or private_key";
    } catch {
      return "is not valid JSON or base64 JSON";
    }
  } },
  { name: "GOOGLE_SERVICE_ACCOUNT_EMAIL", category: "Google Analytics & Search Console", provider: "Google Cloud", where: "Service account details", how: "Alternative to the JSON: the account's email.", required: "optional", agents: ["growth"], scope: "both", secret: false, validate: (v) => (/@.+\.iam\.gserviceaccount\.com$/.test(v) ? null : "should end with .iam.gserviceaccount.com") },
  { name: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", category: "Google Analytics & Search Console", provider: "Google Cloud", where: "From the JSON key file (private_key)", how: "Alternative to the JSON: the PEM key with \\n line breaks.", required: "optional", agents: ["growth"], scope: "both", secret: true, validate: (v) => (v.includes("PRIVATE KEY") ? null : "should be a PEM private key") },
  { name: "GA4_PROPERTY_ID", category: "Google Analytics & Search Console", provider: "Google Analytics", where: "analytics.google.com → Admin → Property details (Property ID)", how: "Numeric property ID (not the G- ID). Add the service-account email as Viewer in Property access management.", required: "required-for-feature", agents: ["growth"], scope: "both", secret: false, validate: (v) => digits(4, 15, "GA4 property ID")(v.replace(/^properties\//, "")) },
  { name: "GA4_MEASUREMENT_ID", category: "Google Analytics & Search Console", provider: "Google Analytics", where: "Admin → Data streams → Web stream (Measurement ID)", how: "G-XXXXXXX, for server-side purchase events.", required: "optional", agents: ["growth"], scope: "both", secret: false, validate: (v) => (/^G-[A-Z0-9]{4,15}$/.test(v) ? null : "should look like G-XXXXXXX") },
  { name: "GA4_API_SECRET", category: "Google Analytics & Search Console", provider: "Google Analytics", where: "Web stream → Measurement Protocol API secrets → Create", how: "Secret for server-side purchase events.", required: "optional", agents: ["growth"], scope: "both", secret: true },
  { name: "NEXT_PUBLIC_GA4_MEASUREMENT_ID", category: "Google Analytics & Search Console", provider: "Google Analytics", where: "Same as GA4_MEASUREMENT_ID", how: "Browser tag (loads after cookie consent). Rebuild after changing.", required: "optional", agents: ["growth"], scope: "production", secret: false, validate: (v) => (/^G-[A-Z0-9]{4,15}$/.test(v) ? null : "should look like G-XXXXXXX") },
  { name: "SEARCH_CONSOLE_SITE_URL", category: "Google Analytics & Search Console", provider: "Google Search Console", where: "search.google.com/search-console → property selector", how: "sc-domain:marinamuseinternational.com (domain property) or https://marinamuseinternational.com/ (URL prefix). Add the service-account email under Settings → Users and permissions.", required: "required-for-feature", agents: ["growth"], scope: "both", secret: false, validate: (v) => (/^sc-domain:[a-z0-9.-]+$/i.test(v) || /^https?:\/\/.+\/$/.test(v) ? null : "use sc-domain:example.com or https://example.com/ (with trailing slash)") },
];

export type EnvCheck = { name: string; category: string; set: boolean; valid: boolean; problem: string | null; required: EnvVar["required"]; agents: EnvAgent[]; secret: boolean; scope: EnvVar["scope"] };

/** Set/valid status for every registered variable. Never includes a value. */
export function envReport(source: Record<string, string | undefined> = process.env): EnvCheck[] {
  return ENV_REGISTRY.map((v) => {
    const raw = source[v.name]?.trim() || "";
    let problem: string | null = null;
    if (raw && v.validate) {
      try {
        problem = v.validate(raw);
      } catch {
        problem = "could not be checked";
      }
    }
    return { name: v.name, category: v.category, set: Boolean(raw), valid: Boolean(raw) && !problem, problem: problem ? `${v.name} ${problem}` : null, required: v.required, agents: v.agents, secret: v.secret, scope: v.scope };
  });
}

export function registryVar(name: string) {
  return ENV_REGISTRY.find((v) => v.name === name);
}
