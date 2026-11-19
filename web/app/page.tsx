"use client";

import { useState } from "react";

type Message = { role: "user" | "agent"; text: string };

const EXAMPLES = [
  "Is the drone ready to scan?",
  "Is anyone in the kitchen behind the wall?",
  "How many people are behind the wall, and how far away?",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setMessages((prev) => [...prev, { role: "agent", text: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Agent Flight Recorder</h1>
        <p className="text-sm text-neutral-500">
          Chat with a simulated WiFi-sensing drone. Every run is traced.
        </p>
      </header>

      <section className="flex flex-1 flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-neutral-500">Try one of these:</p>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                onClick={() => send(example)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                {example}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "self-end bg-blue-600 text-white"
                : "self-start bg-neutral-100 dark:bg-neutral-900"
            }`}
          >
            {m.text}
          </div>
        ))}

        {loading && <p className="text-sm text-neutral-500">Drone is scanning…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="Ask the drone something…"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  );
}
