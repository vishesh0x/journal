import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";

const navItem =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface hover:text-foreground aria-[current=page]:bg-surface aria-[current=page]:text-foreground";

const NAV = [
  { to: "/dashboard", label: "Posts", glyph: "✎", end: true },
  { to: "/dashboard/pages", label: "Pages", glyph: "▤" },
  { to: "/dashboard/tags", label: "Topics", glyph: "#" },
  { to: "/dashboard/subscribers", label: "Subscribers", glyph: "✉" },
  { to: "/dashboard/settings", label: "Settings", glyph: "⚙" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refresh } = useAuth();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await api.post("/auth/logout");
    await refresh();
    navigate("/auth", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-border lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-6 px-5 py-6 lg:h-full">
          <div className="flex items-center justify-between">
            <Link to="/" className="font-display text-xl font-bold tracking-tighter">
              Journal
            </Link>
            <ThemeToggle />
          </div>

          <nav className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap">
            {NAV.map(({ to, label, glyph, end }) => (
              <NavLink key={to} to={to} end={end} className={navItem}>
                <span aria-hidden className="w-4 text-center text-xs text-primary">
                  {glyph}
                </span>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-2 lg:flex">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
            >
              View site ↗
            </a>
            <button
              onClick={signOut}
              className="text-left text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-destructive"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
