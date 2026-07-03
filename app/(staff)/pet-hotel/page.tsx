'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DoorOpen, CalendarDays, CheckCircle2, LogOut, NotebookPen, Search } from 'lucide-react';
import { cancelPetHotelBooking, checkInPetHotelBooking, checkOutPetHotelBooking, createPetHotelBooking, createPetHotelLog, createPetHotelRoom, deletePetHotelRoom, listPetHotelBookings, listPetHotelLogs, listPetHotelPets, listPetHotelRooms, updatePetHotelBooking, updatePetHotelRoom } from '@/actions/pet-hotel';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';

type RoomRow = {
  id: string;
  name: string;
  status: string;
  occupancy: number;
};

type BookingRow = {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  pet: { name: string; customer?: { name: string } | null };
  room: { name: string } | null;
};

type PetOption = {
  id: string;
  name: string;
  customer: { id: string; name: string } | null;
};

export default function PetHotelPage() {
  const [tab, setTab] = useState<'rooms' | 'bookings'>('rooms');
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [pets, setPets] = useState<PetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState({ name: '', status: 'AVAILABLE' });
  const [bookingForm, setBookingForm] = useState({ petId: '', roomId: '', checkInDate: '', checkOutDate: '' });
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [logForm, setLogForm] = useState({ type: 'NOTE' as 'FEEDING' | 'MEDICINE' | 'NOTE', description: '' });
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void loadData();
  }, [tab]);

  async function loadData() {
    setLoading(true);
    if (tab === 'rooms') {
      const [roomsResult, petsResult] = await Promise.all([listPetHotelRooms(), listPetHotelPets()]);
      if (roomsResult.success && roomsResult.rooms) {
        setRooms(roomsResult.rooms.map((r: any) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          occupancy: r.bookings?.length ?? 0,
        })));
      }
      if (petsResult.success && petsResult.pets) {
        setPets(petsResult.pets as PetOption[]);
      }
    } else {
      const [bookingsResult, petsResult] = await Promise.all([listPetHotelBookings(), listPetHotelPets()]);
      if (bookingsResult.success && bookingsResult.bookings) {
        setBookings(bookingsResult.bookings.map((b: any) => ({
          id: b.id,
          checkInDate: b.checkInDate ? new Date(b.checkInDate).toISOString() : '',
          checkOutDate: b.checkOutDate ? new Date(b.checkOutDate).toISOString() : '',
          status: b.status,
          pet: { name: b.pet?.name ?? '-', customer: b.pet?.customer ?? null },
          room: b.room ? { name: b.room.name } : null,
        })));
      }
      if (petsResult.success && petsResult.pets) {
        setPets(petsResult.pets as PetOption[]);
      }
    }
    setLoading(false);
  }

  async function handleRoomSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload = { id: editingId ?? undefined, name: roomForm.name, status: roomForm.status as any };
    const result = editingId ? await updatePetHotelRoom(payload as any) : await createPetHotelRoom({ name: roomForm.name });

    if (result.success) {
      setMessage(editingId ? 'Kamar diperbarui.' : 'Kamar ditambahkan.');
      setEditingId(null);
      setRoomForm({ name: '', status: 'AVAILABLE' });
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal menyimpan kamar.');
  }

  async function handleRoomDelete(id: string) {
    if (!confirm('Yakin hapus kamar ini?')) return;
    const result = await deletePetHotelRoom(id);
    if (result.success) {
      setMessage('Kamar dihapus.');
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal menghapus kamar.');
  }

  async function handleBookingSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = await createPetHotelBooking({
      petId: bookingForm.petId,
      roomId: bookingForm.roomId || undefined,
      checkInDate: bookingForm.checkInDate,
      checkOutDate: bookingForm.checkOutDate,
    });

    if (result.success) {
      setMessage('Reservasi dibuat.');
      setBookingForm({ petId: '', roomId: '', checkInDate: '', checkOutDate: '' });
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal membuat reservasi.');
  }

  async function handleCheckIn(id: string) {
    const result = await checkInPetHotelBooking(id);
    if (result.success) {
      setMessage('Check-in berhasil.');
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal check-in.');
  }

  async function handleCheckOut(id: string) {
    const result = await checkOutPetHotelBooking(id);
    if (result.success) {
      setMessage('Check-out berhasil.');
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal check-out.');
  }

  async function handleCancel(id: string) {
    const result = await cancelPetHotelBooking(id);
    if (result.success) {
      setMessage('Reservasi dibatalkan.');
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal membatalkan reservasi.');
  }

  async function handleLogSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedBookingId) {
      setMessage('Pilih reservasi terlebih dahulu.');
      return;
    }

    const result = await createPetHotelLog({ bookingId: selectedBookingId, type: logForm.type, description: logForm.description });

    if (result.success) {
      setMessage('Catatan disimpan.');
      setLogForm({ type: 'NOTE', description: '' });
      await loadLogs(selectedBookingId);
      return;
    }
    setMessage(result.message ?? 'Gagal menyimpan catatan.');
  }

  async function loadLogs(bookingId: string) {
    const result = await listPetHotelLogs(bookingId);
    if (result.success) {
      setLogs(result.logs ?? []);
    }
  }

  const roomColumns: Array<{ key: keyof RoomRow; header: string; render?: (row: RoomRow) => ReactNode }> = [
    { key: 'name', header: 'Nama Kamar' },
    { key: 'status', header: 'Status' },
    { key: 'occupancy', header: 'Penghuni' },
  ];

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return bookings;
    return bookings.filter((booking) => `${booking.pet?.name ?? ''} ${booking.room?.name ?? ''} ${booking.status}`.toLowerCase().includes(query));
  }, [bookings, search]);

  const bookingColumns: Array<{ key: keyof BookingRow; header: string; render?: (row: BookingRow) => ReactNode }> = [
    { key: 'checkInDate', header: 'Check-in', render: (row) => new Date(row.checkInDate).toLocaleDateString('id-ID') },
    { key: 'checkOutDate', header: 'Check-out', render: (row) => new Date(row.checkOutDate).toLocaleDateString('id-ID') },
    { key: 'pet', header: 'Hewan', render: (row) => row.pet?.name ?? '-' },
    { key: 'status', header: 'Status' },
    { key: 'room', header: 'Kamar', render: (row) => row.room?.name ?? '-' },
    { key: 'id', header: 'Aksi', render: (row) => <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void handleCheckIn(row.id)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">Check-in</button><button type="button" onClick={() => void handleCheckOut(row.id)} className="rounded-lg border border-zinc-200 px-3 py-1 text-xs text-zinc-700">Check-out</button><button type="button" onClick={() => { setSelectedBookingId(row.id); void loadLogs(row.id); }} className="rounded-lg border border-zinc-200 px-3 py-1 text-xs text-zinc-700"><NotebookPen className="mr-1 inline h-3 w-3" />Catatan</button>{row.status === 'BOOKED' ? <button type="button" onClick={() => void handleCancel(row.id)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700">Batal</button> : null}</div> },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Modul Pet Hotel</p>
        <h1 className="text-xl font-semibold text-zinc-900">Manajemen rawat inap hewan</h1>
      </div>

      {message ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{message}</div> : null}

      <div className="flex gap-2 border-b border-zinc-200">
        <button onClick={() => setTab('rooms')} className={`px-4 py-2 font-medium ${tab === 'rooms' ? 'border-b-2 border-zinc-900 text-zinc-900' : 'text-zinc-600'}`}>
          Kamar
        </button>
        <button onClick={() => setTab('bookings')} className={`px-4 py-2 font-medium ${tab === 'bookings' ? 'border-b-2 border-zinc-900 text-zinc-900' : 'text-zinc-600'}`}>
          Reservasi
        </button>
      </div>

      {tab === 'rooms' ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            {loading ? <div className="text-sm text-zinc-500">Memuat kamar...</div> : rooms.length === 0 ? <EmptyState title="Belum ada kamar" description="Tambah kamar untuk memulai." /> : <DataTable title="Daftar kamar" columns={roomColumns} rows={rooms} emptyMessage="Belum ada kamar." />}
          </div>

          <form onSubmit={handleRoomSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-zinc-900">
              <DoorOpen className="h-4 w-4" />
              <h2 className="text-base font-semibold">{editingId ? 'Edit kamar' : 'Tambah kamar'}</h2>
            </div>

            <label className="block text-sm text-zinc-600">
              Nama Kamar
              <input type="text" value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>

            <label className="block text-sm text-zinc-600">
              Status
              <select value={roomForm.status} onChange={(e) => setRoomForm({ ...roomForm, status: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="OCCUPIED">OCCUPIED</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
                {editingId ? 'Simpan perubahan' : 'Tambah kamar'}
              </button>
              {editingId ? (
                <button type="button" onClick={() => { setEditingId(null); setRoomForm({ name: '', status: 'AVAILABLE' }); }} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700">
                  Batal
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-zinc-700">
                <CalendarDays className="h-4 w-4" />
                <h2 className="text-base font-semibold">Reservasi</h2>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600">
                <Search className="h-4 w-4" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari reservasi" className="w-full bg-transparent outline-none" />
              </label>
            </div>
            {loading ? <div className="text-sm text-zinc-500">Memuat reservasi...</div> : filteredBookings.length === 0 ? <EmptyState title="Belum ada reservasi" description="Reservasi akan muncul setelah ditambahkan." /> : <DataTable title="Daftar reservasi" columns={bookingColumns} rows={filteredBookings} emptyMessage="Belum ada reservasi." />}
          </div>

          <div className="space-y-6">
            <form onSubmit={handleBookingSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-zinc-900">
                <CalendarDays className="h-4 w-4" />
                <h2 className="text-base font-semibold">Buat reservasi</h2>
              </div>
              <label className="block text-sm text-zinc-600">
                Hewan
                <select value={bookingForm.petId} onChange={(e) => setBookingForm({ ...bookingForm, petId: e.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                  <option value="">Pilih hewan</option>
                  {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} — {pet.customer?.name ?? 'Tanpa pemilik'}</option>)}
                </select>
              </label>
              <label className="block text-sm text-zinc-600">
                Kamar (opsional)
                <select value={bookingForm.roomId} onChange={(e) => setBookingForm({ ...bookingForm, roomId: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                  <option value="">Pilih kamar</option>
                  {rooms.filter((room) => room.status !== 'MAINTENANCE').map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-zinc-600">
                  Check-in
                  <input type="date" value={bookingForm.checkInDate} onChange={(e) => setBookingForm({ ...bookingForm, checkInDate: e.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
                </label>
                <label className="block text-sm text-zinc-600">
                  Check-out
                  <input type="date" value={bookingForm.checkOutDate} onChange={(e) => setBookingForm({ ...bookingForm, checkOutDate: e.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
                </label>
              </div>
              <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Buat reservasi</button>
            </form>

            <form onSubmit={handleLogSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-zinc-900">
                <NotebookPen className="h-4 w-4" />
                <h2 className="text-base font-semibold">Catatan harian</h2>
              </div>
              <label className="block text-sm text-zinc-600">
                Reservasi
                <select value={selectedBookingId} onChange={(e) => { setSelectedBookingId(e.target.value); void loadLogs(e.target.value); }} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                  <option value="">Pilih reservasi</option>
                  {bookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.pet?.name} — {booking.room?.name ?? 'Belum ada kamar'}</option>)}
                </select>
              </label>
              <label className="block text-sm text-zinc-600">
                Jenis
                <select value={logForm.type} onChange={(e) => setLogForm({ ...logForm, type: e.target.value as any })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                  <option value="NOTE">Catatan</option>
                  <option value="FEEDING">Pakan</option>
                  <option value="MEDICINE">Obat</option>
                </select>
              </label>
              <label className="block text-sm text-zinc-600">
                Catatan
                <textarea value={logForm.description} onChange={(e) => setLogForm({ ...logForm, description: e.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" rows={3} />
              </label>
              <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Simpan catatan</button>
              {logs.length > 0 ? <div className="space-y-2 rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700">{logs.map((log) => <div key={log.id} className="rounded-lg bg-zinc-50 p-2"><p className="font-medium">{log.type}</p><p>{log.description}</p></div>)} </div> : null}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
