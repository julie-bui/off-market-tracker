/** Supabase storage bucket IDs for property media */
export const STORAGE_BUCKETS = {
  brochures: "brochures",
  /** Image uploads (bucket id in schema migration) */
  propertyImages: "property-images",
  /** Alias matching “images” wording in product copy */
  images: "property-images",
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
