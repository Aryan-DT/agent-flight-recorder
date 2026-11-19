export async function POST(request: Request) {
    let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const message = body?.message;

  if (typeof message !== "string" || message.trim() === "") {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }
  if (message.length > 500) {
    return Response.json({ error: "Message is too long." }, { status: 400 });
  }

  const res = await fetch(`${process.env.PYTHON_API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    return Response.json(
      { error: "The drone agent failed. Try again." },
      { status: 502 }
    );
  }

  const data = await res.json();
  return Response.json({ reply: data.reply });
}
