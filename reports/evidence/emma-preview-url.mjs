// Prints a fresh, official Emma preview link from Vapi's voice library and checks it returns audio.
// Read-only: GET /voice-library/vapi plus a download of the clip. No call, no session, no cost.
// Usage: node reports/evidence/emma-preview-url.mjs   (reads VAPI_API_KEY from .env.local; the key is never printed)
// The link is an S3 signed URL valid for 1 hour; run this again for a new one.
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]));
const res = await fetch("https://api.vapi.ai/voice-library/vapi", { headers: { Authorization: `Bearer ${env.VAPI_API_KEY}` } });
if (!res.ok) throw new Error(`Voice library: HTTP ${res.status}`);
const emma = (await res.json()).find((v) => v.providerId === "Emma" && !v.isDeleted);
if (!emma?.previewUrl) throw new Error("Emma has no preview URL in the voice library.");
const u = new URL(emma.previewUrl);
const signedAt = u.searchParams.get("X-Amz-Date");
const ttl = Number(u.searchParams.get("X-Amz-Expires") || 0);
const at = signedAt ? new Date(signedAt.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z")) : null;
const audio = await fetch(emma.previewUrl);
const buf = Buffer.from(await audio.arrayBuffer());
const wav = buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE";
console.log(`Voice: ${emma.name} (${emma.gender}, ${emma.accent}) providerId=${emma.providerId}`);
console.log(`Check: HTTP ${audio.status}, ${audio.headers.get("content-type")}, ${buf.length} bytes, valid WAV: ${wav}, about ${((buf.length - 44) / 88200).toFixed(1)} s`);
if (at) console.log(`Signed: ${at.toISOString()}  Expires: ${new Date(at.getTime() + ttl * 1000).toISOString()} (${ttl / 60} min)`);
console.log(`URL: ${emma.previewUrl}`);
