"use client";

import { useRef, useState } from "react";

import AddPropertyModal, {
  type CreatedPropertyMarker,
} from "@/components/AddPropertyModal";
import PropertyMap, {
  type PropertyMapHandle,
} from "@/components/PropertyMap";

export default function MapPageClient() {
  const mapRef = useRef<PropertyMapHandle>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);

  function openModal() {
    setModalKey((key) => key + 1);
    setModalOpen(true);
  }

  function handleCreated(property: CreatedPropertyMarker) {
    mapRef.current?.addMarker(property);
  }

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4 sm:p-6">
        <div className="pointer-events-auto rounded-md bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Off-Market Tracker
          </p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-zinc-900">
            London properties
          </h1>
        </div>

        <button
          type="button"
          onClick={openModal}
          className="pointer-events-auto rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
        >
          Add Property
        </button>
      </header>

      <div className="absolute inset-0">
        <PropertyMap ref={mapRef} />
      </div>

      <AddPropertyModal
        key={modalKey}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
