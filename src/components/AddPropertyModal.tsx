"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { geocodeAddress } from "@/lib/geocode";
import { findSimilarProperty, type SimilarProperty } from "@/lib/property-duplicates";
import { specsForSave, specsToPlainText } from "@/lib/specs";
import { supabase } from "@/lib/supabase";
import {
  uploadBrochure,
  uploadPropertyImage,
  removePropertyFiles,
  deletePropertyWithFiles,
} from "@/lib/property-uploads";
import type {
  Property,
  PropertyFile,
  PropertyStatus,
} from "@/types/database";

const STATUSES: PropertyStatus[] = [
  "available",
  "under_offer",
  "let",
  "withdrawn",
];

const ADDRESS_NOT_FOUND_MESSAGE =
  "Address not found — try adding more detail like postcode or building name.";

export type CreatedPropertyMarker = {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  status: PropertyStatus;
};

type AddPropertyModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (property: CreatedPropertyMarker) => void;
  onUpdated?: (property: CreatedPropertyMarker) => void;
  /** Open an existing property's detail panel (duplicate warning). */
  onViewExisting?: (propertyId: string) => void;
  propertyToEdit?: Property | null;
  existingFiles?: PropertyFile[];
};

type FormState = {
  address: string;
  postcode: string;
  size_sqft: string;
  cost_per_sqft: string;
  availability_period: string;
  status: PropertyStatus;
  agent_name: string;
  agent_phone: string;
  agent_email: string;
  specs: string;
  notes: string;
};

type PendingUploadRetry = {
  propertyId: string;
  marker: CreatedPropertyMarker;
  brochures: File[];
  images: File[];
  failedFileName: string;
  /** When true, the property row was just inserted and can still be rolled back. */
  canRollback: boolean;
};

const INITIAL_FORM: FormState = {
  address: "",
  postcode: "",
  size_sqft: "",
  cost_per_sqft: "",
  availability_period: "",
  status: "available",
  agent_name: "",
  agent_phone: "",
  agent_email: "",
  specs: "",
  notes: "",
};

function propertyToFormState(property: Property): FormState {
  return {
    address: property.address,
    postcode: property.postcode ?? "",
    size_sqft: property.size_sqft != null ? String(property.size_sqft) : "",
    cost_per_sqft:
      property.cost_per_sqft != null ? String(property.cost_per_sqft) : "",
    availability_period: property.availability_period ?? "",
    status: property.status,
    agent_name: property.agent_name ?? "",
    agent_phone: property.agent_phone ?? "",
    agent_email: property.agent_email ?? "",
    specs: specsToPlainText(property.specs),
    notes: property.notes ?? "",
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusLabel(status: PropertyStatus): string {
  return status.replaceAll("_", " ");
}

function uploadFailureMessage(fileName: string): string {
  return `Failed to upload ${fileName} — please try again`;
}

function isGeocodeNotFoundError(message: string): boolean {
  return (
    message === ADDRESS_NOT_FOUND_MESSAGE ||
    /no location found|no usable coordinates|address not found/i.test(message)
  );
}

export default function AddPropertyModal({
  open,
  onClose,
  onCreated,
  onUpdated,
  onViewExisting,
  propertyToEdit = null,
  existingFiles = [],
}: AddPropertyModalProps) {
  const isEditing = propertyToEdit != null;
  const titleId = useId();
  const [form, setForm] = useState<FormState>(() =>
    propertyToEdit ? propertyToFormState(propertyToEdit) : INITIAL_FORM,
  );
  const [brochures, setBrochures] = useState<File[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [keptFiles, setKeptFiles] = useState<PropertyFile[]>(existingFiles);
  const [removedFiles, setRemovedFiles] = useState<PropertyFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<SimilarProperty | null>(null);
  const duplicateIgnoredRef = useRef(false);
  const [uploadRetry, setUploadRetry] = useState<PendingUploadRetry | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, submitting]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "address" || key === "postcode") {
      setAddressError(null);
      setDuplicate(null);
      duplicateIgnoredRef.current = false;
    }
  }

  function removeExistingFile(fileId: string) {
    const target = keptFiles.find((file) => file.id === fileId);
    if (!target) return;
    setKeptFiles((current) => current.filter((file) => file.id !== fileId));
    setRemovedFiles((removed) =>
      removed.some((file) => file.id === fileId) ? removed : [...removed, target],
    );
  }

  const keptBrochures = keptFiles.filter((file) => file.file_type === "brochure");
  const keptImages = keptFiles.filter((file) => file.file_type === "image");

  async function attachFiles(
    propertyId: string,
    brochureFiles: File[],
    imageFiles: File[],
  ): Promise<{ remainingBrochures: File[]; remainingImages: File[] }> {
    const remainingBrochures = [...brochureFiles];
    const remainingImages = [...imageFiles];

    while (remainingBrochures.length > 0) {
      const brochureFile = remainingBrochures[0];
      if (brochureFile.type !== "application/pdf") {
        throw new Error(`Brochure “${brochureFile.name}” must be a PDF file.`);
      }

      try {
        const brochureUrl = await uploadBrochure(
          propertyId,
          brochureFile,
          brochureFiles.length - remainingBrochures.length,
        );
        const { error: brochureError } = await supabase
          .from("property_files")
          .insert({
            property_id: propertyId,
            file_url: brochureUrl,
            file_type: "brochure",
          });

        if (brochureError) {
          throw new Error(uploadFailureMessage(brochureFile.name));
        }
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.startsWith("Failed to upload ")
        ) {
          throw Object.assign(err, {
            remainingBrochures,
            remainingImages,
            failedFileName: brochureFile.name,
          });
        }
        throw Object.assign(new Error(uploadFailureMessage(brochureFile.name)), {
          remainingBrochures,
          remainingImages,
          failedFileName: brochureFile.name,
        });
      }

      remainingBrochures.shift();
    }

    while (remainingImages.length > 0) {
      const imageFile = remainingImages[0];
      if (!imageFile.type.startsWith("image/")) {
        throw new Error(`“${imageFile.name}” is not an image file.`);
      }

      try {
        const imageUrl = await uploadPropertyImage(
          propertyId,
          imageFile,
          imageFiles.length - remainingImages.length,
        );
        const { error: imageError } = await supabase
          .from("property_files")
          .insert({
            property_id: propertyId,
            file_url: imageUrl,
            file_type: "image",
          });

        if (imageError) {
          throw new Error(uploadFailureMessage(imageFile.name));
        }
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.startsWith("Failed to upload ")
        ) {
          throw Object.assign(err, {
            remainingBrochures,
            remainingImages,
            failedFileName: imageFile.name,
          });
        }
        throw Object.assign(new Error(uploadFailureMessage(imageFile.name)), {
          remainingBrochures,
          remainingImages,
          failedFileName: imageFile.name,
        });
      }

      remainingImages.shift();
    }

    return { remainingBrochures, remainingImages };
  }

  function finishSave(marker: CreatedPropertyMarker) {
    if (isEditing) {
      onUpdated?.(marker);
    } else {
      onCreated(marker);
    }
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Synchronous guard — React state alone cannot block double-submit races.
    if (submittingRef.current) return;

    setError(null);
    setAddressError(null);
    setUploadRetry(null);

    const address = form.address.trim();
    if (!address) {
      setAddressError("Address is required.");
      return;
    }

    const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    if (!maptilerKey) {
      setError(
        "Missing NEXT_PUBLIC_MAPTILER_KEY. Add it to .env.local to geocode addresses.",
      );
      return;
    }

    const postcode = form.postcode.trim();
    const query = [address, postcode].filter(Boolean).join(", ");

    submittingRef.current = true;
    setSubmitting(true);

    let createdPropertyId: string | null = null;

    try {
      if (!isEditing && !duplicateIgnoredRef.current) {
        const similar = await findSimilarProperty({ address, postcode });
        if (similar) {
          setDuplicate(similar);
          return;
        }
      }

      let geocoded;
      try {
        geocoded = await geocodeAddress(query, maptilerKey);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : ADDRESS_NOT_FOUND_MESSAGE;
        if (isGeocodeNotFoundError(message)) {
          setAddressError(ADDRESS_NOT_FOUND_MESSAGE);
          return;
        }
        setError(message);
        return;
      }

      const payload = {
        address,
        postcode: postcode || null,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        size_sqft: parseOptionalNumber(form.size_sqft),
        cost_per_sqft: parseOptionalNumber(form.cost_per_sqft),
        availability_period: form.availability_period.trim() || null,
        status: form.status,
        agent_name: form.agent_name.trim() || null,
        agent_phone: form.agent_phone.trim() || null,
        agent_email: form.agent_email.trim() || null,
        specs: specsForSave(form.specs),
        notes: form.notes.trim() || null,
      };

      const mutation = isEditing
        ? supabase
            .from("properties")
            .update(payload)
            .eq("id", propertyToEdit.id)
            .select("id, address, latitude, longitude, status")
            .single()
        : supabase
            .from("properties")
            .insert(payload)
            .select("id, address, latitude, longitude, status")
            .single();

      const { data: property, error: saveError } = await mutation;

      if (saveError || !property) {
        throw new Error(
          saveError?.message ?? "Failed to save the property record.",
        );
      }

      if (!isEditing) {
        createdPropertyId = property.id;
      }

      if (isEditing && removedFiles.length > 0) {
        await removePropertyFiles(removedFiles);
      }

      if (property.latitude == null || property.longitude == null) {
        throw new Error("Property saved without coordinates.");
      }

      const markerPayload: CreatedPropertyMarker = {
        id: property.id,
        address: property.address,
        latitude: property.latitude,
        longitude: property.longitude,
        status: (property.status ?? form.status) as PropertyStatus,
      };

      try {
        await attachFiles(property.id, brochures, images);
      } catch (err) {
        const failedFileName =
          err && typeof err === "object" && "failedFileName" in err
            ? String((err as { failedFileName: string }).failedFileName)
            : "file";
        const remainingBrochures =
          err && typeof err === "object" && "remainingBrochures" in err
            ? ((err as { remainingBrochures: File[] }).remainingBrochures ?? [])
            : brochures;
        const remainingImages =
          err && typeof err === "object" && "remainingImages" in err
            ? ((err as { remainingImages: File[] }).remainingImages ?? [])
            : images;

        const message = uploadFailureMessage(failedFileName);

        if (!isEditing && createdPropertyId) {
          // Roll back the new property so we never leave an incomplete record.
          try {
            await deletePropertyWithFiles(createdPropertyId);
          } catch (rollbackError) {
            console.error("Failed to roll back property after upload error", rollbackError);
            setUploadRetry({
              propertyId: createdPropertyId,
              marker: markerPayload,
              brochures: remainingBrochures,
              images: remainingImages,
              failedFileName,
              canRollback: false,
            });
            setBrochures(remainingBrochures);
            setImages(remainingImages);
            setError(
              `${message}. The property was saved but one or more files were not attached.`,
            );
            return;
          }

          setBrochures(remainingBrochures);
          setImages(remainingImages);
          setError(message);
          return;
        }

        // Edit flow: property fields are already saved — offer retry for remaining files.
        setUploadRetry({
          propertyId: property.id,
          marker: markerPayload,
          brochures: remainingBrochures,
          images: remainingImages,
          failedFileName,
          canRollback: false,
        });
        setBrochures(remainingBrochures);
        setImages(remainingImages);
        onUpdated?.(markerPayload);
        setError(
          `${message}. Your property details were saved, but one or more files were not attached.`,
        );
        return;
      }

      finishSave(markerPayload);
    } catch (err) {
      if (createdPropertyId) {
        try {
          await deletePropertyWithFiles(createdPropertyId);
        } catch (rollbackError) {
          console.error("Failed to roll back property after save error", rollbackError);
        }
      }
      const message =
        err instanceof Error ? err.message : "Something went wrong while saving.";
      setError(message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleRetryUploads() {
    if (!uploadRetry || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      await attachFiles(
        uploadRetry.propertyId,
        uploadRetry.brochures,
        uploadRetry.images,
      );
      setBrochures([]);
      setImages([]);
      setUploadRetry(null);
      finishSave(uploadRetry.marker);
    } catch (err) {
      const failedFileName =
        err && typeof err === "object" && "failedFileName" in err
          ? String((err as { failedFileName: string }).failedFileName)
          : uploadRetry.failedFileName;
      const remainingBrochures =
        err && typeof err === "object" && "remainingBrochures" in err
          ? ((err as { remainingBrochures: File[] }).remainingBrochures ?? [])
          : uploadRetry.brochures;
      const remainingImages =
        err && typeof err === "object" && "remainingImages" in err
          ? ((err as { remainingImages: File[] }).remainingImages ?? [])
          : uploadRetry.images;

      setUploadRetry({
        ...uploadRetry,
        brochures: remainingBrochures,
        images: remainingImages,
        failedFileName,
      });
      setBrochures(remainingBrochures);
      setImages(remainingImages);
      setError(uploadFailureMessage(failedFileName));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function handleContinueDespiteDuplicate() {
    // Ref must flip synchronously so the re-submit sees the acknowledgment.
    duplicateIgnoredRef.current = true;
    setDuplicate(null);
    queueMicrotask(() => {
      const formEl = document.getElementById(
        "add-property-form",
      ) as HTMLFormElement | null;
      formEl?.requestSubmit();
    });
  }

  function handleViewExistingDuplicate() {
    if (!duplicate) return;
    const id = duplicate.id;
    onClose();
    onViewExisting?.(id);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0 cursor-default"
        disabled={submitting}
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(90vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-zinc-900">
              {isEditing ? "Edit property" : "Add property"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {isEditing
                ? "Update details, re-geocode the address, and optionally add more files."
                : "Geocodes the address, uploads files, and drops a marker on the map."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form
          id="add-property-form"
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {error ? (
              <div
                role="alert"
                className="space-y-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                <p>{error}</p>
                {uploadRetry ? (
                  <button
                    type="button"
                    onClick={() => void handleRetryUploads()}
                    disabled={submitting}
                    className="rounded-md bg-red-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-900 disabled:opacity-60"
                  >
                    {submitting
                      ? "Retrying…"
                      : `Retry failed upload (${uploadRetry.failedFileName})`}
                  </button>
                ) : null}
              </div>
            ) : null}

            {duplicate ? (
              <div
                role="status"
                className="space-y-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950"
              >
                <p>
                  A similar property already exists: {duplicate.address}
                  {duplicate.postcode ? ` (${duplicate.postcode})` : ""} — do
                  you want to continue adding this as a new entry, or view the
                  existing one?
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleContinueDespiteDuplicate}
                    disabled={submitting}
                    className="rounded-md bg-amber-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-950 disabled:opacity-60"
                  >
                    Continue anyway
                  </button>
                  <button
                    type="button"
                    onClick={handleViewExistingDuplicate}
                    disabled={submitting}
                    className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
                  >
                    View existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicate(null)}
                    disabled={submitting}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Address
                </span>
                <input
                  required
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  aria-invalid={addressError != null}
                  className={[
                    "w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-zinc-500",
                    addressError
                      ? "border-red-400 focus:border-red-500"
                      : "border-zinc-300",
                  ].join(" ")}
                  placeholder="123 Example Street, London"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Postcode
                </span>
                <input
                  value={form.postcode}
                  onChange={(e) => updateField("postcode", e.target.value)}
                  aria-invalid={addressError != null}
                  className={[
                    "w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-zinc-500",
                    addressError
                      ? "border-red-400 focus:border-red-500"
                      : "border-zinc-300",
                  ].join(" ")}
                  placeholder="EC2A 4BX"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Status
                </span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    updateField("status", e.target.value as PropertyStatus)
                  }
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>

              {addressError ? (
                <p
                  role="alert"
                  className="sm:col-span-2 -mt-2 text-sm text-red-700"
                >
                  {addressError}
                </p>
              ) : null}

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Size (sq ft)
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.size_sqft}
                  onChange={(e) => updateField("size_sqft", e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Cost per sq ft
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.cost_per_sqft}
                  onChange={(e) => updateField("cost_per_sqft", e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Availability period
                </span>
                <input
                  value={form.availability_period}
                  onChange={(e) =>
                    updateField("availability_period", e.target.value)
                  }
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                  placeholder="H2 2027"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Agent name
                </span>
                <input
                  value={form.agent_name}
                  onChange={(e) => updateField("agent_name", e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Agent phone
                </span>
                <input
                  value={form.agent_phone}
                  onChange={(e) => updateField("agent_phone", e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Agent email
                </span>
                <input
                  type="email"
                  value={form.agent_email}
                  onChange={(e) => updateField("agent_email", e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Specs
                </span>
                <textarea
                  rows={3}
                  value={form.specs}
                  onChange={(e) => updateField("specs", e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Notes
                </span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
              </label>

              {isEditing ? (
                <div className="space-y-3 sm:col-span-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-zinc-700">
                      Existing brochures
                    </p>
                    {keptBrochures.length === 0 ? (
                      <p className="text-sm text-zinc-500">No brochures attached.</p>
                    ) : (
                      <ul className="space-y-2">
                        {keptBrochures.map((file, index) => (
                          <li
                            key={file.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
                          >
                            <a
                              href={file.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-sm text-zinc-800 underline decoration-zinc-300 underline-offset-2"
                            >
                              Brochure {index + 1}
                            </a>
                            <button
                              type="button"
                              onClick={() => removeExistingFile(file.id)}
                              className="rounded-md px-2 py-0.5 text-sm text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
                              aria-label="Remove brochure"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-zinc-700">
                      Existing images
                    </p>
                    {keptImages.length === 0 ? (
                      <p className="text-sm text-zinc-500">No images attached.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {keptImages.map((file) => (
                          <div
                            key={file.id}
                            className="relative aspect-square overflow-hidden rounded-md border border-zinc-200 bg-zinc-100"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={file.file_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeExistingFile(file.id)}
                              className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white hover:bg-black"
                              aria-label="Remove image"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  {isEditing ? "Add brochures (PDF)" : "Brochures (PDF)"}
                </span>
                <span className="mb-2 block text-xs text-zinc-500">
                  You can select multiple PDF brochures at once.
                </span>
                <input
                  type="file"
                  name="brochures"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={(e) => {
                    setBrochures(Array.from(e.target.files ?? []));
                    setUploadRetry(null);
                    e.target.value = "";
                  }}
                  className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-200"
                />
                {brochures.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    <li className="text-xs text-zinc-500">
                      {brochures.length} brochure
                      {brochures.length === 1 ? "" : "s"} selected
                    </li>
                    {brochures.map((file, index) => (
                      <li
                        key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
                      >
                        <span className="truncate text-sm text-zinc-800">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setBrochures((current) =>
                              current.filter((_, i) => i !== index),
                            )
                          }
                          className="rounded-md px-2 py-0.5 text-sm text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
                          aria-label={`Remove ${file.name}`}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  {isEditing ? "Add images" : "Images"}
                </span>
                <span className="mb-2 block text-xs text-zinc-500">
                  You can select multiple images at once (JPEG, PNG, WebP, or GIF).
                  Each image is uploaded separately and shown in the gallery.
                </span>
                <input
                  type="file"
                  name="images"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/*"
                  multiple
                  onChange={(e) => {
                    setImages(Array.from(e.target.files ?? []));
                    setUploadRetry(null);
                    e.target.value = "";
                  }}
                  className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-200"
                />
                {images.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    <li className="text-xs text-zinc-500">
                      {images.length} image{images.length === 1 ? "" : "s"} selected
                    </li>
                    {images.map((file, index) => (
                      <li
                        key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
                      >
                        <span className="truncate text-sm text-zinc-800">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setImages((current) =>
                              current.filter((_, i) => i !== index),
                            )
                          }
                          className="rounded-md px-2 py-0.5 text-sm text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
                          aria-label={`Remove ${file.name}`}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || duplicate != null}
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Save property"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
