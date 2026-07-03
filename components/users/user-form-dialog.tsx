'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { FormDialog } from '@/components/shared/form-dialog';
import { getRoleLabel, type Role } from '@/lib/permissions';

type UserFormValues = {
  id?: string;
  username: string;
  name: string;
  phone: string;
  role: Role;
  isActive: boolean;
};

type UserFormDialogProps = {
  open: boolean;
  mode: 'create' | 'edit';
  initialValues?: UserFormValues;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => void | Promise<void>;
};

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'ADMIN_KLINIK', label: 'Admin Klinik' },
  { value: 'DOKTER', label: 'Doctor' },
  { value: 'OWNER', label: 'Owner' },
];

const emptyValues = (): UserFormValues => ({
  username: '',
  name: '',
  phone: '',
  role: 'CUSTOMER',
  isActive: true,
});

export function UserFormDialog({ open, mode, initialValues, submitting = false, onClose, onSubmit }: UserFormDialogProps) {
  const [values, setValues] = useState<UserFormValues>(emptyValues());

  useEffect(() => {
    if (initialValues) {
      setValues(initialValues);
      return;
    }
    setValues(emptyValues());
  }, [initialValues, open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(values);
  }

  return (
    <FormDialog open={open} title={mode === 'create' ? 'Buat akun pengguna' : 'Perbarui akun pengguna'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm text-zinc-600">
          Username
          <input
            required
            value={values.username}
            onChange={(event) => setValues((current) => ({ ...current, username: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            placeholder="contoh: dokter1"
          />
        </label>
        <label className="block text-sm text-zinc-600">
          Nama lengkap
          <input
            required
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            placeholder="Nama pengguna"
          />
        </label>
        <label className="block text-sm text-zinc-600">
          Nomor telepon
          <input
            value={values.phone}
            onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            placeholder="Opsional"
          />
        </label>
        <label className="block text-sm text-zinc-600">
          Role
          <select
            value={values.role}
            onChange={(event) => setValues((current) => ({ ...current, role: event.target.value as Role }))}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(event) => setValues((current) => ({ ...current, isActive: event.target.checked }))}
          />
          Akun aktif
        </label>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700">
            Batal
          </button>
          <button type="submit" disabled={submitting} className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === 'create' ? 'Simpan akun' : 'Simpan perubahan'}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}
