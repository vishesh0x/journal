import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site-shell";

export default function NotFound() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6 sm:py-32">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Missing page</p>
        <h1 className="mt-5 font-display text-4xl font-bold leading-[1.02] tracking-tighter sm:text-6xl lg:text-7xl">
          Nothing here.
        </h1>
        <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="mt-10 inline-block border-b-2 border-primary pb-1 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors hover:text-primary"
        >
          Back to writing
        </Link>
      </div>
    </SiteShell>
  );
}
