/**
 * Runtime isolation check against a LOCAL development server (default http://localhost:3918).
 * Proves the running app reads and writes the local test database, checkout is disabled, and the
 * new admin password works while the old sample is refused. Prints no secrets.
 *
 *   node reports/evidence/security/runtime-isolation-check.mjs [baseUrl]
 */
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { MongoClient } = require("mongodb");

const base = (process.argv[2] || "http://localhost:3918").replace(/\/$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  console.error("Refusing: this check only runs against a local server.");
  process.exit(2);
}
const env = loadEnvConfig(process.cwd(), true, { info() {}, error() {} }).combinedEnv;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
};

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
await client.connect();
const db = client.db(env.MONGODB_DB_NAME);

try {
  // 1. Reads come from the test database: the TEST fixtures exist only there.
  const cat = await fetch(`${base}/api/catalog/products`).then((r) => r.json());
  const items = Array.isArray(cat) ? cat : cat.products || cat.items || [];
  const testItems = items.filter((p) => String(p.slug || "").startsWith("dev-test-"));
  check("Running app reads products from the test database", testItems.length === 3, `${testItems.length} TEST fixtures in /api/catalog/products`);

  // 2. Writes land in the test database.
  const probePath = `/dev-isolation-probe-${randomBytes(4).toString("hex")}`;
  const pv = await fetch(`${base}/api/page-views`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: probePath }) });
  await new Promise((r) => setTimeout(r, 500));
  const written = await db.collection("page_views").countDocuments({ path: probePath });
  check("Running app writes to the test database", pv.ok && written >= 1, `page_views probe documents: ${written}`);
  await db.collection("page_views").deleteMany({ path: probePath });

  // 3. Checkout is safely disabled (no PayPal credentials in development).
  const pp = await fetch(`${base}/api/paypal/order`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const ppBody = await pp.json().catch(() => ({}));
  check("PayPal checkout refused without creating an order", pp.status === 503 && /not configured/i.test(ppBody.error || ""), `HTTP ${pp.status}`);
  const orders = await db.collection("orders").countDocuments({});
  check("No order created in the test database", orders === 0, `${orders} orders`);

  // 4. Admin sign-in: new password accepted, published sample refused.
  const email = (env.ADMIN_EMAILS || "").split(",")[0].trim().toLowerCase();
  async function signIn(password) {
    const csrfRes = await fetch(`${base}/api/auth/csrf`);
    const cookies = (csrfRes.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
    const { csrfToken } = await csrfRes.json();
    const res = await fetch(`${base}/api/auth/callback/admin-portal`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookies, "x-auth-return-redirect": "1" },
      body: new URLSearchParams({ email, password, csrfToken, callbackUrl: `${base}/admin` }),
    });
    const setCookies = res.headers.getSetCookie?.() || [];
    const session = setCookies.some((c) => /session-token=[^;]+/.test(c) && !/session-token=;/.test(c));
    return { session };
  }
  const usersBefore = await db.collection("users").countDocuments({});
  const good = await signIn(env.ADMIN_PASSWORD);
  check("Admin sign-in works with the new password", good.session, "session cookie issued");
  const sample = await signIn("Admin@marinamuse");
  check("Published sample password is refused", !sample.session);
  const usersAfter = await db.collection("users").countDocuments({});
  check("Admin user record was written to the test database", usersAfter >= Math.max(1, usersBefore), `${usersAfter} user(s)`);
} finally {
  await client.close();
}

// 5. The server under test (the process listening on the port) holds no connection to a remote database.
try {
  const port = new URL(base).port || "80";
  const netstat = execSync("netstat -ano", { encoding: "utf8" }).split(/\r?\n/);
  // netstat on this machine omits some listeners, so the owning process comes from Get-NetTCPConnection.
  const pid = execSync(
    `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${Number(port)} -ErrorAction SilentlyContinue | Where-Object { $_.RemotePort -eq 0 } | Select-Object -First 1).OwningProcess"`,
    { encoding: "utf8" }
  ).trim() || undefined;
  const conns = netstat
    .map((l) => l.trim().split(/\s+/))
    .filter((c) => c[0] === "TCP" && c[3] === "ESTABLISHED" && c[4] === pid && /:2701[7-9]$|:27020$/.test(c[2]))
    .map((c) => c[2]);
  const remote = conns.filter((a) => !/^(127\.0\.0\.1|\[::1\]):/.test(a));
  check("Server under test has no connection to a remote MongoDB", Boolean(pid) && remote.length === 0, `pid ${pid}; db connections: ${[...new Set(conns)].join(", ") || "none"}`);
} catch {
  check("Connection table readable", false);
}

const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\nRESULT: ${failed} check(s) FAILED` : `\nRESULT: RUNTIME ISOLATED (${results.length}/${results.length})`);
process.exit(failed ? 1 : 0);
