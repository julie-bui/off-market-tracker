"use client";

import { useEffect, useId, useState, type FormEvent } from "react";

import { geocodeAddress } from "@/lib/geocode";
import { supabase } from "@/lib/supabase";
import {
  uploadBrochure,
  uploadPropertyImage,
  removePropertyFiles,
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

function specsToText(specs: Property["specs"] | unknown): string {
  if (specs == null) return "";

  if (typeof specs === "object" && !Array.isArray(specs)) {
    const record = specs as Record<string, unknown>;
    if (typeof record.text === "string") return specsToText(record.text);
    if (Object.keys(record).length === 0) return "";
    return "";
  }

  if (typeof specs === "string") {
    const trimmed = specs.trim();
    if (!trimmed) return "";
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        return specsToText(JSON.parse(trimmed));
      } catch {
        return specs;
      }
    }
    return specs;
  }

  return String(specs);
}

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
    specs: specsToText(property.specs),
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

export default function AddPropertyModal({
  open,
  onClose,
  onCreated,
  onUpdated,
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
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const address = form.address.trim();
    if (!address) {
      setError("Address is required.");
      return;
    }

    const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    if (!maptilerKey) {
      setError(
        "Missing NEXT_PUBLIC_MAPTILER_KEY. Add it to .env.local to geocode addresses.",
      );
      return;
    }

    const query = [address, form.postcode.trim()].filter(Boolean).join(", ");

    setSubmitting(true);

    try {
      const geocoded = await geocodeAddress(query, maptilerKey);

      const payload = {
        address,
        postcode: form.postcode.trim() || null,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        size_sqft: parseOptionalNumber(form.size_sqft),
        cost_per_sqft: parseOptionalNumber(form.cost_per_sqft),
        availability_period: form.availability_period.trim() || null,
        status: form.status,
        agent_name: form.agent_name.trim() || null,
        agent_phone: form.agent_phone.trim() || null,
        agent_email: form.agent_email.trim() || null,
        specs: form.specs.trim() || null,
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

      if (isEditing && removedFiles.length > 0) {
        await removePropertyFiles(removedFiles);
      }

      for (const [index, brochureFile] of brochures.entries()) {
        if (brochureFile.type !== "application/pdf") {
          throw new Error(`Brochure “${brochureFile.name}” must be a PDF file.`);
        }

        const brochureUrl = await uploadBrochure(
          property.id,
          brochureFile,
          index,
        );
        const { error: brochureError } = await supabase
          .from("property_files")
          .insert({
            property_id: property.id,
            file_url: brochureUrl,
            file_type: "brochure",
          });

        if (brochureError) {
          throw new Error(
            `Property saved, but brochure “${brochureFile.name}” failed: ${brochureError.message}`,
          );
        }
      }

      for (const [index, imageFile] of images.entries()) {
        if (!imageFile.type.startsWith("image/")) {
          throw new Error(`“${imageFile.name}” is not an image file.`);
        }

        const imageUrl = await uploadPropertyImage(
          property.id,
          imageFile,
          index,
        );
        const { error: imageError } = await supabase
          .from("property_files")
          .insert({
            property_id: property.id,
            file_url: imageUrl,
            file_type: "image",
          });

        if (imageError) {
          throw new Error(
            `Property saved, but image “${imageFile.name}” failed: ${imageError.message}`,
          );
        }
      }

      if (property.latitude == null || property.longitude == null) {
        throw new Error("Property saved without coordinates.");
      }

      const markerPayload = {
        id: property.id,
        address: property.address,
        latitude: property.latitude,
        longitude: property.longitude,
        status: (property.status ?? form.status) as PropertyStatus,
      };

      if (isEditing) {
        onUpdated?.(markerPayload);
      } else {
        onCreated(markerPayload);
      }
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong while saving.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {error ? (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {error}
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
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
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
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
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
              disabled={submitting}
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
