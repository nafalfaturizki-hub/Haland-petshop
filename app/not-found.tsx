export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 p-8 text-zinc-900">
      <div className="mx-auto max-w-2xl rounded-3xl border border-zinc-200 bg-white p-10 shadow-lg">
        <h1 className="text-4xl font-semibold text-zinc-900">404</h1>
        <p className="mt-4 text-lg text-zinc-700">Halaman yang Anda cari tidak ditemukan.</p>
        <p className="mt-2 text-sm text-zinc-500">Periksa URL atau kembali ke dashboard.</p>
      </div>
    </div>
  );
}
