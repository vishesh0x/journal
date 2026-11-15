import { useRef, useState } from "react";
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

  const frame = preview === "square" ? "aspect-square max-w-[9rem] rounded-full" : "aspect-[16/7] w-full rounded-2xl";

  return (
    <div>
      <p className="text-sm font-bold  text-muted-foreground">{label}</p>

      <div
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
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`group relative mt-2 grid cursor-pointer place-items-center overflow-hidden border border-dashed bg-surface transition-colors ${frame} ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary"
        }`}
      >
        {value ? (
          <>
            <img src={value} alt={`${label} preview`} className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 grid place-items-center bg-foreground/70 text-xs font-bold  text-background opacity-0 transition-opacity group-hover:opacity-100">
              {busy ? "Uploading…" : "Replace image"}
            </div>
          </>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-semibold">{busy ? "Uploading…" : "Drop an image here"}</p>
            <p className="mt-1 text-xs text-muted-foreground">or click to choose a file</p>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-4">
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
          >
            Remove
          </button>
        ) : null}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => void handleFile(e.target.files?.[0])}
        className="hidden"
      />
    </div>
  );
}
