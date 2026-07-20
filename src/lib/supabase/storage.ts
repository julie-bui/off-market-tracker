/** Supabase storage bucket IDs for property media */
export const STORAGE_BUCKETS = {
  brochures: "brochures",
  images: "images",
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
