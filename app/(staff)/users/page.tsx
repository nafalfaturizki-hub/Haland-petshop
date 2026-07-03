'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { KeyRound, PencilLine, Plus, RefreshCw, Unlock, UserRoundCheck, UserRoundX } from 'lucide-react';
import { activateUser, createUser, deleteUser, listUsers, resetPin, unlockUser, updateUser } from '@/actions/user';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { UserFormDialog } from '@/components/users/user-form-dialog';
import { getRoleLabel, type Role } from '@/lib/permissions';

type UserRow = {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  isLocked: boolean;
  mustChangePin: boolean;
  failedPinAttempts: number;
  createdAt: string;
  createdBy?: { username: string; name: string } | null;
};

type UserFormValues = {
  id?: string;
  username: string;
  name: string;
  phone: string;
  role: Role;
  isActive: boolean;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [temporaryPin, setTemporaryPin] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [submitting, setSubmitting] = useState(false);
  const [pendingActionUserId, setPendingActionUserId] = useState<string | null>(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setMessage('');
    const result = await listUsers();
    if (result.success) {
      const normalizedUsers = (result.users ?? []).map((user: { createdAt: Date | string; id: string; username: string; name: string; phone: string | null; role: string; isActive: boolean; isLocked: boolean; mustChangePin: boolean; failedPinAttempts: number; createdBy?: { username: string; name: string } | null }) => ({
        ...user,
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : '',
      })) as UserRow[];
      setUsers(normalizedUsers);
    } else {
      setMessage(result.message ?? 'Gagal memuat daftar pengguna.');
    }
    setLoading(false);
  }

  function openCreateDialog() {
    setFormMode('create');
    setSelectedUser(null);
    setShowForm(true);
  }

  function openEditDialog(user: UserRow) {
    setFormMode('edit');
    setSelectedUser(user);
    setShowForm(true);
  }

  async function handleFormSubmit(values: UserFormValues) {
    setSubmitting(true);
    setMessage('');
    const payload = {
      username: values.username.trim(),
      name: values.name.trim(),
      phone: values.phone.trim(),
      role: values.role,
      isActive: values.isActive,
    };

    const result = formMode === 'create'
      ? await createUser(payload)
      : await updateUser({ id: values.id ?? '', ...payload });

    setSubmitting(false);
    if (!result.success) {
      setMessage(result.message ?? 'Proses akun gagal.');
      return;
    }

    setShowForm(false);
    setTemporaryPin('temporaryPin' in result ? (result.temporaryPin ?? null) : null);
    setMessage(formMode === 'create' ? 'Akun berhasil dibuat.' : 'Akun berhasil diperbarui.');
    await loadUsers();
  }

  async function handleResetPin(userId: string) {
    setPendingActionUserId(userId);
    const result = await resetPin({ id: userId });
    setPendingActionUserId(null);
    if (!result.success) {
      setMessage(result.message ?? 'Gagal mereset PIN.');
      return;
    }
    setTemporaryPin(result.temporaryPin ?? null);
    setMessage('PIN berhasil direset.');
    await loadUsers();
  }

  async function handleUnlock(userId: string) {
    setPendingActionUserId(userId);
    const result = await unlockUser({ id: userId });
    setPendingActionUserId(null);
    if (!result.success) {
      setMessage(result.message ?? 'Gagal membuka kunci akun.');
      return;
    }
    setMessage('Akun berhasil dibuka kuncinya.');
    await loadUsers();
  }

  async function handleDeactivate(userId: string) {
    setPendingActionUserId(userId);
    const result = await deleteUser({ id: userId });
    setPendingActionUserId(null);
    if (!result.success) {
      setMessage(result.message ?? 'Gagal menonaktifkan akun.');
      return;
    }
    setMessage('Akun dinonaktifkan.');
    await loadUsers();
  }

  async function handleActivate(userId: string) {
    setPendingActionUserId(userId);
    const result = await activateUser({ id: userId });
    setPendingActionUserId(null);
    if (!result.success) {
      setMessage(result.message ?? 'Gagal mengaktifkan akun.');
      return;
    }
    setMessage('Akun berhasil diaktifkan.');
    await loadUsers();
  }

  const columns: Array<{ key: keyof UserRow; header: string; render?: (row: UserRow) => ReactNode }> = [
    { key: 'username', header: 'Username' },
    { key: 'name', header: 'Nama' },
    { key: 'role', header: 'Role', render: (row: UserRow) => getRoleLabel(row.role) },
    { key: 'isActive', header: 'Status', render: (row: UserRow) => (row.isActive ? 'Aktif' : 'Nonaktif') },
    { key: 'isLocked', header: 'Kunci', render: (row: UserRow) => (row.isLocked ? 'Terkunci' : 'Aktif') },
    { key: 'id', header: 'Aksi', render: (row: UserRow) => (
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => openEditDialog(row)} className="rounded-lg border border-zinc-200 px-2 py-1 text-sm text-zinc-700">
          <PencilLine className="mr-1 inline h-4 w-4" />Edit
        </button>
        <button type="button" onClick={() => handleResetPin(row.id)} disabled={pendingActionUserId === row.id} className="rounded-lg border border-zinc-200 px-2 py-1 text-sm text-zinc-700 disabled:opacity-50">
          <KeyRound className="mr-1 inline h-4 w-4" />Reset PIN
        </button>
        <button type="button" onClick={() => handleUnlock(row.id)} disabled={pendingActionUserId === row.id} className="rounded-lg border border-zinc-200 px-2 py-1 text-sm text-zinc-700 disabled:opacity-50">
          <Unlock className="mr-1 inline h-4 w-4" />Unlock
        </button>
        {row.isActive ? (
          <button type="button" onClick={() => { setSelectedUser(row); setShowConfirm(true); }} className="rounded-lg border border-rose-200 px-2 py-1 text-sm text-rose-700">
            <UserRoundX className="mr-1 inline h-4 w-4" />Nonaktifkan
          </button>
        ) : (
          <button type="button" onClick={() => void handleActivate(row.id)} disabled={pendingActionUserId === row.id} className="rounded-lg border border-emerald-200 px-2 py-1 text-sm text-emerald-700 disabled:opacity-50">
            <UserRoundCheck className="mr-1 inline h-4 w-4" />Aktifkan
          </button>
        )}
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-zinc-500">Modul Users</p>
          <h1 className="text-xl font-semibold text-zinc-900">Kelola akun pengguna</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadUsers()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700">
            <RefreshCw className="h-4 w-4" />Segarkan
          </button>
          <button type="button" onClick={openCreateDialog} className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            <Plus className="h-4 w-4" />Tambah Akun
          </button>
        </div>
      </div>

      {message ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{message}</div> : null}
      {temporaryPin ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">PIN awal: {temporaryPin}</div> : null}

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">Memuat data akun...</div>
      ) : users.length === 0 ? (
        <EmptyState title="Belum ada akun" description="Akun pengguna akan muncul di sini setelah dibuat." />
      ) : (
        <DataTable title="Daftar akun" columns={columns} rows={users} emptyMessage="Belum ada akun yang tersedia." />
      )}

      <UserFormDialog
        open={showForm}
        mode={formMode}
        initialValues={selectedUser ? {
          id: selectedUser.id,
          username: selectedUser.username,
          name: selectedUser.name,
          phone: selectedUser.phone ?? '',
          role: selectedUser.role as Role,
          isActive: selectedUser.isActive,
        } : undefined}
        submitting={submitting}
        onClose={() => setShowForm(false)}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        open={showConfirm}
        title="Nonaktifkan akun"
        description="Akun ini akan dinonaktifkan dan tidak bisa login lagi."
        confirmLabel="Nonaktifkan"
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          if (selectedUser?.id) {
            void handleDeactivate(selectedUser.id);
          }
          setShowConfirm(false);
        }}
      />
    </div>
  );
}
