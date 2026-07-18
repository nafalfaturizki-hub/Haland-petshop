'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { toast } from 'sonner';

export default function PetMonitoringPage() {
  const params = useParams<{ petId: string }>();
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/pets/${params.petId}`);
        if (response.ok) {
          const payload = await response.json();
          setPet(payload.pet ?? null);
        } else {
          toast.error('Data monitoring tidak tersedia.');
        }
      } catch {
        toast.error('Gagal memuat monitoring hewan.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [params.petId]);

  const summary = useMemo(() => ({
    weightLogs: pet?.weightLogs?.length ?? 0,
    appointments: pet?.appointments?.length ?? 0,
    medicalRecords: pet?.medicalRecords?.length ?? 0,
  }), [pet]);

  return (
    <ProtectedRoute module="customer-portal" action="read">
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Monitoring hewan</h1>
          <p className="mt-2 text-sm text-zinc-600">Pantau berat badan, rekam medis, vaksinasi, dan janji temu dari satu halaman.</p>
        </div>

        {loading ? <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Memuat data monitoring…</div> : null}

        {pet ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-900">Ringkasan</h2>
              <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                <li>Catatan berat: {summary.weightLogs}</li>
                <li>Janji temu: {summary.appointments}</li>
                <li>Rekam medis: {summary.medicalRecords}</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-900">Data hewan</h2>
              <p className="mt-3 text-sm text-zinc-700">{pet?.name ?? 'Hewan'}</p>
              <p className="text-sm text-zinc-500">{pet?.species ?? 'Spesies tidak tercatat'}</p>
            </div>
          </div>
        ) : null}
      </div>
    </ProtectedRoute>
  );
}
