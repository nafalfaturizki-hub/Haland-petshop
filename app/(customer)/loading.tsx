export default function CustomerLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 p-8 text-zinc-900">
      <div className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm">
        <div className="h-10 w-48 animate-pulse rounded-full bg-zinc-200" />
        <div className="space-y-4">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-3xl bg-zinc-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
