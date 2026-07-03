'use client';

import { useEffect, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { cancelPetHotelBooking, createPetHotelBooking, listPetHotelBookings, listPetHotelPets } from '@/actions/pet-hotel';

export default function CustomerPetHotelPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [pets, setPets] = useState<any[]>([]);
  const [form, setForm] = useState({ petId: '', checkInDate: '', checkOutDate: '', notes: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const [bookingsResult, petsResult] = await Promise.all([listPetHotelBookings(), listPetHotelPets()]);
    if (bookingsResult.success) {
      setBookings(bookingsResult.bookings as any[]);
    }
    if (petsResult.success) {
      setPets((petsResult.pets as any[]) ?? []);
    }
    setLoading(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = await createPetHotelBooking({
      petId: form.petId,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      requestedByCustomer: true,
      notes: form.notes,
    });

    if (result.success) {
      setMessage('Permintaan reservasi berhasil dikirim.');
      setForm({ petId: '', checkInDate: '', checkOutDate: '', notes: '' });
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal mengajukan reservasi.');
  }

  async function handleCancel(id: string) {
    if (!confirm('Yakin batalkan reservasi ini?')) return;
    const result = await cancelPetHotelBooking(id);
    if (result.success) {
      setMessage('Reservasi dibatalkan.');
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal membatalkan reservasi.');
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Portal Pelanggan</p>
        <h1 className="text-xl font-semibold text-zinc-900">Pet Hotel Anda</h1>
      </div>

      {message ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{message}</div> : null}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-zinc-900">
          <CalendarPlus className="h-4 w-4" />
          <h2 className="text-base font-semibold">Ajukan reservasi baru</h2>
        </div>

        <label className="block text-sm text-zinc-600">
          Hewan
          <select value={form.petId} onChange={(e) => setForm({ ...form, petId: e.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
            <option value="">Pilih hewan</option>
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-zinc-600">
          Check-in
          <input type="date" value={form.checkInDate} onChange={(e) => setForm({ ...form, checkInDate: e.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
        </label>

        <label className="block text-sm text-zinc-600">
          Check-out
          <input type="date" value={form.checkOutDate} onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
        </label>

        <label className="block text-sm text-zinc-600">
          Catatan
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" rows={3} />
        </label>

        <button type="submit" className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          Kirim Permintaan
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">Reservasi Anda</h2>
        {loading ? (
          <div className="text-sm text-zinc-500">Memuat...</div>
        ) : bookings.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Belum ada reservasi.</div>
        ) : (
          bookings.map((booking) => (
            <div key={booking.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900">{booking.pet?.name}</p>
                  <div className="mt-1 flex items-center gap-4 text-sm text-zinc-600">
                    <span>{new Date(booking.checkInDate).toLocaleDateString('id-ID')}</span>
                    <span>→</span>
                    <span>{new Date(booking.checkOutDate).toLocaleDateString('id-ID')}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className={`rounded-full px-2 py-1 text-xs font-medium ${booking.status === 'BOOKED' ? 'bg-blue-100 text-blue-700' : booking.status === 'CHECKED_IN' ? 'bg-green-100 text-green-700' : booking.status === 'CHECKED_OUT' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                      {booking.status}
                    </div>
                    {booking.room && <span className="text-xs text-zinc-500">Kamar: {booking.room.name}</span>}
                  </div>
                </div>
                {booking.status === 'BOOKED' && (
                  <button type="button" onClick={() => void handleCancel(booking.id)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
                    Batalkan
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
