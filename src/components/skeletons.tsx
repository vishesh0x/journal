function shimmer(className: string) {
  return <div className={`animate-pulse rounded-md bg-surface ${className}`} />;
}

/** Generic full-page skeleton — used for route-level Suspense fallbacks. */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6">
      {shimmer("h-8 w-48")}
      <div className="mt-8 space-y-4">
        {shimmer("h-4 w-full")}
        {shimmer("h-4 w-5/6")}
        {shimmer("h-4 w-2/3")}
      </div>
    </div>
  );
}

/** Mimics a PostCard's layout while the post list is loading. */
export function PostCardSkeleton() {
  return (
    <div className="border-t border-border py-8 first:border-t-0 first:pt-0 sm:py-10">
      {shimmer("h-6 w-3/4")}
      <div className="mt-3 space-y-2">
        {shimmer("h-4 w-full")}
        {shimmer("h-4 w-4/5")}
      </div>
      <div className="mt-4 flex gap-3">
        {shimmer("h-3 w-16")}
        {shimmer("h-3 w-20")}
      </div>
    </div>
  );
}

export function PostListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Mimics the Home page's featured-post hero while loading. */
export function FeaturedPostSkeleton() {
  return (
    <div className="grid grid-cols-12 items-end gap-6 pb-16 sm:pb-32">
      <div className="col-span-12 lg:col-span-7">{shimmer("aspect-video w-full")}</div>
      <div className="col-span-12 space-y-3 lg:col-span-5">
        {shimmer("h-4 w-24")}
        {shimmer("h-9 w-full")}
        {shimmer("h-4 w-5/6")}
      </div>
    </div>
  );
}
