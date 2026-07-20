import PropertyMap from "@/components/PropertyMap";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-6">
        <div className="pointer-events-auto rounded-md bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Off-Market Tracker
          </p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-zinc-900">
            London properties
          </h1>
        </div>
      </header>
      <div className="absolute inset-0">
        <PropertyMap />
      </div>
    </main>
  );
}
