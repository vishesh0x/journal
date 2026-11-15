import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { to: "/dashboard", label: "Posts", end: true },
  { to: "/dashboard/pages", label: "Pages" },
  { to: "/dashboard/tags", label: "Topics" },
  { to: "/dashboard/subscribers", label: "Subscribers" },
  { to: "/dashboard/settings", label: "Settings" },
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
    <div data-surface="app" className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-border lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-6 px-5 py-6 lg:h-full">
          <div className="flex items-center justify-between">
            <Link to="/" className="wordmark text-2xl">
              Journal
            </Link>
            <ThemeToggle />
          </div>

          <nav aria-label="Dashboard" className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap">
            {NAV.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className="nav-link" style={{ textAlign: "left" }}>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto flex flex-col items-start gap-3">
            <a href="/" target="_blank" rel="noreferrer" className="text-link">
              View the site
            </a>
            <button type="button" onClick={signOut} className="btn-ghost">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
