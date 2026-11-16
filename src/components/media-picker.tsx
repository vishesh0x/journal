import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Images, Loader, Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import { useResizing } from "@/lib/use-resizing";
import { optimizedImageUrl } from "@/lib/image";
import { formatBytes, type MediaItem, type MediaList } from "@/lib/media";

const PAGE = 48;

export function useMediaList() {
  return useInfiniteQuery({
    queryKey: ["media"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.get<MediaList>(`/media/admin/list?offset=${pageParam}&limit=${PAGE}`),
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length * PAGE : undefined),
  });
}

export function useUploadMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.upload<{ url: string; key: string }>("/media/upload", file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["media"] }),
  });
}

/** Drop zone plus file input. Calls onFiles with whatever the person chose or dropped. */
export function DropArea({ onFiles, busy, multiple = false }: { onFiles: (files: File[]) => void; busy: boolean; multiple?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop ${over ? "is-over" : ""}`}
      style={{ minHeight: "14rem" }}
      role="button"
      tabIndex={0}
      aria-label="Upload new images"
      onClick={() => input.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          input.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
    >
      <div className="px-4 py-8 text-center">
        <span className="inline-flex items-center gap-2 font-bold">
          {busy ? <Loader size={22} aria-hidden="true" /> : <Upload size={22} aria-hidden="true" />}
          {busy ? "Uploading" : "Drop images here or click to choose"}
        </span>
        <p className="small mt-2">JPEG, PNG, WebP, GIF, AVIF or SVG, up to 15 MB each.</p>
      </div>
      <input
        ref={input}
        type="file"
        multiple={multiple}
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function MediaGrid({ items, onPick }: { items: MediaItem[]; onPick: (item: MediaItem) => void }) {
  const resizing = useResizing();
  return (
    <ul className="media-grid">
      {items.map((item) => (
        <li key={item.key}>
          <button type="button" className="media-tile" onClick={() => onPick(item)} title={item.name}>
            <span className="media-thumb">
              <img src={optimizedImageUrl(item.url, { width: 320 }, resizing) ?? item.url} alt="" loading="lazy" decoding="async" width={320} height={320} />
            </span>
            <span className="media-name">{item.name}</span>
            <span className="small">{formatBytes(item.size)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Modal for choosing an image: pick one already uploaded, or upload a new one.
 * onPick gets the stored URL and a readable name (for alt text).
 */
export function MediaPicker({
  open,
  onClose,
  onPick,
  title = "Choose an image",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (picked: { url: string; name: string }) => void;
  title?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [error, setError] = useState<string | null>(null);
  const list = useMediaList();
  const upload = useUploadMedia();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setError(null);
      setTab("library");
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    setError(null);
    try {
      const res = await upload.mutateAsync(file);
      onPick({ url: res.url, name: file.name });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <dialog ref={ref} className="picker" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="picker-title">
      {open ? (
        <div className="picker-body">
          <header className="picker-head">
            <h2 id="picker-title" className="h-title">
              {title}
            </h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          <div className="seg" role="tablist" aria-label="Image source">
            <button type="button" role="tab" aria-selected={tab === "library"} onClick={() => setTab("library")}>
              <Images size={16} aria-hidden="true" /> Library
            </button>
            <button type="button" role="tab" aria-selected={tab === "upload"} onClick={() => setTab("upload")}>
              <ImagePlus size={16} aria-hidden="true" /> Upload new
            </button>
          </div>

          {error ? (
            <p role="alert" className="notice">
              {error}
            </p>
          ) : null}

          {tab === "upload" ? (
            <DropArea onFiles={handleFiles} busy={upload.isPending} />
          ) : list.isLoading ? (
            <p className="muted">Loading your images…</p>
          ) : items.length === 0 ? (
            <div className="panel-empty">
              <p>No images uploaded yet.</p>
              <button type="button" className="btn mt-4" onClick={() => setTab("upload")}>
                <Upload size={18} aria-hidden="true" /> Upload the first one
              </button>
            </div>
          ) : (
            <>
              <MediaGrid
                items={items}
                onPick={(item) => {
                  onPick({ url: item.url, name: item.name });
                  onClose();
                }}
              />
              {list.hasNextPage ? (
                <button type="button" className="btn-ghost self-center" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                  {list.isFetchingNextPage ? "Loading…" : "Show more"}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </dialog>
  );
}
