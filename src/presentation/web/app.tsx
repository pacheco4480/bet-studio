export function App() {
  return (
    <main className="min-h-screen bg-studio-ink text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-studio-lime">
          Bet Studio
        </p>
        <h1 className="mt-5 max-w-3xl text-5xl font-bold leading-tight sm:text-6xl">
          Local-first football bulletin production.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          A focused foundation for deterministic betting bulletin workflows,
          structured data, and professional social-media exports.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {['React + Vite', 'Fastify API', 'Deterministic Core'].map(
            (label) => (
              <div
                key={label}
                className="rounded border border-white/10 bg-studio-panel p-4"
              >
                <span className="text-sm font-medium text-slate-200">
                  {label}
                </span>
              </div>
            ),
          )}
        </div>
      </section>
    </main>
  );
}
