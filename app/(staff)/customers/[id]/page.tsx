'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCustomer } from '@/actions/customer';

type CustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  pets?: Array<{ id: string; name: string }>;
  user?: { username: string; role: string; isActive: boolean } | null;
};

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');

      const result = await getCustomer(params.id);
      if (result.success) {
        setCustomer(result.customer as CustomerDetail);
      } else {
        setCustomer(null);
        setError(result.message ?? 'Gagal memuat detail pelanggan.');
      }

      setLoading(false);
    }

    void load();
  }, [params.id]);

  if (loading) {
    return <div className="rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">Memuat detail pelanggan...</div>;
  }

  if (error || !customer) {
    return (
      <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-rose-600">{error || 'Data pelanggan tidak ditemukan.'}</p>
        <Link href="/customers" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke daftar pelanggan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <Link href="/customers" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
        <p className="text-sm text-zinc-500">Detail Pelanggan</p>
        <h1 className="text-xl font-semibold text-zinc-900">{customer.name}</h1>
        <p className="mt-2 text-sm text-zinc-600">Telepon: {customer.phone || '-'}</p>
        <p className="mt-2 text-sm text-zinc-600">Username login: {customer.user?.username ?? '-'}</p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Informasi tambahan</h2>
        <p className="mt-2 text-sm text-zinc-600">Alamat: {customer.address || '-'}</p>
        <p className="mt-2 text-sm text-zinc-600">Catatan: {customer.notes || '-'}</p>
        <p className="mt-2 text-sm text-zinc-600">Jumlah hewan: {customer.pets?.length ?? 0}</p>
      </div>
    </div>
  );
}
