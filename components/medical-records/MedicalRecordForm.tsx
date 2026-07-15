'use client';

import { FileText } from 'lucide-react';
import { FormField } from '@/components/shared/form/FormField';
import { TextAreaField } from '@/components/shared/form/TextAreaField';

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
  onFieldChange: (field: keyof MedicalRecordFormState, value: string) => void;
  onAttachmentChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
};

export function MedicalRecordForm({ appointments, form, editingId, submitting, canManage, canCreateRecord, canUpdateRecord, onFieldChange, onAttachmentChange, onSubmit, onCancel }: MedicalRecordFormProps) {
  if (!canManage || !canCreateRecord && !canUpdateRecord) {
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
      <TextAreaField label="Tindakan" value={form.treatment} onChange={(value) => onFieldChange('treatment', value)} rows={3} placeholder="Nama tindakan | qty | catatan" description="Format: Nama tindakan | 1 | catatan. Satu item per baris." />
      <TextAreaField label="Resep" value={form.prescription} onChange={(value) => onFieldChange('prescription', value)} rows={3} placeholder="Nama obat | 1 | catatan" description="Format: Nama obat | 1 | catatan. Satu item per baris." />
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
