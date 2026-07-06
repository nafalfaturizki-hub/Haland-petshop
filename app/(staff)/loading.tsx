export default function StaffLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 p-8 text-zinc-900">
      <div className="mx-auto max-w-4xl space-y-6 rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm">
        <div className="h-10 w-64 animate-pulse rounded-full bg-zinc-200" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl bg-zinc-100" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-4 w-full animate-pulse rounded-full bg-zinc-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
