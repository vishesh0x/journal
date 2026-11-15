import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { ExternalLink, FileText, LogOut, PenLine, Settings as Cog, Tag, Users, type LucideIcon } from "lucide-react";

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/dashboard", label: "Posts", icon: PenLine, end: true },
  { to: "/dashboard/pages", label: "Pages", icon: FileText },
  { to: "/dashboard/tags", label: "Topics", icon: Tag },
  { to: "/dashboard/subscribers", label: "Subscribers", icon: Users },
  { to: "/dashboard/settings", label: "Settings", icon: Cog },
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
            {NAV.map(({ to, label, end, icon: Glyph }) => (
              <NavLink key={to} to={to} end={end} className="nav-link nav-icon-link">
                <Glyph size={18} strokeWidth={2.25} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto flex flex-col items-start gap-3">
            <a href="/" target="_blank" rel="noreferrer" className="text-link inline-flex items-center gap-2">
              <ExternalLink size={16} aria-hidden="true" /> View the site
            </a>
            <button type="button" onClick={signOut} className="btn-ghost">
              <LogOut size={18} aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
