import { useState } from "react";
import { api } from "@/lib/api";

export function Newsletter({ headline, blurb }: { headline: string; blurb: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "busy" | "done" | "error"; message?: string }>({
    kind: "idle",
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState({ kind: "busy" });
    try {
      const result = await api.post<{ ok: boolean; message: string }>("/subscribers/subscribe", { email });
      setState({ kind: "done", message: result.message });
      setEmail("");
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Something went wrong." });
    }
  }

  return (
    <section className="tile tone-a row-2 wide-left" style={{ padding: "var(--space-xl)" }}>
      <div className="flex flex-col gap-4">
        <h2 className="h-section">{headline}</h2>
        <p className="lead" style={{ color: "inherit" }}>
          {blurb}
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col justify-end gap-4">
        <label htmlFor="newsletter-email" className="visually-hidden">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="field field-lg"
        />
        <button type="submit" disabled={state.kind === "busy"} className="btn">
          {state.kind === "busy" ? "Adding" : "Subscribe"}
        </button>
        {state.message ? (
          <p role="status" className={state.kind === "error" ? "notice" : "font-semibold"}>
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
