import { callPythonApi, pythonApiError } from "@/lib/python-api";
import { parseVerdict } from "@/lib/verdict";

const TRACE_ID = /^[0-9a-f]{32}$/;

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const traceId = body?.trace_id;
  if (typeof traceId !== "string" || !TRACE_ID.test(traceId)) {
    return Response.json({ error: "Invalid trace id." }, { status: 400 });
  }

  const res = await callPythonApi("/judge", { trace_id: traceId }, request);
  if (!res?.ok) {
    return pythonApiError(res, "The judge failed. Try again.");
  }

  const verdict = parseVerdict(await res.json());
  if (!verdict) {
    return Response.json({ error: "The judge returned an invalid verdict." }, { status: 502 });
  }
  return Response.json(verdict);
}
