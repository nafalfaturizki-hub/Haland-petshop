'use client';

import { useEffect, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { cancelAppointment, createAppointment, listAppointmentLookups, listAppointments } from '@/actions/appointment';

export default function CustomerAppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [pets, setPets] = useState<any[]>([]);
  const [form, setForm] = useState({ petId: '', date: '', doctorId: '' });
  const [message, setMessage] = useState('');
  const [isErrorMessage, setIsErrorMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [appointmentResult, lookupResult] = await Promise.all([listAppointments(), listAppointmentLookups()]);
    if (appointmentResult.success) setAppointments(appointmentResult.appointments as any[]);
    if (lookupResult.success) setPets(lookupResult.pets as any[]);
    setLoading(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setIsErrorMessage(false);

    if (!form.petId || !form.date) {
      setMessage('Pilih hewan dan tanggal terlebih dahulu.');
      setIsErrorMessage(true);
      setSubmitting(false);
      return;
    }

    const result = await createAppointment({ petId: form.petId, customerId: '', doctorId: form.doctorId || undefined, date: form.date, queueNumber: undefined, status: 'WAITING', requestedByCustomer: true });
    setSubmitting(false);

    if (result.success) {
      setMessage('Permintaan appointment berhasil dikirim.');
      setIsErrorMessage(false);
      setForm({ petId: '', date: '', doctorId: '' });
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal mengajukan appointment.');
    setIsErrorMessage(true);
  }

  async function handleCancel(id: string) {
    setMessage('');
    setIsErrorMessage(false);
    const result = await cancelAppointment({ id });
    if (result.success) {
      setMessage('Appointment dibatalkan.');
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal membatalkan appointment.');
    setIsErrorMessage(true);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Portal Pelanggan</p>
        <h1 className="text-xl font-semibold text-zinc-900">Appointment Anda</h1>
      </div>

      {message ? <div className={`rounded-lg border p-3 text-sm ${isErrorMessage ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}>{message}</div> : null}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-zinc-900">
          <CalendarPlus className="h-4 w-4" />
          <h2 className="text-base font-semibold">Ajukan appointment baru</h2>
        </div>
        <label className="block text-sm text-zinc-600">
          Hewan
          <select value={form.petId} onChange={(event) => setForm({ ...form, petId: event.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
            <option value="">Pilih hewan</option>
            {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
          </select>
        </label>
        <label className="block text-sm text-zinc-600">
          Tanggal & waktu
          <input type="datetime-local" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
        </label>
        <button type="submit" disabled={submitting} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{submitting ? 'Mengirim...' : 'Kirim permintaan'}</button>
      </form>

      <div className="space-y-3">
        {loading ? <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Memuat appointment...</div> : null}
        {!loading && appointments.length === 0 ? <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Belum ada appointment.</div> : null}
        {!loading && appointments.map((appointment) => (
          <div key={appointment.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-zinc-900">{appointment.pet?.name}</p>
                <p className="text-sm text-zinc-600">{new Date(appointment.date).toLocaleString('id-ID')} • {appointment.status}</p>
              </div>
              {appointment.status !== 'DONE' && appointment.status !== 'CANCELLED' && appointment.status !== 'IN_PROGRESS' ? (
                <button type="button" onClick={() => void handleCancel(appointment.id)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">Batalkan</button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
