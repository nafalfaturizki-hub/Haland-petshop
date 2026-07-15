'use client';

import Link from 'next/link';
import { Printer, Trash2 } from 'lucide-react';
import { parseStructuredItems } from '@/lib/medical-record-utils';

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

type MedicalRecordDetailProps = {
  record: RecordRow;
  canManage: boolean;
  canUpdateRecord: boolean;
  canDeleteRecord: boolean;
  onEdit: (record: RecordRow) => void;
  onDelete: (recordId: string) => void;
};

export function MedicalRecordDetail({ record, canManage, canUpdateRecord, canDeleteRecord, onEdit, onDelete }: MedicalRecordDetailProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-zinc-500">Detail kunjungan</p>
          <h2 className="text-base font-semibold text-zinc-900">{record.recordNumber ?? 'Rekam medis'}</h2>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
            <span className="flex items-center gap-2"><Printer className="h-4 w-4" /> Print</span>
          </button>
          <Link href={`/billing?medicalRecordId=${record.id}&customerId=${record.customer?.id ?? ''}&petId=${record.pet?.id ?? ''}`} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Invoice
          </Link>
          {canManage && canUpdateRecord ? <button type="button" onClick={() => onEdit(record)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">Edit</button> : null}
          {canManage && canDeleteRecord ? <button type="button" onClick={() => void onDelete(record.id)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600"><span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Hapus</span></button> : null}
        </div>
      </div>
      <dl className="mt-4 grid gap-4 text-sm text-zinc-700 md:grid-cols-2">
        <div><dt className="font-medium text-zinc-500">Customer</dt><dd>{record.customer?.name ?? '-'}</dd></div>
        <div><dt className="font-medium text-zinc-500">Hewan</dt><dd>{record.pet?.name ?? '-'} ({record.pet?.species ?? '-'})</dd></div>
        <div><dt className="font-medium text-zinc-500">Dokter</dt><dd>{record.doctor?.name ?? '-'}</dd></div>
        <div><dt className="font-medium text-zinc-500">Tanggal</dt><dd>{record.date ? new Date(record.date).toLocaleString('id-ID') : '-'}</dd></div>
        <div><dt className="font-medium text-zinc-500">Keluhan utama</dt><dd>{record.chiefComplaint ?? '-'}</dd></div>
        <div><dt className="font-medium text-zinc-500">Diagnosis</dt><dd>{record.diagnosis ?? '-'}</dd></div>
        <div><dt className="font-medium text-zinc-500">Tindakan</dt><dd>{renderStructuredItems(record.treatment)}</dd></div>
        <div><dt className="font-medium text-zinc-500">Resep</dt><dd>{renderStructuredItems(record.prescription)}</dd></div>
        <div><dt className="font-medium text-zinc-500">Hasil lab</dt><dd>{record.labResult ?? '-'}</dd></div>
        <div><dt className="font-medium text-zinc-500">Catatan klinis</dt><dd>{record.notes ?? '-'}</dd></div>
        <div><dt className="font-medium text-zinc-500">Lampiran</dt><dd>{record.attachments ? 'Tersedia' : 'Tidak ada'}</dd></div>
      </dl>
    </div>
  );
}

function renderStructuredItems(value: string | null) {
  const items = parseStructuredItems(value ?? '');
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
}
