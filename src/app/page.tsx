export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="max-w-lg text-center">
        <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
          Off-Market Tracker
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
          Property tracker is ready
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600">
          Next.js, Tailwind CSS, and Supabase are configured with open access.
          Connect your project credentials and apply the database migration to
          start tracking properties.
        </p>
        <ol className="mt-8 space-y-2 text-left text-sm leading-6 text-zinc-600">
          <li>1. Copy <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">.env.local.example</code> to <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">.env.local</code></li>
          <li>2. Add your Supabase URL and anon key</li>
          <li>3. Run <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">npx supabase db push</code> (or apply the migration in the SQL editor)</li>
        </ol>
      </div>
    </main>
  );
}
