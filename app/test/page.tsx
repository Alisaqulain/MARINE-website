import { pingDatabase } from "@/lib/mongodb";
import { pingPayPal } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export default async function TestDbPage() {
  const [result, paypal] = await Promise.all([pingDatabase(), pingPayPal()]);

  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <h1 className="font-serif text-3xl text-navy-900">Database connection test</h1>
      <p className="mt-4 text-navy-600">
        This route checks whether the app can reach MongoDB Atlas using{" "}
        <code className="text-sm">MONGODB_URI</code>
        {process.env.MONGODB_URI_STANDARD ? " or MONGODB_URI_STANDARD" : ""}.
      </p>
      {result.nodeVersion ? (
        <p className="mt-2 text-xs text-navy-500">Runtime: {result.nodeVersion}</p>
      ) : null}
      {result.connectionMode ? (
        <p className="mt-1 text-xs text-navy-500">Connection mode: {result.connectionMode}</p>
      ) : null}
      {result.runtimeEnv ? (
        <p className="mt-1 text-xs text-navy-500">NODE_ENV: {result.runtimeEnv}</p>
      ) : null}
      {result.dbUser ? (
        <p className="mt-1 text-xs text-navy-500">
          URI user: <code className="text-[11px]">{result.dbUser}</code>
          {result.clusterHost ? (
            <>
              {" "}
              · cluster <code className="text-[11px]">{result.clusterHost}</code>
            </>
          ) : null}
          {result.passwordLength != null ? (
            <> · password length in URI: {result.passwordLength}</>
          ) : null}
        </p>
      ) : null}
      {result.platform ? (
        <p className="mt-1 text-xs text-navy-500">
          Server: {result.platform}
          {result.usesStandardUri ? " · MONGODB_URI_STANDARD is set (overrides MONGODB_URI)" : null}
        </p>
      ) : null}
      {result.connectorVersion ? (
        <p className="mt-1 text-xs font-medium text-navy-700">
          Connector: <code className="text-[11px]">{result.connectorVersion}</code>
          {result.mongodbDirectEnv ? (
            <> · MONGODB_DIRECT={result.mongodbDirectEnv}</>
          ) : null}
          {result.maxPoolSize != null ? (
            <> · maxPoolSize={result.maxPoolSize}</>
          ) : null}
        </p>
      ) : (
        <p className="mt-1 text-xs font-semibold text-amber-800">
          Connector: (old build — deploy latest code from your PC to the KVM)
        </p>
      )}
      <div
        className={`mt-8 rounded-2xl border px-6 py-5 ${
          result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
        }`}
      >
        <p className="text-sm font-semibold uppercase tracking-wider">{result.ok ? "Connected" : "Not connected"}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{result.message}</p>
      </div>
      {!result.ok && result.platform === "win32" ? (
        <div className="mt-6 rounded-2xl border border-[#e6dfd2] bg-white p-5 text-sm text-navy-800">
          <p className="font-semibold text-navy-900">Atlas checklist (local Windows)</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>
              <a
                href="https://cloud.mongodb.com/v2#/security/network/accessList"
                className="text-[#8C6E28] underline"
                target="_blank"
                rel="noreferrer"
              >
                Network Access
              </a>{" "}
              → Add IP Address → <strong>Add Current IP Address</strong> (or 0.0.0.0/0 temporarily).
            </li>
            <li>Database → cluster must be <strong>Running</strong>, not Paused.</li>
            <li>
              In terminal: <code className="text-xs">npm run check:mongo</code> — must show <strong>OK</strong>.
            </li>
            <li>Restart <code className="text-xs">npm run dev</code> and reload this page.</li>
            <li>
              If Overview shows <strong>Connections at 100%</strong>: close extra terminals running the app, wait 2–3
              minutes, or pause/resume Cluster0 in Atlas to clear stale connections.
            </li>
          </ol>
        </div>
      ) : null}
      {!result.ok && result.hints?.length ? (
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-navy-700">
          {result.hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}
      <h2 className="mt-14 font-serif text-3xl text-navy-900">PayPal connection test</h2>
      <p className="mt-4 text-navy-600">
        This checks whether PayPal accepts <code className="text-sm">PAYPAL_CLIENT_ID</code> and{" "}
        <code className="text-sm">PAYPAL_CLIENT_SECRET</code>. The keys themselves are not shown.
      </p>
      <p className="mt-2 text-xs text-navy-500">
        Mode: {paypal.mode} · Webhook ID: {paypal.webhookSet ? "set" : "missing"}
      </p>
      <div
        className={`mt-8 rounded-2xl border px-6 py-5 ${
          paypal.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
        }`}
      >
        <p className="text-sm font-semibold uppercase tracking-wider">{paypal.ok ? "Connected" : "Not connected"}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{paypal.message}</p>
      </div>
    </div>
  );
}
