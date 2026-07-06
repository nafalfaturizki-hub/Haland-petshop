'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-zinc-50 p-8 text-zinc-900">
      <div className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-white p-10 shadow-lg">
        <h1 className="text-3xl font-semibold text-rose-700">Terjadi kesalahan</h1>
        <p className="mt-4 text-sm text-zinc-600">Maaf, ada masalah saat memuat halaman ini.</p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-zinc-100 p-4 text-xs text-zinc-700">{error.message}</pre>
        <button type="button" onClick={reset} className="mt-6 inline-flex rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
          Muat ulang
        </button>
      </div>
    </div>
  );
}
