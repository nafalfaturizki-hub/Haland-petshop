import { useState, type ChangeEvent } from 'react';

export type MedicalRecordFormState = {
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

export function createInitialMedicalRecordFormState(): MedicalRecordFormState {
  return {
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
}

export function buildMedicalRecordFormState(record: {
  appointmentId: string;
  date?: string | null;
  chiefComplaint?: string | null;
  history?: string | null;
  physicalExam?: string | null;
  vitalSigns?: string | null;
  weight?: number | null;
  temperature?: number | null;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  diagnosis?: string | null;
  treatment?: string | null;
  prescription?: string | null;
  labResult?: string | null;
  notes?: string | null;
  status?: string | null;
  attachments?: string | null;
}): MedicalRecordFormState {
  return {
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
    treatment: record.treatment ?? '',
    prescription: record.prescription ?? '',
    labResult: record.labResult ?? '',
    notes: record.notes ?? '',
    status: record.status ?? 'OPEN',
    attachments: record.attachments ?? '',
  };
}

export function createMedicalRecordPayload(form: MedicalRecordFormState, editingId?: string | null) {
  return {
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
}

export function useMedicalForm() {
  const [form, setForm] = useState<MedicalRecordFormState>(createInitialMedicalRecordFormState);
  const [editingId, setEditingId] = useState<string | null>(null);

  function updateField(field: keyof MedicalRecordFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(createInitialMedicalRecordFormState());
  }

  function startEditing(record: Parameters<typeof buildMedicalRecordFormState>[0]) {
    setEditingId(record.appointmentId ? record.appointmentId : null as any);
    setForm(buildMedicalRecordFormState(record));
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>, onError: (message: string) => void) {
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
      .catch(() => onError('Lampiran tidak dapat dibaca. Coba file lain.'));
  }

  return {
    form,
    editingId,
    setForm,
    updateField,
    resetForm,
    startEditing,
    handleAttachmentChange,
    createPayload: (recordId?: string | null) => createMedicalRecordPayload(form, recordId ?? editingId),
  };
}
