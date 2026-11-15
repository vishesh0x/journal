export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center sm:px-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Something went wrong</p>
      <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">Couldn't load this page</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        The site couldn't reach its data. Try refreshing — if this keeps happening, the site may be misconfigured.
      </p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-6 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-primary"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
