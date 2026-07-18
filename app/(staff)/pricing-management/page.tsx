'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { usePermissions } from '@/hooks/use-permissions';

export default function PricingManagementPage() {
  const { isOwner } = usePermissions();
  const [csvText, setCsvText] = useState('');
  const [reason, setReason] = useState('');

  const preview = useMemo(() => {
    if (!csvText.trim()) return [];
    return csvText
      .trim()
      .split(/\n/)
      .slice(1)
      .filter(Boolean)
      .map((line) => line.split(','));
  }, [csvText]);

  if (!isOwner) {
    return (
      <ProtectedRoute module="petshop" action="pricing">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Anda tidak memiliki akses ke manajemen harga.</div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute module="petshop" action="pricing">
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Manajemen harga owner</h1>
          <p className="mt-2 text-sm text-zinc-600">Upload CSV harga, simpan riwayat perubahan, dan pastikan margin minimum 15%.</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <label className="block text-sm text-zinc-600">
            CSV harga
            <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} rows={8} className="mt-2 w-full rounded-2xl border border-zinc-200 px-3 py-2" placeholder="name,price,reason" />
          </label>
          <label className="mt-4 block text-sm text-zinc-600">
            Alasan override
            <input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-200 px-3 py-2" placeholder="Contoh: promo owner" />
          </label>
          <button type="button" onClick={() => toast.success('Preview siap. Integrasi server action dapat ditambahkan sesuai kebutuhan.')} className="mt-4 rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Pratinjau</button>
        </div>

        {preview.length > 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Preview upload</h2>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-zinc-50 p-3 text-xs text-zinc-700">{preview.map((row) => row.join(',')).join('\n')}</pre>
          </div>
        ) : null}
      </div>
    </ProtectedRoute>
  );
}
