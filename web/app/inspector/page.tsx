import Link from "next/link";
import { listRuns, parseFaults, parseQuestion } from "@/lib/traceroot";

function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default async function InspectorPage() {
  const runs = await listRuns();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-8">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Run inspector</h1>
          <p className="text-sm text-neutral-500">
            Recent agent runs, read back from TraceRoot.
          </p>
        </div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Chat
        </Link>
      </header>

      {runs.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No runs yet. Ask the drone something first.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {runs.map((run) => {
            const faults = parseFaults(run.metadata_map);
            return (
              <li key={run.trace_id}>
                <Link
                  href={`/inspector/${run.trace_id}`}
                  className="flex flex-col gap-1 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-medium">{parseQuestion(run.input)}</span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {timeAgo(run.trace_start_time)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                    {faults.length === 0 ? (
                      <span className="text-green-600">baseline</span>
                    ) : (
                      faults.map((f) => (
                        <span
                          key={f}
                          className="rounded bg-amber-100 px-1.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        >
                          ⚠ {f}
                        </span>
                      ))
                    )}
                    <span>{(run.duration_ms / 1000).toFixed(1)}s</span>
                    <span>{run.span_count} spans</span>
                    <span>
                      {run.total_input_tokens + run.total_output_tokens} tokens
                    </span>
                    <span>${run.total_cost.toFixed(4)}</span>
                    <span className={run.error_count > 0 ? "text-red-600" : ""}>
                      {run.error_count} errors
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
