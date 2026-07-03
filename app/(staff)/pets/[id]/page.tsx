'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getPet } from '@/actions/pet';

type PetDetail = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  birthDate: string | null;
  gender: string | null;
  photo: string | null;
  customer?: { name: string; phone: string | null } | null;
  weightLogs?: Array<{ id: string; date: Date; weight: number }>;
  vaccineRecords?: Array<{ id: string; vaccineName: string; date: Date; nextDueDate: Date | null }>;
  diseaseRecords?: Array<{ id: string; diseaseName: string; note: string | null; date: Date }>;
  allergies?: Array<{ id: string; allergen: string; note: string | null }>;
  appointments?: Array<{ id: string; date: Date; status: string }>;
  medicalRecords?: Array<{ id: string; diagnosis: string | null; date: Date }>;
};

function calculateAge(birthDate: string | null) {
  if (!birthDate) return '-';

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return '-';

  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const adjustedMonths = months < 0 ? months + 12 : months;
  const adjustedYears = months < 0 ? years - 1 : years;

  if (adjustedYears > 0) return `${adjustedYears} tahun ${adjustedMonths} bulan`;
  return `${adjustedMonths} bulan`;
}

export default function PetDetailPage() {
  const params = useParams<{ id: string }>();
  const [pet, setPet] = useState<PetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      const result = await getPet(params.id);

      if (result.success) {
        setPet(result.pet as PetDetail);
      } else {
        setPet(null);
        setError(result.message ?? 'Gagal memuat detail hewan.');
      }

      setLoading(false);
    }
    void load();
  }, [params.id]);

  if (loading) return <div className="rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">Memuat detail hewan...</div>;

  if (error || !pet) {
    return (
      <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-rose-600">{error || 'Data hewan tidak ditemukan.'}</p>
        <Link href="/pets" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke daftar hewan
        </Link>
      </div>
    );
  }

  const weightData = (pet.weightLogs ?? []).map((log) => ({ name: new Date(log.date).toISOString().slice(0, 10), weight: log.weight }));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <Link href="/pets" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm text-zinc-500">Detail Hewan</p>
            <h1 className="text-xl font-semibold text-zinc-900">{pet.name}</h1>
            <p className="mt-2 text-sm text-zinc-600">{pet.species} • {pet.breed || '-'} • {pet.gender || '-'}</p>
          </div>
          {pet.photo ? <img src={pet.photo} alt={pet.name} className="h-24 w-24 rounded-xl object-cover" /> : null}
        </div>
        <div className="mt-4 grid gap-3 text-sm text-zinc-600 md:grid-cols-3">
          <div>Pemilik: {pet.customer?.name ?? '-'}</div>
          <div>Tanggal lahir: {pet.birthDate ? new Date(pet.birthDate).toLocaleDateString('id-ID') : '-'}</div>
          <div>Usia: {calculateAge(pet.birthDate)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Grafik Berat Badan</h2>
        {weightData.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Belum ada catatan berat badan.</p> : <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={weightData}><CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Line type="monotone" dataKey="weight" stroke="#111827" strokeWidth={2} /></LineChart></ResponsiveContainer></div>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-zinc-900">Riwayat Vaksin</h3>
          {pet.vaccineRecords?.length ? <ul className="mt-3 space-y-2 text-sm text-zinc-600">{pet.vaccineRecords.map((record) => <li key={record.id}>• {record.vaccineName} ({new Date(record.date).toLocaleDateString('id-ID')})</li>)}</ul> : <p className="mt-3 text-sm text-zinc-500">Belum ada data vaksin.</p>}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-zinc-900">Riwayat Penyakit</h3>
          {pet.diseaseRecords?.length ? <ul className="mt-3 space-y-2 text-sm text-zinc-600">{pet.diseaseRecords.map((record) => <li key={record.id}>• {record.diseaseName} {record.note ? `- ${record.note}` : ''}</li>)}</ul> : <p className="mt-3 text-sm text-zinc-500">Belum ada riwayat penyakit.</p>}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-zinc-900">Alergi</h3>
          {pet.allergies?.length ? <ul className="mt-3 space-y-2 text-sm text-zinc-600">{pet.allergies.map((record) => <li key={record.id}>• {record.allergen} {record.note ? `- ${record.note}` : ''}</li>)}</ul> : <p className="mt-3 text-sm text-zinc-500">Tidak ada alergi.</p>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-zinc-900">Janji temu</h3>
          {pet.appointments?.length ? <ul className="mt-3 space-y-2 text-sm text-zinc-600">{pet.appointments.map((appointment) => <li key={appointment.id}>• {new Date(appointment.date).toLocaleString('id-ID')} • {appointment.status}</li>)}</ul> : <p className="mt-3 text-sm text-zinc-500">Belum ada janji temu.</p>}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-zinc-900">Riwayat medis</h3>
          {pet.medicalRecords?.length ? <ul className="mt-3 space-y-2 text-sm text-zinc-600">{pet.medicalRecords.map((record) => <li key={record.id}>• {record.diagnosis || 'Tanpa diagnosis'} ({new Date(record.date).toLocaleDateString('id-ID')})</li>)}</ul> : <p className="mt-3 text-sm text-zinc-500">Belum ada rekam medis.</p>}
        </div>
      </div>
    </div>
  );
}
