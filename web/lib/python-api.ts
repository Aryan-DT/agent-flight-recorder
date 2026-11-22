// Server-only helpers for calling the Python API from route handlers.

// Sends the shared secret (so the Python API knows the call came from this
// server) and the visitor's IP (so it can rate-limit per visitor). Returns
// null if the Python API could not be reached at all.
export async function callPythonApi(
  path: string,
  body: unknown,
  request: Request
): Promise<Response | null> {
  const visitorIp =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  try {
    return await fetch(`${process.env.PYTHON_API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Secret": process.env.API_SECRET ?? "",
        "X-Visitor-Ip": visitorIp,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

// Turns a failed Python API response into a message for the browser.
// Rate-limit messages are passed through so visitors know when to retry.
export async function pythonApiError(
  res: Response | null,
  fallback: string
): Promise<Response> {
  if (res?.status === 429) {
    const data = await res.json().catch(() => null);
    return Response.json(
      { error: data?.detail ?? "Too many requests. Try again later." },
      { status: 429 }
    );
  }
  if (res === null) {
    return Response.json({ error: "Couldn't reach the drone server. Try again." }, { status: 502 });
  }
  return Response.json({ error: fallback }, { status: 502 });
}
