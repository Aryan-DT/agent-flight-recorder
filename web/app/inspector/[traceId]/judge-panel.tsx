"use client";

import { useState } from "react";
import { judgeNote, parseVerdict, type Verdict } from "@/lib/verdict";

type Props = {
  traceId: string;
  faults: string[];
  initialVerdict: Verdict | null;
};

export default function JudgePanel({ traceId, faults, initialVerdict }: Props) {
  const [verdict, setVerdict] = useState<Verdict | null>(initialVerdict);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runJudge() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace_id: traceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The judge failed.");
      const parsed = parseVerdict(data);
      if (!parsed) throw new Error("The judge returned an invalid verdict.");
      setVerdict(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The judge failed.");
    } finally {
      setLoading(false);
    }
  }

  const note = verdict ? judgeNote(faults, verdict) : null;

  return (
    <section className="mb-6 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">LLM judge</h2>
          <p className="text-xs text-neutral-500">
            Grades the run from its tool outputs and reply. It never sees which faults were injected.
          </p>
        </div>
        <button
          onClick={runJudge}
          disabled={loading}
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Judging…" : verdict ? "Re-run judge" : "Run judge"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {verdict && (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                verdict.passed
                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
              }`}
            >
              {verdict.passed ? "✓ passed" : `✗ ${verdict.category}`}
            </span>
            <span className="text-xs text-neutral-500">
              Injected: {faults.length === 0 ? "nothing (baseline)" : faults.join(", ")}
            </span>
          </div>
          <p>{verdict.explanation}</p>
          {verdict.issues.length > 0 && (
            <ul className="list-disc pl-5 text-neutral-600 dark:text-neutral-400">
              {verdict.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          {note && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              {note}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
