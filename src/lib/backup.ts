import { strFromU8, strToU8, unzipSync, zip, type Zippable } from "fflate";
import { api } from "@/lib/api";

const FORMAT = "journal-backup";
const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_DATA = 80 * 1024 * 1024;
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

export type Manifest = {
  format: string;
  version: number;
  created: string;
  counts: Record<string, number>;
};
type MediaEntry = { key: string; size: number; name: string };
type ExportResponse = { manifest: Manifest; data: Record<string, unknown[]>; media: MediaEntry[] };

export type ParsedBackup = {
  manifest: Manifest;
  data: Record<string, unknown>;
  media: { key: string; name: string; bytes: Uint8Array }[];
};

const zipAsync = (files: Zippable) =>
  new Promise<Uint8Array>((resolve, reject) => zip(files, (err, out) => (err ? reject(err) : resolve(out))));

async function pool<T>(items: T[], size: number, worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await worker(items[index]!, index);
      }
    }),
  );
}

export function download(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const backupName = (prefix = "journal-backup") => `${prefix}-${new Date().toISOString().slice(0, 10)}.zip`;

/** Pulls every table and every image into one zip held in memory. */
export async function buildBackup(password: string, onProgress: (message: string) => void): Promise<Uint8Array> {
  onProgress("Reading your posts, pages, topics, subscribers and settings…");
  const exported = await api.post<ExportResponse>("/backup/export", { password });
  const files: Zippable = {
    "manifest.json": strToU8(JSON.stringify(exported.manifest, null, 2)),
    "data.json": strToU8(JSON.stringify(exported.data)),
    "media-index.json": strToU8(JSON.stringify(exported.media)),
  };
  let done = 0;
  await pool(exported.media, 4, async (item) => {
    const res = await fetch(`/api/media/${encodeURIComponent(item.key)}`);
    if (!res.ok) throw new Error(`Could not read the image ${item.key}.`);
    // Images are already compressed, so they are stored as they are.
    files[`media/${item.key}`] = [new Uint8Array(await res.arrayBuffer()), { level: 0 }];
    onProgress(`Collecting images, ${++done} of ${exported.media.length}…`);
  });
  onProgress("Packing the zip…");
  return zipAsync(files);
}

/** Reads and checks a backup zip in the browser. Nothing is sent anywhere yet. */
export async function parseBackup(file: File): Promise<ParsedBackup> {
  const raw = new Uint8Array(await file.arrayBuffer());
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(raw, {
      filter: (f) =>
        f.name === "manifest.json" || f.name === "data.json" || f.name === "media-index.json"
          ? f.originalSize <= MAX_DATA
          : f.name.startsWith("media/") && KEY_RE.test(f.name.slice(6)) && f.originalSize <= MAX_IMAGE,
    });
  } catch {
    throw new Error("That file is not a readable zip.");
  }
  if (!entries["manifest.json"] || !entries["data.json"]) throw new Error("This zip is not a journal backup (manifest or data is missing).");
  let manifest: Manifest;
  let data: Record<string, unknown>;
  try {
    manifest = JSON.parse(strFromU8(entries["manifest.json"]));
    data = JSON.parse(strFromU8(entries["data.json"]));
  } catch {
    throw new Error("The backup's contents are damaged.");
  }
  if (manifest.format !== FORMAT) throw new Error("This zip is not a journal backup.");
  if (manifest.version !== 1) throw new Error("This backup comes from a newer version and can’t be restored here.");
  const names = new Map<string, string>();
  if (entries["media-index.json"]) {
    try {
      for (const m of JSON.parse(strFromU8(entries["media-index.json"])) as MediaEntry[]) names.set(m.key, m.name);
    } catch {
      /* names are optional */
    }
  }
  const media = Object.entries(entries)
    .filter(([name]) => name.startsWith("media/"))
    .map(([name, bytes]) => ({ key: name.slice(6), name: names.get(name.slice(6)) ?? name.slice(6), bytes }));
  return { manifest, data, media };
}

/** Uploads the images first (never deleting anything), then replaces the content in one request. */
export async function restoreBackup(parsed: ParsedBackup, password: string, onProgress: (message: string) => void) {
  let done = 0;
  await pool(parsed.media, 3, async (item) => {
    const res = await fetch(`/api/backup/media/${encodeURIComponent(item.key)}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "X-Media-Name": encodeURIComponent(item.name) },
      body: item.bytes as BlobPart,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Could not restore ${item.key}.`);
    }
    onProgress(`Restoring images, ${++done} of ${parsed.media.length}…`);
  });
  onProgress("Replacing posts, pages, topics, subscribers and settings…");
  return api.post<{ restored: Record<string, number> }>("/backup/restore", { password, data: parsed.data });
}
