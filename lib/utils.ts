import type { Session } from 'next-auth';

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString('id-ID');
}

export function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

export function getActorRole(session: Session | null) {
  return (session?.user as { role?: string } | undefined)?.role;
}

export function getActorId(session: Session | null) {
  return session?.user?.id;
}

export function normalizeOptionalText(value: string | undefined | null) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeOptionalNumber(value: string | undefined | null) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}
