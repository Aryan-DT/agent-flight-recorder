const BASE_URL = "https://app.traceroot.ai/api/v1/public";

export type TraceSummary = {
  trace_id: string;
  name: string;
  trace_start_time: string;
  span_count: number;
  duration_ms: number;
  error_count: number;
  input: string | null;
  output: string | null;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  metadata_map: Record<string, string>;
  trace_url: string;
};

export type Span = {
  span_id: string;
  parent_span_id: string | null;
  name: string;
  span_kind: string;
  span_start_time: string;
  span_end_time: string;
  status: string;
  status_message: string | null;
  model_name: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | null;
};

export type TraceDetail = {
  trace_id: string;
  name: string;
  trace_start_time: string;
  input: string | null;
  output: string | null;
  spans: Span[];
  trace_url: string;
};

async function traceroot<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${process.env.TRACEROOT_API_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`TraceRoot API error: ${res.status}`);
  }
  return res.json();
}

export async function listRuns(limit = 25): Promise<TraceSummary[]> {
  const data = await traceroot<{ data: TraceSummary[] }>(
    `/traces?name=drone_run&limit=${limit}`
  );
  return data.data;
}

export async function getRun(traceId: string): Promise<TraceDetail> {
  return traceroot<TraceDetail>(`/traces/${encodeURIComponent(traceId)}`);
}

export function parseFaults(metadata: Record<string, string> | undefined): string[] {
  try {
    const faults = JSON.parse(metadata?.faults ?? "[]");
    return Array.isArray(faults) ? faults : [];
  } catch {
    return [];
  }
}

export function parseQuestion(input: string | null): string {
  try {
    return JSON.parse(input ?? "{}").message ?? "(no question)";
  } catch {
    return input ?? "(no question)";
  }
}
