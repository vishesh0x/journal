import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const field =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary";

export default function Auth() {
  const { needsBootstrap, refresh } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const endpoint = needsBootstrap ? "/auth/register" : "/auth/login";
      await api.post(endpoint, { email, password });
      await refresh();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-foreground px-14 py-14 text-background lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-32 size-[34rem] rounded-full opacity-25 blur-3xl"
          style={{ background: "var(--primary)" }}
        />
        <Link to="/" className="relative font-display text-2xl font-bold tracking-tighter">
          Journal
        </Link>
        <div className="relative max-w-md">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">The private side</p>
          <p className="mt-6 font-display text-4xl font-bold leading-[1.06] tracking-tighter">
            Write it down while it is still yours.
          </p>
          <p className="mt-6 text-sm leading-relaxed opacity-70">
            Drafts, covers, topics, subscribers and every word of your site live behind this door.
          </p>
        </div>
        <p className="relative text-[11px] font-bold uppercase tracking-[0.2em] opacity-50">
          © {new Date().getFullYear()} Journal
        </p>
      </aside>

      <main className="flex items-center justify-center px-5 py-16 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center justify-between">
            <Link
              to="/"
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-primary"
            >
              ← Back to the site
            </Link>
            <ThemeToggle />
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            {needsBootstrap ? "First time" : "Welcome back"}
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold leading-[1.05] tracking-tighter sm:text-4xl">
            {needsBootstrap ? "Create your account" : "Sign in to write"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {needsBootstrap
              ? "The first account created becomes the owner of this journal."
              : "Only the owner of this journal can publish."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={field}
            />
            <input
              type="password"
              required
              minLength={needsBootstrap ? 8 : undefined}
              autoComplete={needsBootstrap ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={field}
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold tracking-tight text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Please wait…" : needsBootstrap ? "Create account" : "Sign in"}
            </button>
          </form>

          {error ? <p className="mt-5 text-sm text-destructive">{error}</p> : null}
        </div>
      </main>
    </div>
  );
}
