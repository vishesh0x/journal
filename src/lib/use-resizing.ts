import { useQuery } from "@tanstack/react-query";
import { api, type SiteSettings } from "@/lib/api";

/** Whether Cloudflare image resizing is switched on for this site (shared, cached settings query). */
export function useResizing(): boolean {
  const { data } = useQuery({ queryKey: ["settings", "public"], queryFn: () => api.get<SiteSettings>("/settings") });
  return Boolean(data?.image_resizing_enabled);
}
