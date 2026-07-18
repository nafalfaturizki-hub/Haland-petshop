'use client';

import { FileText, Plus, Trash2 } from 'lucide-react';
import { FormField } from '@/components/shared/form/FormField';
import { TextAreaField } from '@/components/shared/form/TextAreaField';

type StructuredItemInput = {
  id: string;
  name: string;
  qty: string;
  notes: string;
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
  treatmentItems: StructuredItemInput[];
  prescriptionItems: StructuredItemInput[];
  labResult: string;
  notes: string;
  status: string;
  attachments: string;
};

type AppointmentOption = {
  id: string;
  pet: { name: string };
  customer: { name: string };
};

type MedicalRecordFormProps = {
  appointments: AppointmentOption[];
  form: MedicalRecordFormState;
  editingId: string | null;
  submitting: boolean;
  canManage: boolean;
  canCreateRecord: boolean;
  canUpdateRecord: boolean;
  onFieldChange: (field: keyof MedicalRecordFormState, value: string | StructuredItemInput[]) => void;
  onAttachmentChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
};

function createEmptyStructuredItem(id: string): StructuredItemInput {
  return { id, name: '', qty: '1', notes: '' };
}

function StructuredItemSection({
  title,
  description,
  field,
  items,
  onFieldChange,
}: {
  title: string;
  description: string;
  field: 'treatmentItems' | 'prescriptionItems';
  items: StructuredItemInput[];
  onFieldChange: (field: 'treatmentItems' | 'prescriptionItems', value: StructuredItemInput[]) => void;
}) {
  function updateItem(index: number, updates: Partial<StructuredItemInput>) {
    const nextItems = items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item));
    onFieldChange(field, nextItems);
  }

  function addItem() {
    onFieldChange(field, [...items, createEmptyStructuredItem(`${field}-${Date.now()}-${items.length + 1}`)]);
  }

  function removeItem(index: number) {
    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    onFieldChange(field, nextItems.length > 0 ? nextItems : [createEmptyStructuredItem(`${field}-empty`)]);
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-zinc-900">{title}</p>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
        <button type="button" onClick={addItem} className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700">
          <span className="flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Tambah</span>
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.id} className="grid gap-2 rounded-lg border border-zinc-200 p-3 md:grid-cols-[2fr_0.7fr_2fr_auto]">
            <input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} placeholder={field === 'treatmentItems' ? 'Nama tindakan' : 'Nama obat'} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
            <input type="number" min="1" value={item.qty} onChange={(event) => updateItem(index, { qty: event.target.value })} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
            <input value={item.notes} onChange={(event) => updateItem(index, { notes: event.target.value })} placeholder="Catatan" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
            <button type="button" onClick={() => removeItem(index)} className="rounded-lg border border-rose-200 px-2 py-2 text-rose-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MedicalRecordForm({ appointments, form, editingId, submitting, canManage, canCreateRecord, canUpdateRecord, onFieldChange, onAttachmentChange, onSubmit, onCancel }: MedicalRecordFormProps) {
  if (!canManage || (!canCreateRecord && !canUpdateRecord)) {
    return null;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-zinc-900">
        <FileText className="h-4 w-4" />
        <h2 className="text-base font-semibold">{editingId ? 'Edit rekam medis' : 'Tambah rekam medis'}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Appointment">
          <select value={form.appointmentId} onChange={(event) => onFieldChange('appointmentId', event.target.value)} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
            <option value="">Pilih appointment</option>
            {appointments.map((appointment) => <option key={appointment.id} value={appointment.id}>{appointment.pet.name} — {appointment.customer.name}</option>)}
          </select>
        </FormField>
        <FormField label="Tanggal kunjungan">
          <input type="datetime-local" value={form.date} onChange={(event) => onFieldChange('date', event.target.value)} required className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
        </FormField>
        <FormField label="Status">
          <select value={form.status} onChange={(event) => onFieldChange('status', event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </FormField>
        <FormField label="Berat badan (kg)">
          <input type="number" step="0.1" value={form.weight} onChange={(event) => onFieldChange('weight', event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
        </FormField>
        <FormField label="Suhu (°C)">
          <input type="number" step="0.1" value={form.temperature} onChange={(event) => onFieldChange('temperature', event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
        </FormField>
        <FormField label="Detak jantung / menit">
          <input type="number" min="1" value={form.heartRate} onChange={(event) => onFieldChange('heartRate', event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
        </FormField>
        <FormField label="Laju napas / menit">
          <input type="number" min="1" value={form.respiratoryRate} onChange={(event) => onFieldChange('respiratoryRate', event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
        </FormField>
      </div>

      <TextAreaField label="Keluhan utama" value={form.chiefComplaint} onChange={(value) => onFieldChange('chiefComplaint', value)} required placeholder="Tuliskan keluhan utama pasien" />
      <TextAreaField label="Riwayat" value={form.history} onChange={(value) => onFieldChange('history', value)} description="Riwayat singkat pasien" />
      <TextAreaField label="Pemeriksaan fisik" value={form.physicalExam} onChange={(value) => onFieldChange('physicalExam', value)} />
      <TextAreaField label="Tanda vital" value={form.vitalSigns} onChange={(value) => onFieldChange('vitalSigns', value)} />
      <TextAreaField label="Diagnosis" value={form.diagnosis} onChange={(value) => onFieldChange('diagnosis', value)} required />

      <StructuredItemSection title="Tindakan" description="Catat tindakan yang dilakukan selama kunjungan." field="treatmentItems" items={form.treatmentItems} onFieldChange={(field, value) => onFieldChange(field, value)} />
      <StructuredItemSection title="Resep" description="Tambahkan obat yang diberikan kepada pasien." field="prescriptionItems" items={form.prescriptionItems} onFieldChange={(field, value) => onFieldChange(field, value)} />

      <TextAreaField label="Hasil laboratorium" value={form.labResult} onChange={(value) => onFieldChange('labResult', value)} />
      <TextAreaField label="Catatan klinis" value={form.notes} onChange={(value) => onFieldChange('notes', value)} />

      <FormField label="Lampiran" description="File max 5 MB, format gambar/PDF/Word/Teks.">
        <input type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx" onChange={onAttachmentChange} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
      </FormField>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={submitting} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70">{submitting ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Buat rekam medis'}</button>
        {editingId ? <button type="button" onClick={onCancel} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700">Batal</button> : null}
      </div>
    </form>
  );
}
