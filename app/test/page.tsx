import { pingDatabase } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export default async function TestDbPage() {
  const result = await pingDatabase();

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
        </p>
      ) : null}
      <div
        className={`mt-8 rounded-2xl border px-6 py-5 ${
          result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
        }`}
      >
        <p className="text-sm font-semibold uppercase tracking-wider">{result.ok ? "Connected" : "Not connected"}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{result.message}</p>
      </div>
      {!result.ok && result.hints?.length ? (
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-navy-700">
          {result.hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
