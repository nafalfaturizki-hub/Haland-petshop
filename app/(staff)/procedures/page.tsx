'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Package, PencilLine, Trash2 } from 'lucide-react';
import { createProcedure, deleteProcedure, listProcedures, updateProcedure } from '@/actions/procedure';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { formatCurrency } from '@/lib/utils';

type ProcedureRow = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  price: number;
};

export default function ProceduresPage() {
  const [procedures, setProcedures] = useState<ProcedureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ code: '', name: '', description: '', price: '0' });

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const result = await listProcedures();
    if (result.success) {
      setProcedures(result.procedures ?? []);
    }
    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ code: '', name: '', description: '', price: '0' });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setMessage('Nama tindakan wajib diisi.');
      return;
    }

    setSubmitting(true);
    const payload = {
      id: editingId ?? undefined,
      code: form.code,
      name: form.name,
      description: form.description,
      price: Number(form.price),
    };

    const result = editingId ? await updateProcedure(payload as any) : await createProcedure(payload as any);
    setSubmitting(false);

    if (!result.success) {
      setMessage(result.message ?? 'Gagal menyimpan tindakan.');
      return;
    }

    setMessage(editingId ? 'Tindakan diperbarui.' : 'Tindakan ditambahkan.');
    resetForm();
    await loadData();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Hapus tindakan ini?')) return;
    const result = await deleteProcedure(id);
    if (result.success) {
      setMessage('Tindakan dihapus.');
      await loadData();
      return;
    }
    setMessage(result.message ?? 'Gagal menghapus tindakan.');
  }

  function startEdit(procedure: ProcedureRow) {
    setEditingId(procedure.id);
    setForm({ code: procedure.code ?? '', name: procedure.name, description: procedure.description ?? '', price: String(procedure.price) });
  }

  const columns: Array<{ key: keyof ProcedureRow; header: string; render?: (row: ProcedureRow) => ReactNode }> = [
    { key: 'code', header: 'Kode' },
    { key: 'name', header: 'Nama Tindakan' },
    { key: 'description', header: 'Deskripsi' },
    { key: 'price', header: 'Harga', render: (row) => formatCurrency(row.price) },
    {
      key: 'id',
      header: 'Aksi',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => startEdit(row)} className="rounded-lg border border-zinc-200 px-3 py-1 text-xs text-zinc-700"><PencilLine className="mr-1 inline h-3 w-3" />Edit</button>
          <button type="button" onClick={() => void handleDelete(row.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700"><Trash2 className="mr-1 inline h-3 w-3" />Hapus</button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Modul Master Tindakan</p>
        <h1 className="text-xl font-semibold text-zinc-900">Kelola daftar tindakan</h1>
      </div>

      {message ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">{message}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          {loading ? <div className="text-sm text-zinc-500">Memuat tindakan...</div> : procedures.length === 0 ? <EmptyState title="Belum ada tindakan" description="Tambahkan tindakan untuk memulai." /> : <DataTable title="Daftar tindakan" columns={columns} rows={procedures} emptyMessage="Belum ada tindakan." />}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-900">
            <Package className="h-4 w-4" />
            <h2 className="text-base font-semibold">{editingId ? 'Edit tindakan' : 'Tambah tindakan'}</h2>
          </div>

          <label className="block text-sm text-zinc-600">
            Kode (opsional)
            <input type="text" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>

          <label className="block text-sm text-zinc-600">
            Nama tindakan
            <input type="text" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>

          <label className="block text-sm text-zinc-600">
            Deskripsi
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" rows={3} />
          </label>

          <label className="block text-sm text-zinc-600">
            Harga
            <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={submitting} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{submitting ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah tindakan'}</button>
            {editingId ? <button type="button" onClick={resetForm} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700">Batal</button> : null}
          </div>
        </form>
      </div>
    </div>
  );
}
