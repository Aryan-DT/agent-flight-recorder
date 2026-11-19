import Link from "next/link";
import { getRun, parseDetailFaults, parseQuestion, type Span } from "@/lib/traceroot";

const KIND_COLORS: Record<string, string> = {
  AGENT: "bg-purple-500",
  LLM: "bg-blue-500",
  TOOL: "bg-green-500",
};

function time(iso: string): number {
  return new Date(iso).getTime();
}

function depthOf(span: Span, byId: Map<string, Span>): number {
  let depth = 0;
  let parent = span.parent_span_id ? byId.get(span.parent_span_id) : undefined;
  while (parent) {
    depth++;
    parent = parent.parent_span_id ? byId.get(parent.parent_span_id) : undefined;
  }
  return depth;
}

export default async function RunPage({ params }: PageProps<"/inspector/[traceId]">) {
  const { traceId } = await params;
  const run = await getRun(traceId);

  const spans = [...run.spans].sort((a, b) =>
    a.span_start_time.localeCompare(b.span_start_time)
  );
  const byId = new Map(spans.map((s) => [s.span_id, s]));
  const start = Math.min(...spans.map((s) => time(s.span_start_time)));
  const end = Math.max(...spans.map((s) => time(s.span_end_time)));
  const total = Math.max(end - start, 1);
  const faults = parseDetailFaults(run.metadata);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-8">
      <Link href="/inspector" className="text-sm text-blue-600 hover:underline">
        ← All runs
      </Link>

      <header className="mt-4 mb-6 flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{parseQuestion(run.input)}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
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
          {spans.length > 0 && (
            <span className="text-neutral-500">{(total / 1000).toFixed(1)}s total</span>
          )}
          <a href={run.trace_url} target="_blank" className="text-blue-600 hover:underline">
            Open in TraceRoot ↗
          </a>
        </div>
        <p className="whitespace-pre-wrap rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-900">
          {run.output ?? "(no reply: the run failed)"}
        </p>
      </header>

      {spans.length === 0 ? (
        <p className="text-sm text-neutral-500">This trace has no spans.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          {spans.map((s) => {
            const depth = depthOf(s, byId);
            const duration = time(s.span_end_time) - time(s.span_start_time);
            const left = ((time(s.span_start_time) - start) / total) * 100;
            const width = Math.max((duration / total) * 100, 0.5);
            const color =
              s.status === "ERROR" ? "bg-red-500" : KIND_COLORS[s.span_kind] ?? "bg-neutral-400";

            return (
              <li key={s.span_id} className="py-2">
                <div className="flex items-center gap-3 text-sm">
                  <div
                    className="w-40 shrink-0 truncate sm:w-72"
                    style={{ paddingLeft: depth * 12 }}
                    title={s.name}
                  >
                    <span className="mr-1 text-xs text-neutral-500">{s.span_kind}</span>
                    {s.name}
                  </div>
                  <div className="relative h-4 flex-1 rounded bg-neutral-100 dark:bg-neutral-900">
                    <div
                      className={`absolute h-4 rounded ${color}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  </div>
                  <div className="w-16 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                    {duration} ms
                  </div>
                </div>

                <div className="mt-1 flex flex-col gap-1 text-xs" style={{ paddingLeft: depth * 12 }}>
                  {s.status === "ERROR" && s.status_message && (
                    <p className="line-clamp-3 break-words text-red-600">{s.status_message}</p>
                  )}
                  {s.span_kind === "LLM" && s.input_tokens != null && (
                    <p className="text-neutral-500">
                      {s.input_tokens} in / {s.output_tokens} out tokens
                    </p>
                  )}
                  {s.span_kind === "TOOL" && s.output && (
                    <p className="break-all font-mono text-neutral-500">
                      {s.input} → {s.output}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
