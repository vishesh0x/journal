import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Auth() {
  const { needsBootstrap, refresh } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupToken, setSetupToken] = useState("");
  const [needsSetupToken, setNeedsSetupToken] = useState(false);

  useEffect(() => {
    api
      .get<{ needsSetupToken?: boolean }>("/auth/bootstrap-status")
      .then((res) => setNeedsSetupToken(Boolean(res.needsSetupToken)))
      .catch(() => setNeedsSetupToken(false));
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const endpoint = needsBootstrap ? "/auth/register" : "/auth/login";
      await api.post(endpoint, needsBootstrap ? { email, password, setupToken } : { email, password });
      await refresh();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-surface="app" className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside
        className="hidden flex-col justify-between lg:flex"
        style={{ background: "var(--color-tile-b)", color: "var(--color-tile-b-ink)", padding: "var(--space-2xl)" }}
      >
        <Link to="/" className="wordmark text-2xl">
          Journal
        </Link>
        <div className="max-w-md">
          <p className="display-s">Write it down while it is still yours.</p>
          <p className="mt-6">
            Drafts, covers, topics, subscribers and every word of your site live behind this door.
          </p>
        </div>
        <p className="small" style={{ color: "inherit" }}>
          © {new Date().getFullYear()} Journal
        </p>
      </aside>

      <main className="flex items-center justify-center" style={{ padding: "var(--space-2xl) var(--gutter)" }}>
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center justify-between">
            <Link to="/" className="text-link">
              Back to the site
            </Link>
            <ThemeToggle />
          </div>

          <h1 className="display-s" style={{ fontSize: "var(--text-3xl)" }}>
            {needsBootstrap ? "Create your account" : "Sign in to write"}
          </h1>
          <p className="muted mt-3">
            {needsBootstrap
              ? "The first account created becomes the owner of this journal."
              : "Only the owner of this journal can publish."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-3">
            <label htmlFor="auth-email" className="visually-hidden">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="field"
            />
            <label htmlFor="auth-password" className="visually-hidden">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={needsBootstrap ? 8 : undefined}
              autoComplete={needsBootstrap ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="field"
            />
            {needsBootstrap && needsSetupToken ? (
              <>
                <label htmlFor="auth-setup" className="visually-hidden">
                  Setup code
                </label>
                <input
                  id="auth-setup"
                  type="password"
                  required
                  autoComplete="off"
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                  placeholder="Setup code"
                  className="field"
                />
              </>
            ) : null}
            <button type="submit" disabled={busy} className="btn w-full">
              {busy ? "Please wait…" : needsBootstrap ? "Create account" : "Sign in"}
            </button>
          </form>

          {error ? (
            <p role="alert" className="notice mt-5">
              {error}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
