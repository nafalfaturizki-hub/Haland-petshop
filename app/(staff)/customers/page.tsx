'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Plus, Eye, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { createCustomer, deleteCustomer, listCustomers, updateCustomer } from '@/actions/customer';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormDialog } from '@/components/shared/form-dialog';
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus';

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  user?: { username: string; role: string; isActive: boolean } | null;
  pets?: { id: string; name: string }[];
};

type CustomerForm = {
  name: string;
  phone: string;
  address: string;
  notes: string;
  createLogin: boolean;
  username: string;
};

const emptyForm: CustomerForm = { name: '', phone: '', address: '', notes: '', createLogin: false, username: '' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [temporaryPin, setTemporaryPin] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const result = await listCustomers();

    if (result.success) {
      setCustomers(result.customers as CustomerRow[]);
    } else {
      setCustomers([]);
      toast.error(result.message ?? 'Gagal memuat data pelanggan.');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useRefetchOnFocus(loadCustomers);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setTemporaryPin(null);
    setShowForm(true);
  }

  function openEdit(customer: CustomerRow) {
    setEditingId(customer.id);
    setTemporaryPin(null);
    setForm({
      name: customer.name,
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      notes: customer.notes ?? '',
      createLogin: false,
      username: '',
    });
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setTemporaryPin(null);

    const trimmedName = form.name.trim();
    const trimmedUsername = form.username.trim();

    if (!trimmedName) {
      toast.error('Nama pelanggan wajib diisi.');
      setSaving(false);
      return;
    }

    if (form.createLogin && !trimmedUsername) {
      toast.error('Username wajib diisi saat membuat akun login.');
      setSaving(false);
      return;
    }

    const payload = {
      name: trimmedName,
      phone: form.phone.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
      createLogin: form.createLogin,
      username: form.createLogin && trimmedUsername ? trimmedUsername : undefined,
    };

    const result = editingId
      ? await updateCustomer({ id: editingId, ...payload })
      : await createCustomer(payload);

    setSaving(false);

    if (!result.success) {
      toast.error(result.message ?? 'Gagal menyimpan pelanggan.');
      return;
    }

    if ('temporaryPin' in result && result.temporaryPin) {
      setTemporaryPin(result.temporaryPin as string);
    }

    toast.success(editingId ? 'Data pelanggan diperbarui.' : 'Pelanggan ditambahkan.');
    setShowForm(false);
    await loadCustomers();
  }

  async function handleDelete(id: string) {
    const result = await deleteCustomer({ id });
    if (result.success) {
      toast.success('Pelanggan dihapus.');
      await loadCustomers();
      return;
    }
    toast.error(result.message ?? 'Gagal menghapus pelanggan.');
  }

  const columns: Array<{ key: keyof CustomerRow; header: string; render?: (row: CustomerRow) => ReactNode }> = [
    {
      key: 'name',
      header: 'Nama',
      render: (row: CustomerRow) => (
        <Link href={`/customers/${row.id}`} className="inline-flex items-center gap-1.5 font-medium text-zinc-900 hover:underline">
          <Eye className="h-3.5 w-3.5" />
          {row.name}
        </Link>
      ),
    },
    { key: 'phone', header: 'Telepon', render: (row: CustomerRow) => row.phone || '-' },
    { key: 'address', header: 'Alamat', render: (row: CustomerRow) => row.address || '-' },
    { key: 'pets', header: 'Hewan', render: (row: CustomerRow) => row.pets?.length ?? 0 },
    { key: 'user', header: 'Login', render: (row: CustomerRow) => (row.user ? row.user.username : 'Tidak') },
    {
      key: 'id',
      header: 'Aksi',
      render: (row: CustomerRow) => (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => openEdit(row)} className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-100" aria-label={`Ubah ${row.name}`}>
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedId(row.id);
              setShowConfirm(true);
            }}
            className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
            aria-label={`Hapus ${row.name}`}
          >
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
          <p className="text-sm text-zinc-500">Modul Customer</p>
          <h1 className="text-xl font-semibold text-zinc-900">Data pelanggan</h1>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
          <Plus className="h-4 w-4" />
          Tambah Pelanggan
        </button>
      </div>

      {temporaryPin ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          PIN awal akun pelanggan: <span className="font-mono font-semibold">{temporaryPin}</span> — catat sekarang, hanya ditampilkan sekali.
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">Memuat data pelanggan...</div>
      ) : customers.length === 0 ? (
        <EmptyState title="Belum ada pelanggan" description="Tambahkan pelanggan untuk mengisi data awal." />
      ) : (
        <DataTable title="Daftar pelanggan" columns={columns} rows={customers} emptyMessage="Belum ada pelanggan." />
      )}

      <FormDialog
        open={showForm}
        title={editingId ? 'Ubah pelanggan' : 'Tambah pelanggan'}
        description={editingId ? 'Perbarui data pelanggan.' : 'Isi data pelanggan baru.'}
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="customer-name" className="text-sm font-medium text-zinc-700">
              Nama <span className="text-rose-500">*</span>
            </label>
            <input
              id="customer-name"
              required
              minLength={2}
              maxLength={80}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              placeholder="Nama lengkap pelanggan"
            />
          </div>
          <div>
            <label htmlFor="customer-phone" className="text-sm font-medium text-zinc-700">Telepon</label>
            <input
              id="customer-phone"
              maxLength={20}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              placeholder="08xxxxxxxxxx"
            />
          </div>
          <div>
            <label htmlFor="customer-address" className="text-sm font-medium text-zinc-700">Alamat</label>
            <input
              id="customer-address"
              maxLength={200}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              placeholder="Alamat pelanggan"
            />
          </div>
          <div>
            <label htmlFor="customer-notes" className="text-sm font-medium text-zinc-700">Catatan</label>
            <textarea
              id="customer-notes"
              maxLength={300}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              placeholder="Catatan tambahan"
            />
          </div>
          {!editingId ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <input
                  type="checkbox"
                  checked={form.createLogin}
                  onChange={(e) => setForm((f) => ({ ...f, createLogin: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                Buatkan akun login portal pelanggan
              </label>
              {form.createLogin ? (
                <div className="mt-3">
                  <label htmlFor="customer-username" className="text-sm font-medium text-zinc-700">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="customer-username"
                    required
                    minLength={3}
                    maxLength={30}
                    pattern="[a-z0-9_]+"
                    title="Huruf kecil, angka, dan underscore saja"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                    placeholder="contoh: budi_s"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
              Batal
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </FormDialog>

      <ConfirmDialog
        open={showConfirm}
        title="Hapus pelanggan"
        description="Data pelanggan akan dihapus setelah memastikan tidak ada hewan terkait."
        confirmLabel="Hapus"
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          if (selectedId) void handleDelete(selectedId);
          setShowConfirm(false);
        }}
      />
    </div>
  );
}
