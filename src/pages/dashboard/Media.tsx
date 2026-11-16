import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Icon, PageHead } from "@/components/dash";
import { DropArea, useMediaList, useUploadMedia } from "@/components/media-picker";
import { api } from "@/lib/api";
import { formatBytes, type MediaItem } from "@/lib/media";
import { useResizing } from "@/lib/use-resizing";
import { optimizedImageUrl } from "@/lib/image";

export default function Media() {
  const queryClient = useQueryClient();
  const list = useMediaList();
  const resizing = useResizing();
  const upload = useUploadMedia();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (key: string) => api.delete(`/media/${key}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media"] }),
    onError: (err) => setError(err instanceof Error ? err.message : "Could not delete."),
  });

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;

  async function handleFiles(files: File[]) {
    setError(null);
    setMessage(null);
    let done = 0;
    for (const file of files) {
      try {
        await upload.mutateAsync(file);
        done++;
      } catch (err) {
        setError(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
      }
    }
    if (done) setMessage(`${done} ${done === 1 ? "image" : "images"} uploaded.`);
  }

  async function copy(item: MediaItem) {
    const absolute = item.url.startsWith("/") ? `${window.location.origin}${item.url}` : item.url;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(item.key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("Copying isn’t allowed in this browser. Select the address from the image instead.");
    }
  }

  function confirmDelete(item: MediaItem) {
    const used = item.usedIn.length
      ? `\n\nIt is used in: ${item.usedIn.join(", ")}. Those places will show a broken image.`
      : "";
    if (confirm(`Delete “${item.name}”? This can’t be undone.${used}`)) remove.mutate(item.key);
  }

  return (
    <DashboardShell>
      <div className="dash-main">
        <PageHead title="Images" hint={`${total} ${total === 1 ? "file" : "files"} in your library. Pick any of them from a post, page or setting.`} />

        <DropArea onFiles={handleFiles} busy={upload.isPending} multiple />
        {message ? (
          <p role="status" className="mt-4 font-bold" style={{ color: "var(--color-success)" }}>
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="notice mt-4">
            {error}
          </p>
        ) : null}

        {list.isLoading ? (
          <p className="muted mt-8">Loading images…</p>
        ) : items.length === 0 ? (
          <p className="panel-empty">Nothing uploaded yet. Drop a few images above to start.</p>
        ) : (
          <ul className="media-grid mt-8">
            {items.map((item) => (
              <li key={item.key} className="media-card">
                <span className="media-thumb">
                  <img src={optimizedImageUrl(item.url, { width: 320 }, resizing) ?? item.url} alt="" loading="lazy" decoding="async" width={320} height={320} />
                </span>
                <div className="media-info">
                  <p className="media-name" title={item.name}>
                    {item.name}
                  </p>
                  <p className="small">
                    {formatBytes(item.size)}, {new Date(item.uploaded).toLocaleDateString()}
                  </p>
                  {item.usedIn.length ? (
                    <p className="small" title={item.usedIn.join("\n")}>
                      Used in {item.usedIn.length} {item.usedIn.length === 1 ? "place" : "places"}
                    </p>
                  ) : (
                    <p className="small">Not used anywhere</p>
                  )}
                </div>
                <div className="media-actions">
                  <button type="button" className="icon-btn" onClick={() => void copy(item)} aria-label={`Copy address of ${item.name}`} title="Copy address">
                    <Icon as={copied === item.key ? Check : Copy} />
                  </button>
                  <button type="button" className="icon-btn danger" onClick={() => confirmDelete(item)} aria-label={`Delete ${item.name}`} title="Delete">
                    <Icon as={Trash2} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {list.hasNextPage ? (
          <div className="mt-6 text-center">
            <button type="button" className="btn-ghost" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
              {list.isFetchingNextPage ? "Loading…" : "Show more"}
            </button>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
