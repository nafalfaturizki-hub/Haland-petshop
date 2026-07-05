'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FileText, Printer, Trash2 } from 'lucide-react';
import { createMedicalRecord, deleteMedicalRecord, getMedicalRecordAccess, listMedicalRecordOptions, listMedicalRecords, updateMedicalRecord } from '@/actions/medical-record';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { formatStructuredItemsForInput, parseStructuredItems } from '@/lib/medical-record-utils';
import { buildMedicalRecordPrefillFromSearchParams } from '@/lib/route-prefill';

type RecordRow = {
  id: string;
  recordNumber: string | null;
  appointmentId: string;
  diagnosis: string | null;
  treatment: string | null;
  prescription: string | null;
  labResult: string | null;
  date: string;
  status: string | null;
  chiefComplaint: string | null;
  history: string | null;
  physicalExam: string | null;
  vitalSigns: string | null;
  weight: number | null;
  temperature: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  notes: string | null;
  attachments: string | null;
  searchText: string;
  customer: { id: string; name: string } | null;
  pet: { id: string; name: string; species: string } | null;
  doctor: { id: string; name: string } | null;
};

type MedicalRecordFormState = {
  appointmentId: string;
  date: string;
  chiefComplaint: string;
  history: string;
  physicalExam: string;
  vitalSigns: string;
  weight: string;
  temperature: string;
  heartRate: string;
  respiratoryRate: string;
  diagnosis: string;
  treatment: string;
  prescription: string;
  labResult: string;
  notes: string;
  status: string;
  attachments: string;
};

const initialFormState: MedicalRecordFormState = {
  appointmentId: '',
  date: '',
  chiefComplaint: '',
  history: '',
  physicalExam: '',
  vitalSigns: '',
  weight: '',
  temperature: '',
  heartRate: '',
  respiratoryRate: '',
  diagnosis: '',
  treatment: '',
  prescription: '',
  labResult: '',
  notes: '',
  status: 'OPEN',
  attachments: '',
};

export default function MedicalRecordsPage() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [form, setForm] = useState<MedicalRecordFormState>(initialFormState);
  const searchParams = useSearchParams();

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const prefill = buildMedicalRecordPrefillFromSearchParams(searchParams);
    if (prefill.appointmentId && !form.appointmentId) {
      setForm((current) => ({ ...current, appointmentId: prefill.appointmentId }));
    }
  }, [form.appointmentId, searchParams]);

  const selectedRecord = useMemo(() => records.find((record) => record.id === selectedRecordId) ?? null, [records, selectedRecordId]);

  async function loadData() {
    setLoading(true);
    const [recordResult, optionResult, accessResult] = await Promise.all([listMedicalRecords(), listMedicalRecordOptions(), getMedicalRecordAccess()]);
    if (recordResult.success) {
      const normalizedRecords = (recordResult.records ?? []).map((record: any) => ({
        ...record,
        date: record.date ? new Date(record.date).toISOString() : '',
        vitalSigns: record.vitalSigns ?? record.vitals ?? null,
        searchText: [record.recordNumber, record.customer?.name, record.pet?.name, record.doctor?.name, record.diagnosis, record.treatment].filter(Boolean).join(' ').toLowerCase(),
      })) as RecordRow[];
      setRecords(normalizedRecords);
      if (!selectedRecordId && normalizedRecords[0]) {
        setSelectedRecordId(normalizedRecords[0].id);
      }
    }
    if (optionResult.success) setAppointments(optionResult.appointments as any[]);
    if (accessResult.success) {
      setCanManage(Boolean(accessResult.canManage));
    }
    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setForm(initialFormState);
  }

  function handleEdit(record: RecordRow) {
    setEditingId(record.id);
    setSelectedRecordId(record.id);
    setForm({
      appointmentId: record.appointmentId,
      date: record.date ? new Date(record.date).toISOString().slice(0, 16) : '',
      chiefComplaint: record.chiefComplaint ?? '',
      history: record.history ?? '',
      physicalExam: record.physicalExam ?? '',
      vitalSigns: record.vitalSigns ?? '',
      weight: record.weight != null ? String(record.weight) : '',
      temperature: record.temperature != null ? String(record.temperature) : '',
      heartRate: record.heartRate != null ? String(record.heartRate) : '',
      respiratoryRate: record.respiratoryRate != null ? String(record.respiratoryRate) : '',
      diagnosis: record.diagnosis ?? '',
      treatment: formatStructuredItemsForInput(parseStructuredItems(record.treatment ?? '')),
      prescription: formatStructuredItemsForInput(parseStructuredItems(record.prescription ?? '')),
      labResult: record.labResult ?? '',
      notes: record.notes ?? '',
      status: record.status ?? 'OPEN',
      attachments: record.attachments ?? '',
    });
  }

  function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      setForm((current) => ({ ...current, attachments: '' }));
      return;
    }

    Promise.all(
      files.map((file) => new Promise<{ name: string; type: string; size: number; dataUrl: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result as string });
        reader.onerror = () => reject(new Error('Gagal membaca lampiran'));
        reader.readAsDataURL(file);
      })),
    )
      .then((attachments) => setForm((current) => ({ ...current, attachments: JSON.stringify(attachments) })))
      .catch(() => {
        setMessage('Lampiran tidak dapat dibaca. Coba file lain.');
        setMessageType('error');
      });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    const payload = {
      id: editingId ?? undefined,
      appointmentId: form.appointmentId,
      date: form.date,
      chiefComplaint: form.chiefComplaint,
      history: form.history,
      physicalExam: form.physicalExam,
      vitalSigns: form.vitalSigns,
      weight: form.weight,
      temperature: form.temperature,
      heartRate: form.heartRate,
      respiratoryRate: form.respiratoryRate,
      diagnosis: form.diagnosis,
      treatment: form.treatment,
      prescription: form.prescription,
      labResult: form.labResult,
      notes: form.notes,
      status: form.status,
      attachments: form.attachments,
    } as any;

    const result = editingId ? await updateMedicalRecord(payload) : await createMedicalRecord(payload);
    if (result.success) {
      setMessage(editingId ? 'Rekam medis diperbarui.' : 'Rekam medis dibuat.');
      setMessageType('success');
      resetForm();
      await loadData();
    } else {
      setMessage(result.message ?? 'Gagal menyimpan rekam medis.');
      setMessageType('error');
    }

    setSubmitting(false);
  }

  async function handleDelete(recordId: string) {
    if (!window.confirm('Hapus rekam medis ini?')) {
      return;
    }

    const result = await deleteMedicalRecord(recordId);
    if (result.success) {
      setMessage('Rekam medis dihapus.');
      setMessageType('success');
      await loadData();
      return;
    }

    setMessage(result.message ?? 'Gagal menghapus rekam medis.');
    setMessageType('error');
  }

  const columns: Array<{ key: keyof RecordRow; header: string; render?: (row: RecordRow) => ReactNode }> = [
    { key: 'recordNumber', header: 'No. Rekam', render: (row) => row.recordNumber ?? '-' },
    { key: 'date', header: 'Tanggal', render: (row) => (row.date ? new Date(row.date).toLocaleString('id-ID') : '-') },
    { key: 'customer', header: 'Customer', render: (row) => row.customer?.name ?? '-' },
    { key: 'pet', header: 'Hewan', render: (row) => row.pet?.name ?? '-' },
    { key: 'doctor', header: 'Dokter', render: (row) => row.doctor?.name ?? '-' },
    { key: 'diagnosis', header: 'Diagnosis', render: (row) => row.diagnosis ?? '-' },
    { key: 'status', header: 'Status', render: (row) => row.status ?? 'OPEN' },
    { key: 'searchText', header: 'Aksi', render: (row) => (
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSelectedRecordId(row.id)} className="rounded border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700">Lihat</button>
        {canManage ? <button type="button" onClick={() => handleEdit(row)} className="rounded border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700">Edit</button> : null}
        {canManage ? <button type="button" onClick={() => void handleDelete(row.id)} className="rounded border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600">Hapus</button> : null}
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Modul Medical Records</p>
        <h1 className="text-xl font-semibold text-zinc-900">Rekam medis pasien</h1>
      </div>

      {message ? <div className={`rounded-lg border p-3 text-sm ${messageType === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{message}</div> : null}

      {canManage ? (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-900">
            <FileText className="h-4 w-4" />
            <h2 className="text-base font-semibold">{editingId ? 'Edit rekam medis' : 'Tambah rekam medis'}</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-zinc-600">
              Appointment
              <select value={form.appointmentId} onChange={(event) => setForm({ ...form, appointmentId: event.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="">Pilih appointment</option>
                {appointments.map((appointment) => <option key={appointment.id} value={appointment.id}>{appointment.pet.name} — {appointment.customer.name}</option>)}
              </select>
            </label>
            <label className="block text-sm text-zinc-600">
              Tanggal kunjungan
              <input type="datetime-local" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </label>
            <label className="block text-sm text-zinc-600">
              Berat badan (kg)
              <input type="number" step="0.1" value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Suhu (°C)
              <input type="number" step="0.1" value={form.temperature} onChange={(event) => setForm({ ...form, temperature: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Detak jantung / menit
              <input type="number" min="1" value={form.heartRate} onChange={(event) => setForm({ ...form, heartRate: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="block text-sm text-zinc-600">
              Laju napas / menit
              <input type="number" min="1" value={form.respiratoryRate} onChange={(event) => setForm({ ...form, respiratoryRate: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
          </div>

          <label className="block text-sm text-zinc-600">
            Keluhan utama
            <textarea value={form.chiefComplaint} onChange={(event) => setForm({ ...form, chiefComplaint: event.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>
          <label className="block text-sm text-zinc-600">
            Riwayat
            <textarea value={form.history} onChange={(event) => setForm({ ...form, history: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>
          <label className="block text-sm text-zinc-600">
            Pemeriksaan fisik
            <textarea value={form.physicalExam} onChange={(event) => setForm({ ...form, physicalExam: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>
          <label className="block text-sm text-zinc-600">
            Tanda vital
            <textarea value={form.vitalSigns} onChange={(event) => setForm({ ...form, vitalSigns: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>
          <label className="block text-sm text-zinc-600">
            Diagnosis
            <textarea value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>
          <label className="block text-sm text-zinc-600">
            Tindakan
            <textarea value={form.treatment} onChange={(event) => setForm({ ...form, treatment: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" rows={3} placeholder="Nama tindakan | qty | catatan" />
            <span className="mt-1 block text-xs text-zinc-500">Format: Nama tindakan | 1 | catatan. Satu item per baris.</span>
          </label>
          <label className="block text-sm text-zinc-600">
            Resep
            <textarea value={form.prescription} onChange={(event) => setForm({ ...form, prescription: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" rows={3} placeholder="Nama obat | 1 | catatan" />
            <span className="mt-1 block text-xs text-zinc-500">Format: Nama obat | 1 | catatan. Satu item per baris.</span>
          </label>
          <label className="block text-sm text-zinc-600">
            Hasil laboratorium
            <textarea value={form.labResult} onChange={(event) => setForm({ ...form, labResult: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>
          <label className="block text-sm text-zinc-600">
            Catatan klinis
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
          </label>
          <label className="block text-sm text-zinc-600">
            Lampiran
            <input type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx" onChange={handleAttachmentChange} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            <span className="mt-1 block text-xs text-zinc-500">File max 5 MB, format gambar/PDF/Word/Teks.</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={submitting} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70">{submitting ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Buat rekam medis'}</button>
            {editingId ? <button type="button" onClick={resetForm} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700">Batal</button> : null}
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">Anda hanya bisa melihat data rekam medis pada modul ini.</div>
      )}

      {selectedRecord ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-zinc-500">Detail kunjungan</p>
              <h2 className="text-base font-semibold text-zinc-900">{selectedRecord.recordNumber ?? 'Rekam medis'}</h2>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => window.print()} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
                <span className="flex items-center gap-2"><Printer className="h-4 w-4" /> Print</span>
              </button>
              <Link href={`/billing?medicalRecordId=${selectedRecord.id}&customerId=${selectedRecord.customer?.id ?? ''}&petId=${selectedRecord.pet?.id ?? ''}`} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                Invoice
              </Link>
              {canManage ? <button type="button" onClick={() => handleEdit(selectedRecord)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">Edit</button> : null}
              {canManage ? <button type="button" onClick={() => void handleDelete(selectedRecord.id)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600"><span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Hapus</span></button> : null}
            </div>
          </div>
          <dl className="mt-4 grid gap-4 text-sm text-zinc-700 md:grid-cols-2">
            <div><dt className="font-medium text-zinc-500">Customer</dt><dd>{selectedRecord.customer?.name ?? '-'}</dd></div>
            <div><dt className="font-medium text-zinc-500">Hewan</dt><dd>{selectedRecord.pet?.name ?? '-'} ({selectedRecord.pet?.species ?? '-'})</dd></div>
            <div><dt className="font-medium text-zinc-500">Dokter</dt><dd>{selectedRecord.doctor?.name ?? '-'}</dd></div>
            <div><dt className="font-medium text-zinc-500">Tanggal</dt><dd>{selectedRecord.date ? new Date(selectedRecord.date).toLocaleString('id-ID') : '-'}</dd></div>
            <div><dt className="font-medium text-zinc-500">Keluhan utama</dt><dd>{selectedRecord.chiefComplaint ?? '-'}</dd></div>
            <div><dt className="font-medium text-zinc-500">Diagnosis</dt><dd>{selectedRecord.diagnosis ?? '-'}</dd></div>
            <div><dt className="font-medium text-zinc-500">Tindakan</dt><dd>{(() => {
              const items = parseStructuredItems(selectedRecord.treatment ?? '');
              if (items.length === 0) return '-';
              return (
                <ul className="space-y-1">
                  {items.map((item, index) => (
                    <li key={`${item.name}-${index}`} className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-700">
                      <span className="font-medium">{item.name}</span>
                      {item.qty > 1 ? <span> × {item.qty}</span> : null}
                      {item.notes ? <span className="text-zinc-500"> — {item.notes}</span> : null}
                    </li>
                  ))}
                </ul>
              );
            })()}</dd></div>
            <div><dt className="font-medium text-zinc-500">Resep</dt><dd>{(() => {
              const items = parseStructuredItems(selectedRecord.prescription ?? '');
              if (items.length === 0) return '-';
              return (
                <ul className="space-y-1">
                  {items.map((item, index) => (
                    <li key={`${item.name}-${index}`} className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-700">
                      <span className="font-medium">{item.name}</span>
                      {item.qty > 1 ? <span> × {item.qty}</span> : null}
                      {item.notes ? <span className="text-zinc-500"> — {item.notes}</span> : null}
                    </li>
                  ))}
                </ul>
              );
            })()}</dd></div>
            <div><dt className="font-medium text-zinc-500">Hasil lab</dt><dd>{selectedRecord.labResult ?? '-'}</dd></div>
            <div><dt className="font-medium text-zinc-500">Catatan klinis</dt><dd>{selectedRecord.notes ?? '-'}</dd></div>
            <div><dt className="font-medium text-zinc-500">Lampiran</dt><dd>{selectedRecord.attachments ? 'Tersedia' : 'Tidak ada'}</dd></div>
          </dl>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {loading ? <div className="text-sm text-zinc-500">Memuat rekam medis...</div> : records.length === 0 ? <EmptyState title="Belum ada rekam medis" description="Rekam medis akan muncul setelah pemeriksaan selesai." /> : <DataTable title="Daftar rekam medis" columns={columns} rows={records} emptyMessage="Belum ada rekam medis." />}
      </div>
    </div>
  );
}
