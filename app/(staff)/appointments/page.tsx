'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarPlus, CheckCircle2, CircleSlash, PencilLine } from 'lucide-react';
import { cancelAppointment, createAppointment, listAppointmentLookups, listAppointments, updateAppointment } from '@/actions/appointment';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';

type AppointmentRow = {
  id: string;
  date: string;
  status: string;
  queueNumber: number | null;
  requestedByCustomer: boolean;
  pet: { id: string; name: string; species: string };
  customer: { id: string; name: string };
  doctor: { id: string; name: string } | null;
};

type LookupOption = {
  id: string;
  name: string;
  species?: string;
  customer?: { id: string; name: string };
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [pets, setPets] = useState<LookupOption[]>([]);
  const [customers, setCustomers] = useState<LookupOption[]>([]);
  const [doctors, setDoctors] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isErrorMessage, setIsErrorMessage] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ petId: '', customerId: '', doctorId: '', date: '', queueNumber: '', status: 'WAITING' as 'WAITING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' });

  useEffect(() => {
    void loadData();
  }, []);

  const availablePets = useMemo(() => {
    if (!form.customerId) {
      return pets;
    }

    return pets.filter((pet) => pet.customer?.id === form.customerId);
  }, [pets, form.customerId]);

  async function loadData() {
    setLoading(true);
    setMessage('');
    setIsErrorMessage(false);
    const [appointmentResult, lookupResult] = await Promise.all([listAppointments(), listAppointmentLookups()]);
    if (appointmentResult.success) {
      const normalizedAppointments = (appointmentResult.appointments ?? []).map((appointment: any) => ({
        ...appointment,
        date: appointment.date ? new Date(appointment.date).toISOString() : '',
      })) as AppointmentRow[];
      setAppointments(normalizedAppointments);
    }
    if (lookupResult.success) {
      setPets(lookupResult.pets as LookupOption[]);
      setCustomers(lookupResult.customers as LookupOption[]);
      setDoctors(lookupResult.doctors as LookupOption[]);
    }
    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ petId: '', customerId: '', doctorId: '', date: '', queueNumber: '', status: 'WAITING' });
  }

  function startEdit(appointment: AppointmentRow) {
    setEditingId(appointment.id);
    setForm({
      petId: appointment.pet?.id ?? '',
      customerId: appointment.customer?.id ?? '',
      doctorId: appointment.doctor?.id ?? '',
      date: appointment.date.slice(0, 16),
      queueNumber: appointment.queueNumber ? String(appointment.queueNumber) : '',
      status: appointment.status as 'WAITING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED',
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setIsErrorMessage(false);

    if (!form.petId || !form.customerId || !form.date) {
      setMessage('Pilih hewan, pelanggan, dan tanggal terlebih dahulu.');
      setIsErrorMessage(true);
      setSaving(false);
      return;
    }

    const payload = {
      id: editingId ?? undefined,
      petId: form.petId,
      customerId: form.customerId,
      doctorId: form.doctorId || undefined,
      date: form.date,
      queueNumber: form.queueNumber ? Number(form.queueNumber) : undefined,
      status: form.status,
      requestedByCustomer: false,
    } as any;

    const result = editingId ? await updateAppointment(payload) : await createAppointment(payload);
    setSaving(false);

    if (result.success) {
      setMessage(editingId ? 'Jadwal diperbarui.' : 'Jadwal ditambahkan.');
      setIsErrorMessage(false);
      resetForm();
      await loadData();
      return;
    }

    setMessage(result.message ?? 'Gagal menyimpan jadwal.');
    setIsErrorMessage(true);
  }

  async function handleStatus(id: string, status: 'IN_PROGRESS' | 'DONE' | 'CANCELLED') {
    setMessage('');
    setIsErrorMessage(false);
    const result = await updateAppointment({ id, status });
    if (result.success) {
      setMessage('Status diperbarui.');
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal memperbarui status.');
    setIsErrorMessage(true);
  }

  async function handleCancel(id: string) {
    setMessage('');
    setIsErrorMessage(false);
    const result = await cancelAppointment({ id });
    if (result.success) {
      setMessage('Jadwal dibatalkan.');
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal membatalkan jadwal.');
    setIsErrorMessage(true);
  }

  const columns: Array<{ key: keyof AppointmentRow; header: string; render?: (row: AppointmentRow) => ReactNode }> = [
    { key: 'date', header: 'Tanggal' },
    { key: 'pet', header: 'Hewan', render: (row) => `${row.pet.name} (${row.pet.species})` },
    { key: 'customer', header: 'Pelanggan', render: (row) => row.customer.name },
    { key: 'doctor', header: 'Dokter', render: (row) => row.doctor?.name ?? '-' },
    { key: 'queueNumber', header: 'No. Antrian', render: (row) => row.queueNumber ?? '-' },
    { key: 'status', header: 'Status', render: (row) => row.status },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Modul Appointment</p>
        <h1 className="text-xl font-semibold text-zinc-900">Kelola jadwal pemeriksaan</h1>
      </div>

      {message ? <div className={`rounded-lg border p-3 text-sm ${isErrorMessage ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}>{message}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          {loading ? <div className="text-sm text-zinc-500">Memuat jadwal...</div> : appointments.length === 0 ? <EmptyState title="Belum ada jadwal" description="Tambah jadwal pemeriksaan untuk memulai." /> : <DataTable title="Daftar jadwal" columns={columns} rows={appointments} emptyMessage="Belum ada jadwal." />}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-900">
            <CalendarPlus className="h-4 w-4" />
            <h2 className="text-base font-semibold">{editingId ? 'Ubah jadwal' : 'Tambah jadwal'}</h2>
          </div>

          <label className="block text-sm text-zinc-600">
            Hewan
            <select
              value={form.petId}
              onChange={(event) => {
                const petId = event.target.value;
                const pet = pets.find((item) => item.id === petId);
                setForm((current) => ({
                  ...current,
                  petId,
                  customerId: pet?.customer?.id ?? current.customerId,
                }));
              }}
              required
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            >
              <option value="">Pilih hewan</option>
              {availablePets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name} — {pet.species}{pet.customer ? ` (${pet.customer.name})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-zinc-600">
            Pelanggan
            <select
              value={form.customerId}
              onChange={(event) => {
                const customerId = event.target.value;
                const selectedPet = pets.find((pet) => pet.id === form.petId);
                setForm((current) => ({
                  ...current,
                  customerId,
                  petId: selectedPet?.customer?.id !== customerId ? '' : current.petId,
                }));
              }}
              required
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            >
              <option value="">Pilih pelanggan</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>

          <label className="block text-sm text-zinc-600">
            Dokter
            <select value={form.doctorId} onChange={(event) => setForm({ ...form, doctorId: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
              <option value="">Belum ditentukan</option>
              {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
            </select>
          </label>

          <label className="block text-sm text-zinc-600">
            Tanggal & waktu
            <input type="datetime-local" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>

          <label className="block text-sm text-zinc-600">
            Nomor antrian
            <input type="number" value={form.queueNumber} onChange={(event) => setForm({ ...form, queueNumber: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>

          <label className="block text-sm text-zinc-600">
            Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as any })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
              <option value="WAITING">WAITING</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="DONE">DONE</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah jadwal'}</button>
            {editingId ? <button type="button" onClick={resetForm} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700">Batal</button> : null}
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Aksi cepat</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
              <span>{appointment.pet.name}</span>
              <button type="button" onClick={() => startEdit(appointment)} className="rounded bg-zinc-100 p-1"><PencilLine className="h-4 w-4" /></button>
              <button type="button" onClick={() => void handleStatus(appointment.id, 'IN_PROGRESS')} className="rounded bg-zinc-100 p-1"><CheckCircle2 className="h-4 w-4" /></button>
              <button type="button" onClick={() => void handleCancel(appointment.id)} className="rounded bg-zinc-100 p-1"><CircleSlash className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
