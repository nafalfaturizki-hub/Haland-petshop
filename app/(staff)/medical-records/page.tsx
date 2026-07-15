'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createMedicalRecord, deleteMedicalRecord, getMedicalRecordAccess, listMedicalRecordOptions, listMedicalRecords, updateMedicalRecord } from '@/actions/medical-record';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { MedicalRecordDetail } from '@/components/medical-records/MedicalRecordDetail';
import { MedicalRecordForm } from '@/components/medical-records/MedicalRecordForm';
import { formatStructuredItemsForInput, parseStructuredItems } from '@/lib/medical-record-utils';
import { buildMedicalRecordPrefillFromSearchParams } from '@/lib/route-prefill';
import { usePermissions } from '@/hooks/use-permissions';
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus';

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
  searchText?: string;
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
  const { canPerform } = usePermissions();
  const canCreateRecord = canPerform('medical-records', 'create');
  const canUpdateRecord = canPerform('medical-records', 'update');
  const canDeleteRecord = canPerform('medical-records', 'delete');

  const loadData = useCallback(async () => {
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
  }, [selectedRecordId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRefetchOnFocus(loadData);

  useEffect(() => {
    const prefill = buildMedicalRecordPrefillFromSearchParams(searchParams);
    if (prefill.appointmentId && !form.appointmentId) {
      setForm((current) => ({ ...current, appointmentId: prefill.appointmentId }));
    }
  }, [form.appointmentId, searchParams]);

  const selectedRecord = useMemo(() => records.find((record) => record.id === selectedRecordId) ?? null, [records, selectedRecordId]);

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

  function handleFieldChange(field: keyof MedicalRecordFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
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
        {canManage && canUpdateRecord ? <button type="button" onClick={() => handleEdit(row)} className="rounded border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700">Edit</button> : null}
        {canManage && canDeleteRecord ? <button type="button" onClick={() => void handleDelete(row.id)} className="rounded border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600">Hapus</button> : null}
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

      {canManage && (canCreateRecord || canUpdateRecord) ? (
        <MedicalRecordForm
          appointments={appointments}
          form={form}
          editingId={editingId}
          submitting={submitting}
          canManage={canManage}
          canCreateRecord={canCreateRecord}
          canUpdateRecord={canUpdateRecord}
          onFieldChange={handleFieldChange}
          onAttachmentChange={handleAttachmentChange}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">Anda hanya bisa melihat data rekam medis pada modul ini.</div>
      )}

      {selectedRecord ? (
        <MedicalRecordDetail
          record={selectedRecord}
          canManage={canManage}
          canUpdateRecord={canUpdateRecord}
          canDeleteRecord={canDeleteRecord}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {loading ? <div className="text-sm text-zinc-500">Memuat rekam medis...</div> : records.length === 0 ? <EmptyState title="Belum ada rekam medis" description="Rekam medis akan muncul setelah pemeriksaan selesai." /> : <DataTable title="Daftar rekam medis" columns={columns} rows={records} emptyMessage="Belum ada rekam medis." />}
      </div>
    </div>
  );
}
