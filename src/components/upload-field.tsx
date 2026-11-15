import { useRef, useState } from "react";
import { ImagePlus, Loader, RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

export function UploadField({
  label,
  value,
  onChange,
  hint,
  preview = "wide",
}: {
  label: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  hint?: string;
  preview?: "wide" | "square";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.upload<{ url: string }>("/media/upload", file);
      onChange(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const shape = preview === "square" ? { aspectRatio: "1", maxWidth: "11rem", borderRadius: "var(--radius-pill)" } : { aspectRatio: "16 / 7", width: "100%" };

  return (
    <div>
      <p className="form-label">{label}</p>
      <div
        className={`drop ${dragging ? "is-over" : ""}`}
        style={shape}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={value ? `Replace ${label}` : `Upload ${label}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        {value ? (
          <>
            <img src={value} alt="" />
            <div className="veil">
              <span className="inline-flex items-center gap-2">
                {busy ? <Loader size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
                {busy ? "Uploading" : "Replace"}
              </span>
            </div>
          </>
        ) : (
          <div className="px-4 py-6 text-center">
            <span className="inline-flex items-center gap-2 font-bold">
              {busy ? <Loader size={20} aria-hidden="true" /> : <ImagePlus size={20} aria-hidden="true" />}
              {busy ? "Uploading" : "Add an image"}
            </span>
            <p className="small mt-1">Drop a file or click. JPEG, PNG, WebP, GIF, AVIF or SVG.</p>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="linkbtn danger inline-flex items-center gap-1">
            <Trash2 size={14} aria-hidden="true" /> Remove
          </button>
        ) : null}
        {hint ? <p className="form-hint" style={{ marginTop: 0 }}>{hint}</p> : null}
      </div>
      {error ? (
        <p role="alert" className="notice mt-2">
          {error}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
        onChange={(e) => void handleFile(e.target.files?.[0])}
        className="hidden"
      />
    </div>
  );
}
