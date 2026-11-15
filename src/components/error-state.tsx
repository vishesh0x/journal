export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="container">
      <div className="tile tone-d flex max-w-xl flex-col gap-4">
        <h1 className="h-section">Couldn’t load this page</h1>
        <p>The site couldn’t reach its data. Try refreshing. If this keeps happening, the site may be misconfigured.</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="btn self-start">
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
