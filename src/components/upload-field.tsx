import { useState } from "react";
import { Images, Loader, RefreshCw, Trash2 } from "lucide-react";
import { MediaPicker, useUploadMedia } from "@/components/media-picker";

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
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = useUploadMedia();

  async function dropFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const res = await upload.mutateAsync(file);
      onChange(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  const shape = preview === "square" ? { aspectRatio: "1", maxWidth: "11rem", borderRadius: "var(--radius-pill)" } : { aspectRatio: "16 / 7", width: "100%" };
  const busy = upload.isPending;

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
          void dropFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        aria-label={value ? `Change ${label}` : `Choose ${label}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {value ? (
          <>
            <img src={value} alt="" />
            <div className="veil">
              <span className="inline-flex items-center gap-2">
                {busy ? <Loader size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
                {busy ? "Uploading" : "Change"}
              </span>
            </div>
          </>
        ) : (
          <div className="px-4 py-6 text-center">
            <span className="inline-flex items-center gap-2 font-bold">
              {busy ? <Loader size={20} aria-hidden="true" /> : <Images size={20} aria-hidden="true" />}
              {busy ? "Uploading" : "Choose or upload"}
            </span>
            <p className="small mt-1">Pick one you already have, or drop a new file here.</p>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="linkbtn danger inline-flex items-center gap-1">
            <Trash2 size={14} aria-hidden="true" /> Remove
          </button>
        ) : null}
        {hint ? (
          <p className="form-hint" style={{ marginTop: 0 }}>
            {hint}
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="notice mt-2">
          {error}
        </p>
      ) : null}

      <MediaPicker open={open} onClose={() => setOpen(false)} onPick={({ url }) => onChange(url)} title={`Choose ${label.toLowerCase()}`} />
    </div>
  );
}
