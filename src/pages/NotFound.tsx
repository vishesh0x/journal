import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site-shell";

export default function NotFound() {
  return (
    <SiteShell>
      <div className="container">
        <div className="row-2 hero-row">
          <h1 className="display">Nothing here.</h1>
          <div className="flex flex-col gap-6">
            <p className="lead">The page you’re looking for doesn’t exist.</p>
            <Link to="/" className="btn self-start">
              Back to writing
            </Link>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
