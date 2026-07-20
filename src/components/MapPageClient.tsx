"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AddPropertyModal, {
  type CreatedPropertyMarker,
} from "@/components/AddPropertyModal";
import PropertyDetailPanel from "@/components/PropertyDetailPanel";
import PropertyMap, {
  type PropertyMapHandle,
} from "@/components/PropertyMap";
import { supabase } from "@/lib/supabase";
import type { Property, PropertyFile } from "@/types/database";

export default function MapPageClient() {
  const router = useRouter();
  const mapRef = useRef<PropertyMapHandle>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [propertyToEdit, setPropertyToEdit] = useState<Property | null>(null);
  const [filesToEdit, setFilesToEdit] = useState<PropertyFile[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );
  const [detailRefreshToken, setDetailRefreshToken] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const openCreateModal = useCallback(() => {
    setPropertyToEdit(null);
    setFilesToEdit([]);
    setModalKey((key) => key + 1);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback(
    (property: Property, files: PropertyFile[]) => {
      setPropertyToEdit(property);
      setFilesToEdit(files);
      setModalKey((key) => key + 1);
      setModalOpen(true);
    },
    [],
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setPropertyToEdit(null);
    setFilesToEdit([]);
  }, []);

  const handleCreated = useCallback((property: CreatedPropertyMarker) => {
    mapRef.current?.addMarker(property);
    setSelectedPropertyId(property.id);
  }, []);

  const handleUpdated = useCallback((property: CreatedPropertyMarker) => {
    mapRef.current?.updateMarker(property);
    setSelectedPropertyId(property.id);
    setDetailRefreshToken((token) => token + 1);
  }, []);

  const handleDeleted = useCallback((propertyId: string) => {
    mapRef.current?.removeMarker(propertyId);
    setSelectedPropertyId(null);
  }, []);

  const handlePropertySelect = useCallback((propertyId: string) => {
    setSelectedPropertyId(propertyId);
  }, []);

  const handleMapBackgroundClick = useCallback(() => {
    setSelectedPropertyId(null);
  }, []);

  const handleViewExisting = useCallback((propertyId: string) => {
    setSelectedPropertyId(propertyId);
  }, []);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }, [router]);

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 p-4 sm:p-6">
        <div className="pointer-events-auto flex flex-col items-start gap-3">
          <div className="rounded-md bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
              Off-Market Tracker
            </p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-zinc-900">
              London properties
            </h1>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
          >
            Add Property
          </button>
        </div>

        {/*
          Position with absolute right/top — not flex + margin.
          justify-between + mr-* looked like a no-op next to MapLibre's
          fixed top-right NavigationControl.
        */}
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="pointer-events-auto absolute top-4 right-[100px] z-10 rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm backdrop-blur hover:bg-white disabled:opacity-60 sm:top-6"
        >
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      </header>

      <div className="absolute inset-0">
        <PropertyMap
          ref={mapRef}
          onPropertySelect={handlePropertySelect}
          onMapBackgroundClick={handleMapBackgroundClick}
        />
      </div>

      <PropertyDetailPanel
        propertyId={selectedPropertyId}
        onClose={() => setSelectedPropertyId(null)}
        onEdit={openEditModal}
        onDeleted={handleDeleted}
        refreshToken={detailRefreshToken}
      />

      <AddPropertyModal
        key={modalKey}
        open={modalOpen}
        onClose={closeModal}
        onCreated={handleCreated}
        onUpdated={handleUpdated}
        onViewExisting={handleViewExisting}
        propertyToEdit={propertyToEdit}
        existingFiles={filesToEdit}
      />
    </>
  );
}
