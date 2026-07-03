'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, Printer, RefreshCw, Search as SearchIcon } from 'lucide-react';
import { getReportData, getReportSummary } from '@/actions/report';

type ReportSummary = Record<string, number | string>;
type ReportRow = Record<string, unknown>;
type ReportOptions = {
  doctors: Array<{ id: string; name: string }>;
  customers: Array<{ id: string; name: string }>;
  pets: Array<{ id: string; name: string }>;
  rooms: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  paymentStatuses: string[];
  appointmentStatuses: string[];
  bookingStatuses: string[];
};
type ReportData = {
  reportType: string;
  summary: ReportSummary;
  rows: ReportRow[];
  series: Array<{ label: string; value: number }>;
  chartType: string;
  columns: string[];
  options: ReportOptions;
};

type ReportFilters = Parameters<typeof getReportData>[0];

type ReportFilterType = ReportFilters['reportType'];
type ReportFilterRange = ReportFilters['range'];

const defaultFilters: ReportFilters = {
  reportType: 'revenue',
  range: 'month',
  startDate: '',
  endDate: '',
  doctorId: '',
  customerId: '',
  petId: '',
  status: '',
  category: '',
  paymentStatus: '',
  roomId: '',
  search: '',
};

const reportTypeLabels: Record<string, string> = {
  revenue: 'Revenue',
  appointments: 'Appointment',
  'medical-records': 'Medical Record',
  customers: 'Customer',
  pets: 'Pet',
  inventory: 'Inventory',
  products: 'Product',
  pos: 'POS',
  invoices: 'Invoice',
  'pet-hotel': 'Pet Hotel',
  activity: 'User Activity',
  audit: 'Audit Log',
};

function formatValue(value: unknown) {
  if (typeof value === 'number') {
    return value.toLocaleString('id-ID');
  }
  if (value == null) {
    return '-';
  }
  return String(value);
}

function asCurrency(value: unknown) {
  const numeric = Number(value ?? 0);
  return numeric.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage('');
    const [summaryResult, reportResult] = await Promise.all([
      getReportSummary(),
      getReportData(defaultFilters),
    ]);

    if (summaryResult.success) {
      setSummary((summaryResult.data?.summary as unknown as Record<string, number | string> | null) ?? null);
    }

    if (reportResult.success && reportResult.data) {
      setReportData(reportResult.data as unknown as ReportData);
    } else {
      setMessage(reportResult.message ?? 'Gagal memuat laporan.');
    }
    setLoading(false);
  }

  async function loadReport(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setMessage('');
    const result = await getReportData(filters);
    if (result.success && result.data) {
      setReportData(result.data as unknown as ReportData);
    } else {
      setMessage(result.message ?? 'Gagal memuat laporan.');
    }
    setLoading(false);
  }

  function resetFilters() {
    setFilters(defaultFilters);
    void loadReport();
  }

  function handleExportCsv() {
    if (!reportData?.rows?.length) {
      setMessage('Belum ada data untuk diekspor.');
      return;
    }

    setExporting(true);
    const headers = reportData.columns.length > 0 ? reportData.columns : Object.keys(reportData.rows[0] ?? {});
    const csvLines = [headers.join(',')];
    for (const row of reportData.rows) {
      csvLines.push(headers.map((header) => escapeCsv(row[header])).join(','));
    }
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportData.reportType || 'report'}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    setMessage('Laporan CSV berhasil diunduh.');
  }

  function handlePrint() {
    window.print();
  }

  const statusOptions = useMemo(() => {
    if (filters.reportType === 'appointments') {
      return reportData?.options.appointmentStatuses ?? [];
    }
    if (filters.reportType === 'pet-hotel') {
      return reportData?.options.bookingStatuses ?? [];
    }
    if (filters.reportType === 'revenue' || filters.reportType === 'invoices' || filters.reportType === 'pos') {
      return reportData?.options.paymentStatuses ?? [];
    }
    return [];
  }, [filters.reportType, reportData]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Laporan & Analitik</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">Laporan real-time dari database</h1>
      </div>

      {message ? <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{message}</div> : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Ringkasan harian</h2>
            <p className="text-sm text-zinc-500">Nilai berasal dari data aktual di database.</p>
          </div>
          <button type="button" onClick={() => void loadData()} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"> <RefreshCw className="mr-2 inline h-4 w-4" />Segarkan</button>
        </div>
        {summary ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(summary).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-medium text-zinc-600">{key.replace(/([A-Z])/g, ' $1')}</p>
                <p className="mt-3 text-2xl font-semibold text-zinc-900">{typeof value === 'number' ? value.toLocaleString('id-ID') : String(value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-sm text-zinc-500">{loading ? 'Memuat ringkasan…' : 'Ringkasan tidak tersedia.'}</div>
        )}
      </div>

      <form onSubmit={loadReport} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm text-zinc-600">
              Jenis laporan
              <select value={filters.reportType} onChange={(event) => setFilters({ ...filters, reportType: event.target.value as ReportFilterType })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                {Object.entries(reportTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm text-zinc-600">
              Rentang
              <select value={filters.range} onChange={(event) => setFilters({ ...filters, range: event.target.value as ReportFilterRange })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="today">Hari ini</option>
                <option value="yesterday">Kemarin</option>
                <option value="week">Minggu ini</option>
                <option value="month">Bulan ini</option>
                <option value="year">Tahun ini</option>
                <option value="custom">Kustom</option>
              </select>
            </label>
            <label className="text-sm text-zinc-600">
              Cari
              <div className="mt-1 flex items-center rounded-lg border border-zinc-200 px-3 py-2">
                <SearchIcon className="mr-2 h-4 w-4 text-zinc-400" />
                <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Cari data" className="w-full bg-transparent outline-none" />
              </div>
            </label>
            <label className="text-sm text-zinc-600">
              Mulai
              <input type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="text-sm text-zinc-600">
              Selesai
              <input type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2" />
            </label>
            <label className="text-sm text-zinc-600">
              Dokter
              <select value={filters.doctorId} onChange={(event) => setFilters({ ...filters, doctorId: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="">Semua dokter</option>
                {reportData?.options.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-zinc-600">
              Pelanggan
              <select value={filters.customerId} onChange={(event) => setFilters({ ...filters, customerId: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="">Semua pelanggan</option>
                {reportData?.options.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-zinc-600">
              Hewan
              <select value={filters.petId} onChange={(event) => setFilters({ ...filters, petId: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="">Semua hewan</option>
                {reportData?.options.pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-zinc-600">
              Status
              <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="">Semua status</option>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="text-sm text-zinc-600">
              Kategori
              <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="">Semua kategori</option>
                {reportData?.options.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-zinc-600">
              Status pembayaran
              <select value={filters.paymentStatus} onChange={(event) => setFilters({ ...filters, paymentStatus: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="">Semua</option>
                {reportData?.options.paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="text-sm text-zinc-600">
              Kamar
              <select value={filters.roomId} onChange={(event) => setFilters({ ...filters, roomId: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2">
                <option value="">Semua kamar</option>
                {reportData?.options.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-col justify-end gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Generate Report</button>
            <button type="button" onClick={resetFilters} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700">Reset Filter</button>
            <button type="button" onClick={handleExportCsv} disabled={exporting} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 disabled:opacity-50"><Download className="mr-2 inline h-4 w-4" />Export CSV</button>
            <button type="button" onClick={handlePrint} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700"><Printer className="mr-2 inline h-4 w-4" />Print</button>
          </div>
        </div>
      </form>

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Memuat laporan…</div>
      ) : reportData ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(reportData.summary).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-zinc-600">{key.replace(/([A-Z])/g, ' $1')}</p>
                <p className="mt-3 text-xl font-semibold text-zinc-900">{typeof value === 'number' ? value.toLocaleString('id-ID') : String(value)}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">{reportTypeLabels[reportData.reportType] || 'Laporan'}</h2>
                <p className="text-sm text-zinc-500">Grafik dan tabel mengambil data dari hasil query Prisma yang aktif.</p>
              </div>
            </div>
            {reportData.series.length > 0 ? (
              <div className="space-y-3">
                {reportData.series.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-sm text-zinc-600">
                      <span>{item.label}</span>
                      <span className="font-medium text-zinc-900">{formatValue(item.value)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-zinc-100">
                      <div className="h-3 rounded-full bg-zinc-900" style={{ width: `${Math.max(8, (Number(item.value) / Math.max(1, Math.max(...reportData.series.map((entry) => entry.value)))) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-500">Tidak ada data grafik untuk laporan ini.</div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 p-4">
              <h2 className="text-base font-semibold text-zinc-900">Data laporan</h2>
            </div>
            {reportData.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-zinc-600">
                    <tr>
                      {reportData.columns.map((column) => <th key={column} className="px-4 py-3 font-medium">{column.replace(/([A-Z])/g, ' $1')}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.map((row, index) => (
                      <tr key={`${row.id ?? index}`} className="border-t border-zinc-100">
                        {reportData.columns.map((column) => (
                          <td key={column} className="px-4 py-3 text-zinc-700">
                            {column.toLowerCase().includes('amount') || column.toLowerCase().includes('total') || column.toLowerCase().includes('revenue') || column.toLowerCase().includes('value') ? asCurrency(row[column]) : formatValue(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-sm text-zinc-500">Tidak ada data untuk filter yang dipilih.</div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">{message || 'Belum ada laporan.'}</div>
      )}
    </div>
  );
}
