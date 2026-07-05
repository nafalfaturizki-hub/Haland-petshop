'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Save, Upload, ShieldCheck } from 'lucide-react';
import { createBackup, getSettingsData, restoreBackup, updateSettings } from '@/actions/settings';

const initialForm = {
  clinicName: '',
  logo: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  taxNumber: '',
  operationalHours: '',
  timezone: '',
  currency: '',
  language: 'id',
  footerInfo: '',
  receiptHeader: '',
  receiptFooter: '',
  appName: '',
  appVersion: '',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  numberFormat: 'en-US',
  pagination: 20,
  sessionTimeout: 30,
  autoLogout: false,
  defaultDashboard: 'dashboard',
  appointmentDuration: 15,
  workingDays: 'Mon-Fri',
  holidayRules: '',
  invoicePrefix: 'INV',
  medicalRecordPrefix: 'MR',
  customerPrefix: 'C',
  petPrefix: 'P',
  posPrefix: 'POS',
  bookingPrefix: 'BK',
  receiptPrefix: 'RCPT',
  autoNumbering: true,
  theme: 'light',
};

export default function SettingsPage() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const result = await getSettingsData();
    if (result.success && result.data) {
      const data = result.data;
      setAuditLogs(data.auditLogs ?? []);
      setIsOwner(data.isOwner ?? false);
      setForm({
        ...initialForm,
        clinicName: data.settings?.clinicName ?? '',
        logo: data.settings?.logo ?? '',
        address: data.settings?.address ?? '',
        phone: data.settings?.phone ?? '',
        email: data.settings?.email ?? '',
        website: data.settings?.website ?? '',
        taxNumber: data.settings?.taxNumber ?? '',
        operationalHours: data.settings?.operationalHours ?? '',
        timezone: data.settings?.timezone ?? '',
        currency: data.settings?.currency ?? '',
        language: data.settings?.language ?? 'id',
        footerInfo: data.settings?.footerInfo ?? '',
        receiptHeader: data.settings?.receiptHeader ?? '',
        receiptFooter: data.settings?.receiptFooter ?? '',
        appName: data.settings?.appName ?? '',
        appVersion: data.settings?.appVersion ?? '',
        dateFormat: data.settings?.dateFormat ?? 'DD/MM/YYYY',
        timeFormat: data.settings?.timeFormat ?? '24h',
        numberFormat: data.settings?.numberFormat ?? 'en-US',
        pagination: Number(data.settings?.pagination ?? 20),
        sessionTimeout: Number(data.settings?.sessionTimeout ?? 30),
        autoLogout: Boolean(data.settings?.autoLogout),
        defaultDashboard: data.settings?.defaultDashboard ?? 'dashboard',
        appointmentDuration: Number(data.settings?.appointmentDuration ?? 15),
        workingDays: data.settings?.workingDays ?? 'Mon-Fri',
        holidayRules: data.settings?.holidayRules ?? '',
        invoicePrefix: data.settings?.invoicePrefix ?? 'INV',
        medicalRecordPrefix: data.settings?.medicalRecordPrefix ?? 'MR',
        customerPrefix: data.settings?.customerPrefix ?? 'C',
        petPrefix: data.settings?.petPrefix ?? 'P',
        posPrefix: data.settings?.posPrefix ?? 'POS',
        bookingPrefix: data.settings?.bookingPrefix ?? 'BK',
        receiptPrefix: data.settings?.receiptPrefix ?? 'RCPT',
        autoNumbering: Boolean(data.settings?.autoNumbering),
        theme: data.settings?.theme ?? 'light',
      });
    } else {
      setMessage(result.message ?? 'Gagal memuat pengaturan.');
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!isOwner) {
      setMessage('Hanya Owner yang dapat mengubah pengaturan.');
      return;
    }

    setIsSaving(true);
    setMessage('Menyimpan perubahan...');
    const result = await updateSettings(form);
    setMessage(result.message ?? 'Simpan pengaturan selesai.');
    if (result.success) {
      await loadData();
    }
    setIsSaving(false);
  }

  async function handleBackup() {
    if (!isOwner) {
      setMessage('Hanya Owner yang dapat membuat backup.');
      return;
    }

    setIsBackingUp(true);
    setMessage('Membuat backup...');
    const result = await createBackup();
    if (!result.success) {
      setMessage(result.message ?? 'Gagal membuat backup.');
      setIsBackingUp(false);
      return;
    }
    if (!result.data) {
      setMessage('Backup gagal: data kosong.');
      setIsBackingUp(false);
      return;
    }

    const blob = new Blob([result.data.content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.data.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage('Backup berhasil diunduh.');
    setIsBackingUp(false);
  }

  async function handleRestore() {
    if (!isOwner) {
      setMessage('Hanya Owner yang dapat melakukan restore.');
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setMessage('Pilih file backup JSON terlebih dahulu.');
      return;
    }

    setIsRestoring(true);
    setMessage('Memproses restore backup...');
    const content = await file.text();
    const result = await restoreBackup({ content });
    setMessage(result.message ?? 'Restore selesai.');
    if (result.success) {
      await loadData();
    }
    setIsRestoring(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Pengaturan</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">Konfigurasi sistem, identitas klinik, dan backup</h1>
      </div>

      {message ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">{message}</div> : null}

      <form onSubmit={handleSave} className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
            {isOwner ? 'Anda memiliki akses penuh untuk mengubah konfigurasi sistem.' : 'Anda melihat mode read-only karena akses Anda saat ini tidak mencakup pengaturan sistem.'}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-zinc-600">
              Nama klinik
              <input type="text" value={form.clinicName} onChange={(event) => setForm({ ...form, clinicName: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Nama aplikasi
              <input type="text" value={form.appName} onChange={(event) => setForm({ ...form, appName: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Logo URL
              <input type="text" value={form.logo} onChange={(event) => setForm({ ...form, logo: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Alamat
              <input type="text" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Telepon
              <input type="text" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Email
              <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Website
              <input type="text" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              NPWP / Tax Number
              <input type="text" value={form.taxNumber} onChange={(event) => setForm({ ...form, taxNumber: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Jam operasional
              <input type="text" value={form.operationalHours} onChange={(event) => setForm({ ...form, operationalHours: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Zona waktu
              <input type="text" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Mata uang
              <input type="text" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Bahasa
              <input type="text" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Footer informasi
              <input type="text" value={form.footerInfo} onChange={(event) => setForm({ ...form, footerInfo: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Header struk
              <input type="text" value={form.receiptHeader} onChange={(event) => setForm({ ...form, receiptHeader: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Footer struk
              <input type="text" value={form.receiptFooter} onChange={(event) => setForm({ ...form, receiptFooter: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Format tanggal
              <input type="text" value={form.dateFormat} onChange={(event) => setForm({ ...form, dateFormat: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Format waktu
              <input type="text" value={form.timeFormat} onChange={(event) => setForm({ ...form, timeFormat: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Format angka
              <input type="text" value={form.numberFormat} onChange={(event) => setForm({ ...form, numberFormat: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Pagination
              <input type="number" value={form.pagination} onChange={(event) => setForm({ ...form, pagination: Number(event.target.value) })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Session timeout (menit)
              <input type="number" value={form.sessionTimeout} onChange={(event) => setForm({ ...form, sessionTimeout: Number(event.target.value) })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Durasi janji temu (menit)
              <input type="number" value={form.appointmentDuration} onChange={(event) => setForm({ ...form, appointmentDuration: Number(event.target.value) })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Hari kerja
              <input type="text" value={form.workingDays} onChange={(event) => setForm({ ...form, workingDays: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Prefix invoice
              <input type="text" value={form.invoicePrefix} onChange={(event) => setForm({ ...form, invoicePrefix: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Prefix rekam medis
              <input type="text" value={form.medicalRecordPrefix} onChange={(event) => setForm({ ...form, medicalRecordPrefix: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Prefix pelanggan
              <input type="text" value={form.customerPrefix} onChange={(event) => setForm({ ...form, customerPrefix: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Prefix hewan
              <input type="text" value={form.petPrefix} onChange={(event) => setForm({ ...form, petPrefix: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Prefix POS
              <input type="text" value={form.posPrefix} onChange={(event) => setForm({ ...form, posPrefix: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Prefix booking
              <input type="text" value={form.bookingPrefix} onChange={(event) => setForm({ ...form, bookingPrefix: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Prefix struk
              <input type="text" value={form.receiptPrefix} onChange={(event) => setForm({ ...form, receiptPrefix: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Tema
              <input type="text" value={form.theme} onChange={(event) => setForm({ ...form, theme: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="block text-sm text-zinc-600">
              Aturan libur
              <input type="text" value={form.holidayRules} onChange={(event) => setForm({ ...form, holidayRules: event.target.value })} disabled={!isOwner} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 disabled:bg-zinc-50" />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" checked={form.autoLogout} onChange={(event) => setForm({ ...form, autoLogout: event.target.checked })} disabled={!isOwner} className="rounded border-zinc-300" />
              Aktifkan auto logout
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" checked={form.autoNumbering} onChange={(event) => setForm({ ...form, autoNumbering: event.target.checked })} disabled={!isOwner} className="rounded border-zinc-300" />
              Aktifkan penomoran otomatis
            </label>
          </div>

          <button type="submit" disabled={!isOwner || isSaving} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400">
            <Save className="h-4 w-4" /> {isSaving ? 'Menyimpan...' : 'Simpan pengaturan'}
          </button>
        </div>

        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-700">
            <ShieldCheck className="h-4 w-4" />
            <h2 className="text-base font-semibold">Audit log</h2>
          </div>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-zinc-500">Tidak ada catatan audit.</p>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-zinc-900">{log.action}</p>
                    <p className="text-xs text-zinc-500">{new Date(log.date).toLocaleString('id-ID')}</p>
                  </div>
                  <p>{log.description}</p>
                  <p className="text-xs text-zinc-500">Oleh {log.user.name}</p>
                </div>
              ))}
            </div>
          )}
          {isOwner ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                <button type="button" onClick={handleBackup} disabled={isBackingUp} className="text-sm font-medium text-zinc-900 disabled:text-zinc-400">{isBackingUp ? 'Membuat backup...' : 'Backup sekarang'}</button>
              </div>
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <label className="text-sm font-medium text-zinc-900">
                  Restore backup
                  <input type="file" ref={fileInputRef} accept=".json" className="mt-2 block w-full text-sm text-zinc-500" />
                </label>
              </div>
              <button type="button" onClick={handleRestore} disabled={isRestoring} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:text-zinc-400">
                <Upload className="h-4 w-4" /> {isRestoring ? 'Memproses...' : 'Proses restore'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Fitur backup & restore hanya untuk Owner.</p>
          )}
        </div>
      </form>
    </div>
  );
}
