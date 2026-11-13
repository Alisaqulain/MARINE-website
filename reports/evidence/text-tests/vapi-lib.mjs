import crypto from "crypto";
// 10 Nov 2026: no longer reads .env.local (it still holds exposed credentials). The harness now runs in the
// isolated test environment: integration values come only from .env.isolated-test.local (fresh, client-
// supplied), secrets the app needs are generated per session, and everything else is blank.
import { isolatedEnv } from "../../../scripts/isolated-env.mjs";
export const ENV = isolatedEnv().env;
const SECRETS = [ENV.VAPI_API_KEY, ENV.VAPI_WEBHOOK_SECRET, ENV.GEMINI_API_KEY, ENV.GEMINI_TEST_API_KEY, process.env.GEMINI_TEST_API_KEY].filter(s=>s && s.length>6);
export function redact(x){ let s = typeof x==="string"?x:JSON.stringify(x,null,2); for(const k of SECRETS) s=s.split(k).join("[REDACTED]"); s=s.replace(/("(?:x-vapi-secret|secret|token|apiKey|authorization|password)"\s*:\s*")[^"]+"/gi,'$1[REDACTED]"'); return s; }
export async function vapi(path, opts={}) { const r = await fetch("https://api.vapi.ai"+path,{...opts,headers:{Authorization:`Bearer ${ENV.VAPI_API_KEY}`,"Content-Type":"application/json",...(opts.headers||{})}}); const t=await r.text(); let j; try{j=JSON.parse(t)}catch{j=t} return {status:r.status, data:j}; }
export function fp(o){ return crypto.createHash("sha256").update(JSON.stringify(o)).digest("hex"); }
