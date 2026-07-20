"use client";

import { useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/lib/supabase";
import type { Property, PropertyFile } from "@/types/database";

type PropertyDetailPanelProps = {
  propertyId: string | null;
  onClose: () => void;
  onEdit: (property: Property) => void;
  onDeleted: (propertyId: string) => void;
  /** Bump to force a refresh after an edit save */
  refreshToken?: number;
};

function formatCurrency(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function formatSpecs(specs: Property["specs"]): string {
  if (specs == null) return "—";
  if (typeof specs === "string") return specs || "—";
  if (typeof specs === "object" && !Array.isArray(specs)) {
    const text = specs.text;
    if (typeof text === "string" && text.trim()) return text;
    const keys = Object.keys(specs);
    if (keys.length === 0) return "—";
    return JSON.stringify(specs, null, 2);
  }
  return String(specs);
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-zinc-100 py-2.5 text-sm last:border-b-0">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-zinc-900">{value}</dd>
    </div>
  );
}

type PropertyDetailContentProps = {
  propertyId: string;
  onClose: () => void;
  onEdit: (property: Property) => void;
  onDeleted: (propertyId: string) => void;
  refreshToken: number;
};

function PropertyDetailContent({
  propertyId,
  onClose,
  onEdit,
  onDeleted,
  refreshToken,
}: PropertyDetailContentProps) {
  const [property, setProperty] = useState<Property | null>(null);
  const [files, setFiles] = useState<PropertyFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [propertyResult, filesResult] = await Promise.all([
        supabase.from("properties").select("*").eq("id", propertyId).single(),
        supabase
          .from("property_files")
          .select("*")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      if (propertyResult.error || !propertyResult.data) {
        setProperty(null);
        setFiles([]);
        setError(
          propertyResult.error?.message ?? "Could not load this property.",
        );
        setLoading(false);
        return;
      }

      setProperty(propertyResult.data as Property);
      setFiles((filesResult.data ?? []) as PropertyFile[]);
      setLoading(false);
      setError(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [propertyId, refreshToken]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (lightboxUrl) {
          setLightboxUrl(null);
          return;
        }
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, lightboxUrl]);

  async function handleDelete() {
    if (!property) return;

    const confirmed = window.confirm(
      `Delete “${property.address}”? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("properties")
      .delete()
      .eq("id", propertyId);

    setDeleting(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    onDeleted(propertyId);
  }

  const images = files.filter((file) => file.file_type === "image");
  const brochures = files.filter((file) => file.file_type === "brochure");

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Property
          </p>
          <h2 className="truncate text-lg font-semibold text-zinc-900">
            {property?.address ?? (loading ? "Loading…" : "Details")}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          aria-label="Close property panel"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {error ? (
          <div
            role="alert"
            className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        {loading && !property ? (
          <p className="text-sm text-zinc-500">Loading property details…</p>
        ) : null}

        {property ? (
          <>
            <dl>
              <DetailRow label="Address" value={property.address} />
              <DetailRow label="Postcode" value={property.postcode ?? "—"} />
              <DetailRow label="Sector" value={formatLabel(property.sector)} />
              <DetailRow
                label="Size (sq ft)"
                value={formatNumber(property.size_sqft)}
              />
              <DetailRow
                label="Cost / sq ft"
                value={formatCurrency(property.cost_per_sqft)}
              />
              <DetailRow
                label="Total price"
                value={formatCurrency(property.total_price)}
              />
              <DetailRow
                label="Availability"
                value={property.availability_period ?? "—"}
              />
              <DetailRow label="Status" value={formatLabel(property.status)} />
              <DetailRow label="Tenure" value={formatLabel(property.tenure)} />
              {property.tenure === "leasehold" || property.lease_length ? (
                <DetailRow
                  label="Lease length"
                  value={property.lease_length ?? "—"}
                />
              ) : null}
              <DetailRow label="Agent name" value={property.agent_name ?? "—"} />
              <DetailRow
                label="Agent phone"
                value={
                  property.agent_phone ? (
                    <a
                      href={`tel:${property.agent_phone}`}
                      className="text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
                    >
                      {property.agent_phone}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow
                label="Agent email"
                value={
                  property.agent_email ? (
                    <a
                      href={`mailto:${property.agent_email}`}
                      className="text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
                    >
                      {property.agent_email}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow label="Specs" value={formatSpecs(property.specs)} />
              <DetailRow label="Notes" value={property.notes ?? "—"} />
              <DetailRow
                label="Created"
                value={formatDateTime(property.created_at)}
              />
              <DetailRow
                label="Updated"
                value={formatDateTime(property.last_updated_at)}
              />
            </dl>

            <section className="mt-5">
              <h3 className="text-sm font-semibold text-zinc-900">Images</h3>
              {images.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No images attached.</p>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setLightboxUrl(image.file_url)}
                      className="aspect-square overflow-hidden rounded-md border border-zinc-200 bg-zinc-100"
                      aria-label="Open image"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.file_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-5">
              <h3 className="text-sm font-semibold text-zinc-900">Brochure</h3>
              {brochures.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No brochure attached.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {brochures.map((brochure, index) => (
                    <li key={brochure.id}>
                      <a
                        href={brochure.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-700"
                      >
                        View / download brochure
                        {brochures.length > 1 ? ` ${index + 1}` : ""}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>

      {property ? (
        <div className="flex gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <button
            type="button"
            onClick={() => onEdit(property)}
            disabled={deleting}
            className="flex-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="flex-1 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      ) : null}

      {lightboxUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close image"
            onClick={() => setLightboxUrl(null)}
          />
          <div className="relative z-10 max-h-full max-w-5xl">
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-10 right-0 rounded-md px-2 py-1 text-sm text-white/90 hover:bg-white/10"
            >
              Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Property"
              className="max-h-[85vh] max-w-full rounded-md object-contain shadow-2xl"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function PropertyDetailPanel({
  propertyId,
  onClose,
  onEdit,
  onDeleted,
  refreshToken = 0,
}: PropertyDetailPanelProps) {
  const open = propertyId != null;

  return (
    <aside
      className={[
        "pointer-events-auto absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-300 ease-out",
        open ? "translate-x-0" : "translate-x-full",
      ].join(" ")}
      aria-hidden={!open}
      {...(open
        ? {
            role: "dialog",
            "aria-modal": false,
            "aria-label": "Property details",
          }
        : {})}
    >
      {propertyId ? (
        <PropertyDetailContent
          key={`${propertyId}-${refreshToken}`}
          propertyId={propertyId}
          onClose={onClose}
          onEdit={onEdit}
          onDeleted={onDeleted}
          refreshToken={refreshToken}
        />
      ) : null}
    </aside>
  );
}
