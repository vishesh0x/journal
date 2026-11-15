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
    <section className="relative overflow-hidden bg-foreground px-6 py-12 text-background sm:px-14 sm:py-14 lg:px-20 lg:py-20">
      <div className="relative z-10 max-w-xl">
        <h2 className="break-words font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">{headline}</h2>
        <p className="mt-4 text-base leading-relaxed opacity-70 sm:mt-5 sm:text-lg">{blurb}</p>
        <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4 sm:mt-9 sm:flex-row">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 border-b border-background/40 bg-transparent px-1 py-3.5 text-base outline-none transition-colors placeholder:text-background/45 focus:border-primary"
          />
          <button
            type="submit"
            disabled={state.kind === "busy"}
            className="bg-primary px-9 py-3.5 text-sm font-bold uppercase tracking-[0.16em] text-primary-foreground transition-transform duration-150 ease-out hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
          >
            {state.kind === "busy" ? "Adding" : "Subscribe"}
          </button>
        </form>
        {state.message ? (
          <p className={`mt-4 text-sm ${state.kind === "error" ? "text-destructive" : "opacity-80"}`}>
            {state.message}
          </p>
        ) : null}
      </div>
      <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-primary/25 blur-[100px]" />
    </section>
  );
}
