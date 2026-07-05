'use client';

import { useEffect, useState } from 'react';
import { Lock, User } from 'lucide-react';
import { changePin, getProfileData, updateProfile } from '@/actions/profile';

export default function ProfilePage() {
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', phone: '' });
  const [pinForm, setPinForm] = useState({ currentPin: '', newPin: '' });

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    const result = await getProfileData();
    if (result.success && result.data) {
      setForm({ name: result.data.user.name, phone: result.data.user.phone ?? '' });
    } else {
      setMessage(result.message ?? 'Gagal memuat profil.');
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const result = await updateProfile(form);
    setMessage(result.message ?? 'Profil berhasil disimpan.');
  }

  async function handleChangePin(event: React.FormEvent) {
    event.preventDefault();
    const result = await changePin(pinForm);
    setMessage(result.message ?? 'Gagal mengganti PIN.');
    if (result.success) {
      setPinForm({ currentPin: '', newPin: '' });
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Profil Staff</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">Kelola profil dan PIN</h1>
      </div>

      {message ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">{message}</div> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-700">
            <User className="h-4 w-4" />
            <h2 className="text-base font-semibold">Data profil</h2>
          </div>
          <label className="block text-sm text-zinc-600">
            Nama
            <input type="text" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>
          <label className="block text-sm text-zinc-600">
            Telepon
            <input type="text" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white">
            Simpan profil
          </button>
        </form>

        <form onSubmit={handleChangePin} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-700">
            <Lock className="h-4 w-4" />
            <h2 className="text-base font-semibold">Ganti PIN</h2>
          </div>
          <label className="block text-sm text-zinc-600">
            PIN saat ini
            <input type="password" value={pinForm.currentPin} onChange={(event) => setPinForm({ ...pinForm, currentPin: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>
          <label className="block text-sm text-zinc-600">
            PIN baru
            <input type="password" value={pinForm.newPin} onChange={(event) => setPinForm({ ...pinForm, newPin: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white">
            Perbarui PIN
          </button>
        </form>
      </div>
    </div>
  );
}
