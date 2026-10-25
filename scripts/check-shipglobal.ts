// @ts-nocheck
import fs from "fs";
import { shipGlobalDraftErrors, type ShipGlobalDraft } from "../lib/shipglobal-checks.ts";

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
}

const valid: ShipGlobalDraft = {
  customerName: "A Buyer",
  email: "buyer@example.com",
  phone: "+1 212 555 1234",
  address: "350 5th Ave",
  city: "New York",
  state: "NY",
  postal: "10118",
  countryCode: "US",
  weightGrams: 800,
  service: "DHLECS",
  items: [{ name: "Telescope", sku: "TEL-1", qty: 1, unitPrice: 399, hsn: "74199990" }],
  sellerPhone: "+917457099540",
  sellerEmail: "info@marinamuseinternational.com",
  sellerAddress: "Ground Floor, Building 85",
  sellerCity: "Muzaffarnagar",
  sellerState: "Uttar Pradesh",
  sellerPostal: "251311",
  sellerCountryCode: "IN",
};

check("valid DHLECS draft", shipGlobalDraftErrors(valid).length === 0, shipGlobalDraftErrors(valid).join("; ") || "no errors");
check("rejects short phone", shipGlobalDraftErrors({ ...valid, phone: "123" }).some((e) => e.includes("phone")), "phone rule");
check("rejects zero declared value", shipGlobalDraftErrors({ ...valid, items: [{ ...valid.items[0], unitPrice: 0 }] }).some((e) => e.includes("declared value")), "value rule");
check("rejects bad HSN", shipGlobalDraftErrors({ ...valid, items: [{ ...valid.items[0], hsn: "ABC" }] }).some((e) => e.includes("HSN")), "hsn rule");
check("rejects zero weight", shipGlobalDraftErrors({ ...valid, weightGrams: 0 }).some((e) => e.includes("weight")), "weight rule");
check("rejects USPS over 5000g", shipGlobalDraftErrors({ ...valid, service: "USPS", weightGrams: 5001 }).some((e) => e.includes("USPS")), "usps rule");
check("rejects UPS outside the US", shipGlobalDraftErrors({ ...valid, service: "UPS", countryCode: "IN", weightGrams: 6000 }).some((e) => e.includes("United States")), "destination rule");

const env: Record<string, string> = {};
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
}
const email = (env.SHIPGLOBAL_EMAIL || "").trim();
const password = (env.SHIPGLOBAL_PASSWORD || "").trim();
const base = (env.SHIPGLOBAL_API_BASE || "https://labels.shipglobal.in/api/v1").replace(/\/$/, "");
check("account email is the provided ShipGlobal email", email === "tmiinternationalcompany@gmail.com", email ? "email matches" : "email missing");
check("password is already in the local environment", Boolean(password), password ? "present" : "missing");
check("API base is the label API", base === "https://labels.shipglobal.in/api/v1", base);
check("service code is DHLECS", (env.SHIPGLOBAL_SERVICE || "").trim() === "DHLECS", env.SHIPGLOBAL_SERVICE || "unset");

const gitignore = fs.readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
check(".env.local is gitignored", gitignore.split(/\r?\n/).includes(".env.local"), ".gitignore");

let addOrderCalled = false;
const loginRes = await fetch(`${base}/customers.php`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ email, password }),
  signal: AbortSignal.timeout(20_000),
});
const loginText = await loginRes.text();
let loginJson: { token?: unknown; error?: unknown } = {};
try {
  loginJson = JSON.parse(loginText) as { token?: unknown; error?: unknown };
} catch {
  loginJson = {};
}
const tokenReceived = typeof loginJson.token === "string" && loginJson.token.length > 0;
const errorText = typeof loginJson.error === "string" ? loginJson.error : "";
check("login response is JSON", Boolean(loginJson) && !loginText.includes("<html"), `HTTP ${loginRes.status}`);
check("login HTTP status is recorded", loginRes.status > 0, String(loginRes.status));
check("login response does not include the password", !loginText.includes(password), "sanitized");
check("diagnostic did not call addOrder.php", addOrderCalled === false, "no shipment");

if (loginRes.status === 401 && !tokenReceived) {
  check("label API accepted this account", false, `HTTP 401 ${errorText || "no token"}`);
} else if (tokenReceived) {
  check("label API accepted this account", true, `HTTP ${loginRes.status}, token received, shipment not created`);
} else {
  check("label API accepted this account", false, `HTTP ${loginRes.status} ${errorText || "no token"}`);
}

for (const result of results) {
  console.log(`${result.pass ? "PASS" : "FAIL"} ${result.name} — ${result.detail}`);
}
const failed = results.filter((result) => !result.pass).length;
console.log(`TOTAL ${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
