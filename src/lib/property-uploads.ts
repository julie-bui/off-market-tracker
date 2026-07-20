import { supabase } from "@/lib/supabase";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadPublicFile(
  bucket: string,
  path: string,
  file: File,
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) {
    throw new Error(`Failed to upload ${file.name}: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadBrochure(
  propertyId: string,
  file: File,
): Promise<string> {
  const path = `${propertyId}/brochure-${Date.now()}-${sanitizeFileName(file.name)}`;
  return uploadPublicFile(STORAGE_BUCKETS.brochures, path, file);
}

export async function uploadPropertyImages(
  propertyId: string,
  files: File[],
): Promise<string[]> {
  const urls: string[] = [];

  for (const [index, file] of files.entries()) {
    const path = `${propertyId}/image-${Date.now()}-${index}-${sanitizeFileName(file.name)}`;
    const url = await uploadPublicFile(STORAGE_BUCKETS.images, path, file);
    urls.push(url);
  }

  return urls;
}
