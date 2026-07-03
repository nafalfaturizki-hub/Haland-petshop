'use client';

import { useState } from 'react';
import { LogOut, Search as SearchIcon } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { NotificationBell } from './notification-bell';
import { searchGlobal } from '@/actions/search';

export function Navbar() {
  const { data: session } = useSession();
  const userName = session?.user?.name ?? 'Pengguna';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ category: string; items: Array<{ id: string; title: string; subtitle: string; href: string }> }> | null>(null);
  const [message, setMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setMessage('Masukkan kata kunci pencarian.');
      return;
    }

    setIsSearching(true);
    setMessage('');
    setResults(null);

    const result = await searchGlobal({ query: trimmedQuery });
    if (result.success) {
      setResults(result.data?.results ?? []);
      if ((result.data?.results ?? []).length === 0) {
        setMessage('Tidak ada hasil yang cocok.');
      }
      return;
    }

    setResults(null);
    setMessage(result.message ?? 'Pencarian gagal.');
    setIsSearching(false);
  }

  return (
    <header className="border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Haland Petcare</p>
          <h1 className="text-base font-semibold text-zinc-900">Halo, {userName}</h1>
        </div>

        <div className="flex flex-1 items-center gap-3">
          <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 shadow-sm sm:max-w-xl">
            <SearchIcon className="h-4 w-4 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (!event.target.value.trim()) {
                  setResults([]);
                  setMessage('');
                }
              }}
              placeholder="Pencarian global..."
              className="w-full bg-transparent text-sm outline-none"
              aria-label="Kata kunci pencarian"
            />
            <button type="submit" disabled={isSearching} className="rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" aria-busy={isSearching}>
              {isSearching ? 'Mencari...' : 'Cari'}
            </button>
          </form>
          <NotificationBell />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
            aria-label="Keluar dari sistem"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>

      {results ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          {results.length === 0 ? (
            <p className="text-sm text-zinc-500">Tidak ada hasil pencarian.</p>
          ) : (
            <div className="space-y-4">
              {results.map((group) => (
                <div key={group.category}>
                  <p className="text-sm font-semibold text-zinc-700">{group.category}</p>
                  <div className="mt-2 space-y-2">
                    {group.items.map((item) => (
                      <a key={item.id} href={item.href} className="block rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-zinc-500">{item.subtitle}</p>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {message ? <p className="mt-2 text-sm text-rose-600" role="status">{message}</p> : null}
    </header>
  );
}
