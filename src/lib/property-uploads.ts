import { supabase } from "@/lib/supabase";
import { STORAGE_BUCKETS, type StorageBucket } from "@/lib/supabase/storage";
import type { PropertyFile } from "@/types/database";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Extract bucket + object path from a Supabase public storage URL. */
export function parseStoragePublicUrl(
  fileUrl: string,
): { bucket: string; path: string } | null {
  try {
    const url = new URL(fileUrl);
    const marker = "/storage/v1/object/public/";
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;

    const rest = url.pathname.slice(idx + marker.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) return null;

    const bucket = decodeURIComponent(rest.slice(0, slash));
    const path = decodeURIComponent(rest.slice(slash + 1));
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

function bucketForFileType(
  fileType: PropertyFile["file_type"],
): StorageBucket {
  return fileType === "brochure"
    ? STORAGE_BUCKETS.brochures
    : STORAGE_BUCKETS.images;
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

async function listAllObjectPaths(
  bucket: string,
  folder: string,
): Promise<string[]> {
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 1000,
  });

  if (error) {
    // Folder may not exist yet — treat as empty.
    console.warn(`Could not list ${bucket}/${folder}:`, error.message);
    return [];
  }

  return (data ?? [])
    .filter((item) => item.name && item.id != null)
    .map((item) => `${folder}/${item.name}`);
}

async function removeStoragePaths(
  bucket: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;

  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    throw new Error(
      `Failed to delete files from “${bucket}”: ${error.message}`,
    );
  }
}

/** Delete one stored object referenced by a property_files row. */
export async function deleteStorageForPropertyFile(
  file: Pick<PropertyFile, "file_url" | "file_type">,
): Promise<void> {
  const parsed = parseStoragePublicUrl(file.file_url);
  const bucket = parsed?.bucket ?? bucketForFileType(file.file_type);
  const path = parsed?.path;

  if (!path) {
    console.warn("Could not resolve storage path for", file.file_url);
    return;
  }

  await removeStoragePaths(bucket, [path]);
}

/**
 * Delete property_files rows the user removed during edit, and their
 * corresponding Storage objects.
 */
export async function removePropertyFiles(
  files: PropertyFile[],
): Promise<void> {
  if (files.length === 0) return;

  for (const file of files) {
    await deleteStorageForPropertyFile(file);
  }

  const ids = files.map((file) => file.id);
  const { error } = await supabase.from("property_files").delete().in("id", ids);

  if (error) {
    throw new Error(`Failed to remove file records: ${error.message}`);
  }
}

/**
 * Wipe Storage objects for a property (brochures + images folders and any
 * paths referenced by property_files), then delete the property row
 * (cascades remaining property_files rows).
 */
export async function deletePropertyWithFiles(
  propertyId: string,
): Promise<void> {
  const { data: fileRows, error: filesError } = await supabase
    .from("property_files")
    .select("id, file_url, file_type")
    .eq("property_id", propertyId);

  if (filesError) {
    throw new Error(`Failed to load property files: ${filesError.message}`);
  }

  const files = (fileRows ?? []) as Array<
    Pick<PropertyFile, "id" | "file_url" | "file_type">
  >;

  const brochurePaths = new Set<string>();
  const imagePaths = new Set<string>();

  for (const file of files) {
    const parsed = parseStoragePublicUrl(file.file_url);
    const bucket = parsed?.bucket ?? bucketForFileType(file.file_type);
    const path = parsed?.path;
    if (!path) continue;

    if (bucket === STORAGE_BUCKETS.brochures) brochurePaths.add(path);
    else if (bucket === STORAGE_BUCKETS.images) imagePaths.add(path);
  }

  for (const path of await listAllObjectPaths(
    STORAGE_BUCKETS.brochures,
    propertyId,
  )) {
    brochurePaths.add(path);
  }
  for (const path of await listAllObjectPaths(
    STORAGE_BUCKETS.images,
    propertyId,
  )) {
    imagePaths.add(path);
  }

  await removeStoragePaths(STORAGE_BUCKETS.brochures, [...brochurePaths]);
  await removeStoragePaths(STORAGE_BUCKETS.images, [...imagePaths]);

  const { error: deleteError } = await supabase
    .from("properties")
    .delete()
    .eq("id", propertyId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}
