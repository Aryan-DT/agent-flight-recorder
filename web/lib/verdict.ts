// Safe to import from client components: no API keys in this file.

export const CATEGORIES = [
  "ok",
  "hallucination",
  "bad_tool_data",
  "safety_violation",
  "run_failed",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Verdict = {
  passed: boolean;
  category: Category;
  issues: string[];
  explanation: string;
};

// Check the verdict's shape at runtime instead of trusting it.
// In JavaScript, Boolean("false") is true, so a verdict whose `passed` is the
// string "false" would silently read as a pass (traceroot issue #2782).
// Anything that is not exactly a boolean, a known category, etc. is rejected.
export function parseVerdict(raw: unknown): Verdict | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null) return null;

  const v = value as Record<string, unknown>;
  if (typeof v.passed !== "boolean") return null;
  if (!CATEGORIES.includes(v.category as Category)) return null;
  if (!Array.isArray(v.issues) || !v.issues.every((i) => typeof i === "string")) return null;
  if (typeof v.explanation !== "string") return null;

  return {
    passed: v.passed,
    category: v.category as Category,
    issues: v.issues,
    explanation: v.explanation,
  };
}

// Compares what was injected with what the judge found. An injected fault does
// not guarantee a bad run: the agent may handle it (refusing on low battery) or
// never call the broken tool. So disagreements are flagged, not scored.
export function judgeNote(faults: string[], verdict: Verdict): string | null {
  if (faults.length === 0 && !verdict.passed) {
    return "No faults were injected, but the judge failed this run: a real agent mistake, or a false alarm.";
  }
  if (faults.length > 0 && verdict.passed) {
    return "A fault was injected, but the judge passed this run. Check the spans: the agent may have handled the fault, or never called the broken tool.";
  }
  return null;
}
