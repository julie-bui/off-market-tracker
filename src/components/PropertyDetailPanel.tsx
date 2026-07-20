"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { supabase } from "@/lib/supabase";
import { deletePropertyWithFiles } from "@/lib/property-uploads";
import { formatSpecsForDisplay } from "@/lib/specs";
import { buildStreetViewUrl, openStreetView } from "@/lib/street-view";
import type { Property, PropertyFile } from "@/types/database";

type PropertyDetailPanelProps = {
  propertyId: string | null;
  onClose: () => void;
  onEdit: (property: Property, files: PropertyFile[]) => void;
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

type ImageCarouselProps = {
  images: PropertyFile[];
  onOpen: (url: string) => void;
};

function ImageCarousel({ images, onOpen }: ImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const dragDeltaX = useRef(0);
  const didSwipe = useRef(false);

  if (images.length === 0) {
    return null;
  }

  const count = images.length;
  const safeIndex = ((index % count) + count) % count;
  const current = images[safeIndex];

  function goTo(next: number) {
    setIndex(((next % count) + count) % count);
  }

  function goPrev() {
    goTo(safeIndex - 1);
  }

  function goNext() {
    goTo(safeIndex + 1);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    dragStartX.current = event.clientX;
    dragDeltaX.current = 0;
    didSwipe.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragStartX.current == null) return;
    dragDeltaX.current = event.clientX - dragStartX.current;
  }

  function onPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragStartX.current == null) return;

    const delta = dragDeltaX.current;
    dragStartX.current = null;
    dragDeltaX.current = 0;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore if capture already released
    }

    if (Math.abs(delta) < 40) return;
    didSwipe.current = true;
    if (delta < 0) goNext();
    else goPrev();
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 select-none">
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={() => {
            if (didSwipe.current) {
              didSwipe.current = false;
              return;
            }
            onOpen(current.file_url);
          }}
          className="absolute inset-0 touch-pan-y"
          aria-label="Open image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current.id}
            src={current.file_url}
            alt=""
            className="pointer-events-none h-full w-full object-cover"
            draggable={false}
          />
        </button>

        {count > 1 ? (
          <>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                goPrev();
              }}
              className="absolute top-1/2 left-2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-lg leading-none text-white hover:bg-black/70"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                goNext();
              }}
              className="absolute top-1/2 right-2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-lg leading-none text-white hover:bg-black/70"
              aria-label="Next image"
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="flex items-center justify-center gap-1.5">
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setIndex(i)}
              className={[
                "h-2 w-2 rounded-full transition-colors",
                i === safeIndex ? "bg-zinc-800" : "bg-zinc-300 hover:bg-zinc-400",
              ].join(" ")}
              aria-label={`Go to image ${i + 1}`}
              aria-current={i === safeIndex ? "true" : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type PropertyDetailContentProps = {
  propertyId: string;
  onClose: () => void;
  onEdit: (property: Property, files: PropertyFile[]) => void;
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
          .select("id, property_id, file_url, file_type, created_at")
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

      if (filesResult.error) {
        setProperty(propertyResult.data as Property);
        setFiles([]);
        setError(`Could not load property files: ${filesResult.error.message}`);
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
      `Delete “${property.address}”? This removes the property and its files from storage. This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await deletePropertyWithFiles(propertyId);
      onDeleted(propertyId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete this property.",
      );
      setDeleting(false);
    }
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
            {images.length > 0 ? (
              <section className="mb-5">
                <ImageCarousel images={images} onOpen={setLightboxUrl} />
              </section>
            ) : null}

            {property.latitude != null && property.longitude != null ? (
              <section className="mb-5">
                <a
                  href={buildStreetViewUrl(
                    property.latitude,
                    property.longitude,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => {
                    event.preventDefault();
                    openStreetView(property.latitude!, property.longitude!);
                  }}
                  className="inline-flex w-full items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-900 hover:border-zinc-300 hover:bg-zinc-100"
                >
                  View on Street View
                </a>
              </section>
            ) : null}

            <section className="mb-5">
              <h3 className="text-sm font-semibold text-zinc-900">Brochures</h3>
              {brochures.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No brochures attached.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {brochures.map((brochure, index) => (
                    <a
                      key={brochure.id}
                      href={brochure.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-900 hover:border-zinc-300 hover:bg-zinc-100"
                    >
                      {brochures.length === 1
                        ? "View Brochure"
                        : `View Brochure ${index + 1}`}
                    </a>
                  ))}
                </div>
              )}
            </section>

            <dl>
              <DetailRow label="Address" value={property.address} />
              <DetailRow label="Postcode" value={property.postcode ?? "—"} />
              <DetailRow
                label="Size (sq ft)"
                value={formatNumber(property.size_sqft)}
              />
              <DetailRow
                label="Cost / sq ft"
                value={formatCurrency(property.cost_per_sqft)}
              />
              <DetailRow
                label="Availability"
                value={property.availability_period ?? "—"}
              />
              <DetailRow label="Status" value={formatLabel(property.status)} />
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
              <DetailRow label="Specs" value={formatSpecsForDisplay(property.specs)} />
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
          </>
        ) : null}
      </div>

      {property ? (
        <div className="flex gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <button
            type="button"
            onClick={() => onEdit(property, files)}
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
