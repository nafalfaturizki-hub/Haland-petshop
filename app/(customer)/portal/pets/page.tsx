'use client';

import { useEffect, useState } from 'react';
import { listPets } from '@/actions/pet';

type PetSummary = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  birthDate: string | null;
  gender: string | null;
  photo: string | null;
};

export default function CustomerPetsPage() {
  const [pets, setPets] = useState<PetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      const result = await listPets();
      if (result.success) {
        setPets(result.pets as PetSummary[]);
      } else {
        setError(result.message ?? 'Gagal memuat data hewan.');
      }
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Portal Pelanggan</p>
        <h1 className="text-xl font-semibold text-zinc-900">Hewan peliharaan Anda</h1>
      </div>

      {loading ? <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Memuat data hewan...</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error && pets.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Belum ada data hewan yang terhubung dengan akun Anda.</div>
      ) : null}

      {!loading && !error && pets.length > 0 ? (
        pets.map((pet) => (
          <div key={pet.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">{pet.name}</h2>
                <p className="mt-1 text-sm text-zinc-600">{pet.species} • {pet.breed || '-'} • {pet.gender || '-'}</p>
                <p className="mt-2 text-sm text-zinc-500">Lahir: {pet.birthDate ? new Date(pet.birthDate).toLocaleDateString('id-ID') : '-'}</p>
              </div>
              {pet.photo ? <img src={pet.photo} alt={pet.name} className="h-16 w-16 rounded-lg object-cover" /> : null}
            </div>
          </div>
        ))
      ) : null}
    </div>
  );
}
