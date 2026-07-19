'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSession, signIn, useSession } from 'next-auth/react';

export default function LoginPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      const role = (session.user as { role?: string } | undefined)?.role;
      const mustChangePin = Boolean((session.user as { mustChangePin?: boolean } | undefined)?.mustChangePin);
      router.replace(mustChangePin ? '/change-pin' : role === 'CUSTOMER' ? '/portal' : '/dashboard');
    }
  }, [router, session]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await signIn('credentials', {
        username: username.trim(),
        pin,
        redirect: false,
      });

      if (result?.ok) {
        const activeSession = await getSession();
        const role = (activeSession?.user as { role?: string } | undefined)?.role;
        const mustChangePin = Boolean((activeSession?.user as { mustChangePin?: boolean } | undefined)?.mustChangePin);
        router.refresh();
        router.replace(mustChangePin ? '/change-pin' : role === 'CUSTOMER' ? '/portal' : '/dashboard');
        return;
      }

      setError('Username atau PIN salah, atau akun sedang dikunci.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl">
        <div className="mb-8 space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Haland Petcare</p>
          <h1 className="text-2xl font-semibold">Masuk ke sistem</h1>
          <p className="text-sm text-zinc-400">Gunakan username dan PIN 6 digit Anda.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="mb-2 block text-zinc-400">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none ring-0"
              placeholder="contoh: haland.petcare"
              autoComplete="username"
              required
            />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block text-zinc-400">PIN</span>
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-center text-lg tracking-[0.4em] outline-none ring-0"
              placeholder="●●●●●●"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
          </label>

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-zinc-100 px-4 py-3 font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </main>
  );
}
