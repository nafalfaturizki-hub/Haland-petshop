'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { createPet, deletePet, listPets, updatePet } from '@/actions/pet';
import { listCustomers } from '@/actions/customer';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormDialog } from '@/components/shared/form-dialog';

type PetRow = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  birthDate: string | null;
  gender: string | null;
  photo: string | null;
  customer?: { id: string; name: string } | null;
};

type PetForm = {
  customerId: string;
  name: string;
  species: string;
  breed: string;
  birthDate: string;
  gender: string;
  photo: string;
  weight: string;
};

const emptyForm: PetForm = {
  customerId: '',
  name: '',
  species: '',
  breed: '',
  birthDate: '',
  gender: '',
  photo: '',
  weight: '',
};

export default function PetsPage() {
  const [pets, setPets] = useState<PetRow[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isErrorMessage, setIsErrorMessage] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PetForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage('');
    setIsErrorMessage(false);

    const [petsResult, customersResult] = await Promise.all([listPets(), listCustomers()]);

    if (petsResult.success) {
      setPets(petsResult.pets as PetRow[]);
    } else {
      setPets([]);
      setMessage(petsResult.message ?? 'Gagal memuat data hewan.');
      setIsErrorMessage(true);
    }

    if (customersResult.success) {
      setCustomers((customersResult.customers as Array<{ id: string; name: string }> | undefined) ?? []);
    }

    setLoading(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage('');
    setIsErrorMessage(false);
    setShowForm(true);
  }

  function openEdit(pet: PetRow) {
    setEditingId(pet.id);
    setForm({
      customerId: pet.customer?.id ?? '',
      name: pet.name,
      species: pet.species,
      breed: pet.breed ?? '',
      birthDate: pet.birthDate ?? '',
      gender: pet.gender ?? '',
      photo: pet.photo ?? '',
      weight: '',
    });
    setMessage('');
    setIsErrorMessage(false);
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setIsErrorMessage(false);

    if (!form.customerId) {
      setMessage('Pilih pemilik hewan terlebih dahulu.');
      setIsErrorMessage(true);
      setSaving(false);
      return;
    }

    if (!form.name.trim() || !form.species.trim()) {
      setMessage('Nama dan spesies hewan wajib diisi.');
      setIsErrorMessage(true);
      setSaving(false);
      return;
    }

    if (form.birthDate) {
      const parsedDate = new Date(form.birthDate);
      if (Number.isNaN(parsedDate.getTime())) {
        setMessage('Tanggal lahir tidak valid.');
        setIsErrorMessage(true);
        setSaving(false);
        return;
      }
    }

    const payload = {
      customerId: form.customerId,
      name: form.name.trim(),
      species: form.species.trim(),
      breed: form.breed.trim(),
      birthDate: form.birthDate,
      gender: form.gender.trim(),
      photo: form.photo.trim(),
      weight: form.weight ? Number(form.weight) : undefined,
    };

    const result = editingId ? await updatePet({ id: editingId, ...payload }) : await createPet(payload);
    setSaving(false);

    if (!result.success) {
      setMessage(result.message ?? 'Gagal menyimpan data hewan.');
      setIsErrorMessage(true);
      return;
    }

    setMessage(editingId ? 'Data hewan diperbarui.' : 'Data hewan ditambahkan.');
    setIsErrorMessage(false);
    setShowForm(false);
    await loadData();
  }

  async function handleDelete(id: string) {
    const result = await deletePet({ id });
    if (result.success) {
      setMessage('Data hewan dihapus.');
      setIsErrorMessage(false);
      await loadData();
      return;
    }

    setMessage(result.message ?? 'Gagal menghapus data hewan.');
    setIsErrorMessage(true);
  }

  const speciesOptions = useMemo(() => Array.from(new Set(pets.map((pet) => pet.species).filter(Boolean))), [pets]);
  const filteredPets = useMemo(() => {
    return pets.filter((pet) => {
      const speciesMatch = speciesFilter === 'all' || pet.species === speciesFilter;
      const ownerMatch = ownerFilter === 'all' || pet.customer?.id === ownerFilter;
      return speciesMatch && ownerMatch;
    });
  }, [ownerFilter, pets, speciesFilter]);

  const columns: Array<{ key: keyof PetRow; header: string; render?: (row: PetRow) => ReactNode }> = [
    {
      key: 'name',
      header: 'Nama',
      render: (row: PetRow) => (
        <Link href={`/pets/${row.id}`} className="inline-flex items-center gap-2 font-medium text-zinc-900 hover:underline">
          <Eye className="h-4 w-4" />
          {row.name}
        </Link>
      ),
    },
    { key: 'species', header: 'Spesies' },
    { key: 'breed', header: 'Ras', render: (row: PetRow) => row.breed || '-' },
    { key: 'birthDate', header: 'Lahir', render: (row: PetRow) => (row.birthDate ? new Date(row.birthDate).toLocaleDateString('id-ID') : '-') },
    { key: 'customer', header: 'Pemilik', render: (row: PetRow) => row.customer?.name ?? '-' },
    {
      key: 'id',
      header: 'Aksi',
      render: (row: PetRow) => (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => openEdit(row)} className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-100" aria-label={`Ubah ${row.name}`}>
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => { setSelectedId(row.id); setShowConfirm(true); }} className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50" aria-label={`Hapus ${row.name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-zinc-500">Modul Pet Management</p>
          <h1 className="text-xl font-semibold text-zinc-900">Data hewan peliharaan</h1>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
          <Plus className="h-4 w-4" />
          Tambah Hewan
        </button>
      </div>

      {message ? <div className={`rounded-lg border p-3 text-sm ${isErrorMessage ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}>{message}</div> : null}

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:flex-row md:items-end md:justify-between">
        <label className="flex flex-col gap-1 text-sm text-zinc-600">
          <span>Filter spesies</span>
          <select value={speciesFilter} onChange={(event) => setSpeciesFilter(event.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
            <option value="all">Semua spesies</option>
            {speciesOptions.map((species) => (
              <option key={species} value={species}>
                {species}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-600">
          <span>Filter pemilik</span>
          <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
            <option value="all">Semua pemilik</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">Memuat data hewan...</div>
      ) : pets.length === 0 ? (
        <EmptyState title="Belum ada data hewan" description="Tambahkan hewan untuk menampilkan riwayat dan detail." />
      ) : filteredPets.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">Tidak ada hewan yang sesuai filter.</div>
      ) : (
        <DataTable title="Daftar hewan" columns={columns} rows={filteredPets} emptyMessage="Belum ada data hewan." />
      )}

      <FormDialog open={showForm} title={editingId ? 'Ubah data hewan' : 'Tambah hewan'} description={editingId ? 'Perbarui data hewan dan relasi pemilik.' : 'Tambahkan hewan baru dengan pemilik yang valid.'} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pet-owner" className="text-sm font-medium text-zinc-700">Pemilik <span className="text-rose-500">*</span></label>
            <select id="pet-owner" value={form.customerId} onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none">
              <option value="">Pilih pemilik</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="pet-name" className="text-sm font-medium text-zinc-700">Nama <span className="text-rose-500">*</span></label>
              <input id="pet-name" required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none" placeholder="Nama hewan" />
            </div>
            <div>
              <label htmlFor="pet-species" className="text-sm font-medium text-zinc-700">Spesies <span className="text-rose-500">*</span></label>
              <input id="pet-species" required value={form.species} onChange={(event) => setForm((current) => ({ ...current, species: event.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none" placeholder="Kucing / Anjing" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="pet-breed" className="text-sm font-medium text-zinc-700">Ras</label>
              <input id="pet-breed" value={form.breed} onChange={(event) => setForm((current) => ({ ...current, breed: event.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none" placeholder="Persia / Labrador" />
            </div>
            <div>
              <label htmlFor="pet-gender" className="text-sm font-medium text-zinc-700">Gender</label>
              <input id="pet-gender" value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none" placeholder="Jantan / Betina" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="pet-birthDate" className="text-sm font-medium text-zinc-700">Tanggal lahir</label>
              <input id="pet-birthDate" type="date" value={form.birthDate} onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="pet-weight" className="text-sm font-medium text-zinc-700">Berat (kg)</label>
              <input id="pet-weight" type="number" step="0.1" min="0" value={form.weight} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none" placeholder="3.5" />
            </div>
          </div>
          <div>
            <label htmlFor="pet-photo" className="text-sm font-medium text-zinc-700">Foto</label>
            <input id="pet-photo" value={form.photo} onChange={(event) => setForm((current) => ({ ...current, photo: event.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none" placeholder="URL foto (opsional)" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">Batal</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </FormDialog>

      <ConfirmDialog open={showConfirm} title="Hapus hewan" description="Data hewan akan dihapus dari sistem setelah memastikan tidak ada riwayat terkait." confirmLabel="Hapus" onCancel={() => setShowConfirm(false)} onConfirm={() => { if (selectedId) void handleDelete(selectedId); setShowConfirm(false); }} />
    </div>
  );
}
