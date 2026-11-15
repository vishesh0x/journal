export type MediaItem = {
  key: string;
  url: string;
  size: number;
  uploaded: string;
  type: string;
  name: string;
  usedIn: string[];
};

export type MediaList = { items: MediaItem[]; total: number; hasMore: boolean };

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
