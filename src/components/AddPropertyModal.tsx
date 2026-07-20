"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { geocodeAddress } from "@/lib/geocode";
import { supabase } from "@/lib/supabase";
import {
  uploadBrochure,
  uploadPropertyImages,
} from "@/lib/property-uploads";
import type {
  PropertySector,
  PropertyStatus,
} from "@/types/database";

const SECTORS: PropertySector[] = [
  "office",
  "retail",
  "industrial",
  "residential",
  "mixed-use",
];

const STATUSES: PropertyStatus[] = [
  "available",
  "under_offer",
  "let",
  "withdrawn",
];

const TENURES = ["freehold", "leasehold"] as const;
type Tenure = (typeof TENURES)[number];

export type CreatedPropertyMarker = {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
};

type AddPropertyModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (property: CreatedPropertyMarker) => void;
};

type FormState = {
  address: string;
  postcode: string;
  sector: PropertySector | "";
  size_sqft: string;
  cost_per_sqft: string;
  availability_period: string;
  status: PropertyStatus;
  tenure: Tenure | "";
  lease_length: string;
  agent_name: string;
  agent_phone: string;
  agent_email: string;
  specs: string;
  notes: string;
};

const INITIAL_FORM: FormState = {
  address: "",
  postcode: "",
  sector: "",
  size_sqft: "",
  cost_per_sqft: "",
  availability_period: "",
  status: "available",
  tenure: "",
  lease_length: "",
  agent_name: "",
  agent_phone: "",
  agent_email: "",
  specs: "",
  notes: "",
};

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusLabel(status: PropertyStatus): string {
  return status.replaceAll("_", " ");
}

export default function AddPropertyModal({
  open,
  onClose,
  onCreated,
}: AddPropertyModalProps) {
  const titleId = useId();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [brochure, setBrochure] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
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

  const totalPrice = useMemo(() => {
    const size = parseOptionalNumber(form.size_sqft);
    const cost = parseOptionalNumber(form.cost_per_sqft);
    if (size == null || cost == null) return null;
    return size * cost;
  }, [form.size_sqft, form.cost_per_sqft]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

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

      const sizeSqft = parseOptionalNumber(form.size_sqft);
      const costPerSqft = parseOptionalNumber(form.cost_per_sqft);
      const tenure = form.tenure || null;
      const leaseLength =
        tenure === "leasehold" ? form.lease_length.trim() || null : null;

      const { data: property, error: insertError } = await supabase
        .from("properties")
        .insert({
          address,
          postcode: form.postcode.trim() || null,
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
          sector: form.sector || null,
          size_sqft: sizeSqft,
          cost_per_sqft: costPerSqft,
          availability_period: form.availability_period.trim() || null,
          status: form.status,
          tenure,
          lease_length: leaseLength,
          agent_name: form.agent_name.trim() || null,
          agent_phone: form.agent_phone.trim() || null,
          agent_email: form.agent_email.trim() || null,
          specs: form.specs.trim() ? { text: form.specs.trim() } : {},
          notes: form.notes.trim() || null,
        })
        .select("id, address, latitude, longitude")
        .single();

      if (insertError || !property) {
        throw new Error(
          insertError?.message ?? "Failed to save the property record.",
        );
      }

      const fileRows: Array<{
        property_id: string;
        file_url: string;
        file_type: "brochure" | "image";
      }> = [];

      if (brochure) {
        if (brochure.type !== "application/pdf") {
          throw new Error("Brochure must be a PDF file.");
        }
        const brochureUrl = await uploadBrochure(property.id, brochure);
        fileRows.push({
          property_id: property.id,
          file_url: brochureUrl,
          file_type: "brochure",
        });
      }

      if (images.length > 0) {
        const imageUrls = await uploadPropertyImages(property.id, images);
        for (const file_url of imageUrls) {
          fileRows.push({
            property_id: property.id,
            file_url,
            file_type: "image",
          });
        }
      }

      if (fileRows.length > 0) {
        const { error: filesError } = await supabase
          .from("property_files")
          .insert(fileRows);

        if (filesError) {
          throw new Error(
            `Property saved, but file records failed: ${filesError.message}`,
          );
        }
      }

      if (property.latitude == null || property.longitude == null) {
        throw new Error("Property saved without coordinates.");
      }

      onCreated({
        id: property.id,
        address: property.address,
        latitude: property.latitude,
        longitude: property.longitude,
      });
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
              Add property
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Geocodes the address, uploads files, and drops a marker on the map.
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
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
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
                  Sector
                </span>
                <select
                  value={form.sector}
                  onChange={(e) =>
                    updateField("sector", e.target.value as PropertySector | "")
                  }
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                >
                  <option value="">Select sector</option>
                  {SECTORS.map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
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

              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 sm:col-span-2">
                <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Total price
                </p>
                <p className="mt-1 text-base font-semibold text-zinc-900">
                  {totalPrice == null ? "—" : formatCurrency(totalPrice)}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  size_sqft × cost_per_sqft
                </p>
              </div>

              <label className="block">
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
                  Tenure
                </span>
                <select
                  value={form.tenure}
                  onChange={(e) =>
                    updateField("tenure", e.target.value as Tenure | "")
                  }
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                >
                  <option value="">Select tenure</option>
                  {TENURES.map((tenure) => (
                    <option key={tenure} value={tenure}>
                      {tenure}
                    </option>
                  ))}
                </select>
              </label>

              {form.tenure === "leasehold" ? (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-zinc-700">
                    Lease length
                  </span>
                  <input
                    value={form.lease_length}
                    onChange={(e) => updateField("lease_length", e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                    placeholder="10 years"
                  />
                </label>
              ) : null}

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

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Brochure (PDF)
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setBrochure(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-200"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Images
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={(e) =>
                    setImages(Array.from(e.target.files ?? []))
                  }
                  className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-200"
                />
                {images.length > 0 ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {images.length} image{images.length === 1 ? "" : "s"} selected
                  </p>
                ) : null}
              </label>
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
              {submitting ? "Saving…" : "Save property"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
