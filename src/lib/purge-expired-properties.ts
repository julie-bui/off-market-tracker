import { deletePropertyWithFiles } from "@/lib/property-uploads";
import { supabase } from "@/lib/supabase";

/**
 * Permanently delete properties whose auto_delete_at has passed,
 * including attached brochure/image storage files.
 * Returns the IDs that were removed.
 */
export async function purgeExpiredProperties(): Promise<string[]> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .lte("auto_delete_at", nowIso);

  if (error) {
    console.error("Failed to load expired properties:", error);
    return [];
  }

  const ids = (data ?? []).map((row) => row.id as string);
  const deleted: string[] = [];

  for (const id of ids) {
    try {
      await deletePropertyWithFiles(id);
      deleted.push(id);
    } catch (err) {
      console.error(`Failed to auto-delete property ${id}:`, err);
    }
  }

  return deleted;
}
