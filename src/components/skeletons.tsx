function shimmer(className: string, style?: React.CSSProperties) {
  return <div className={`skeleton ${className}`} style={style} />;
}

/** Generic full-page skeleton, used for route-level Suspense fallbacks. */
export function PageSkeleton() {
  return (
    <div className="container" style={{ paddingBlock: "var(--space-2xl)" }}>
      {shimmer("h-10 w-64")}
      <div className="mt-8 space-y-4">
        {shimmer("h-4 w-full")}
        {shimmer("h-4 w-5/6")}
        {shimmer("h-4 w-2/3")}
      </div>
    </div>
  );
}

/** Mimics a post tile while the post list is loading. */
export function PostCardSkeleton() {
  return (
    <div className="tile" aria-hidden>
      {shimmer("h-7 w-3/4")}
      <div className="mt-4 space-y-2">
        {shimmer("h-4 w-full")}
        {shimmer("h-4 w-4/5")}
      </div>
      <div className="mt-6 flex gap-3">
        {shimmer("h-4 w-16")}
        {shimmer("h-4 w-20")}
      </div>
    </div>
  );
}

export function PostListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="tile-grid" style={{ marginTop: "var(--space-xl)" }}>
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Mimics the Home page's masthead while loading. */
export function FeaturedPostSkeleton() {
  return (
    <div className="row-2 hero-row">
      <div className="space-y-4">
        {shimmer("h-16 w-full")}
        {shimmer("h-16 w-4/5")}
      </div>
      <div className="space-y-3">
        {shimmer("h-5 w-full")}
        {shimmer("h-5 w-5/6")}
        {shimmer("h-12 w-48")}
      </div>
    </div>
  );
}
