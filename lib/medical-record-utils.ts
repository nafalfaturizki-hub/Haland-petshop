export type MedicalRecordStructuredItem = {
  id: string;
  name: string;
  qty: number;
  notes?: string | null;
};

export function serializeStructuredItems(items: MedicalRecordStructuredItem[]) {
  return JSON.stringify(items);
}

export function formatStructuredItemsForInput(items: MedicalRecordStructuredItem[]) {
  return items
    .map((item) => {
      const parts = [item.name, item.qty > 1 ? String(item.qty) : '', item.notes?.trim() ?? ''];
      return parts.filter(Boolean).join(' | ');
    })
    .join('\n');
}

export function parseStructuredItems(value: string | null | undefined): MedicalRecordStructuredItem[] {
  if (!value) return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is MedicalRecordStructuredItem => Boolean(item && typeof item === 'object' && typeof item.name === 'string'))
          .map((item) => ({
            id: typeof item.id === 'string' ? item.id : '',
            name: item.name,
            qty: Number.isFinite(Number(item.qty)) ? Number(item.qty) : 1,
            notes: typeof item.notes === 'string' ? item.notes : null,
          }));
      }
    } catch {
      // fall back to plain text parsing below
    }
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  return lines.map((line) => {
    const [name, qtyRaw, ...notesParts] = line.split('|');
    const qty = Number(qtyRaw);
    return {
      id: '',
      name: name?.trim() ?? line,
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      notes: notesParts.join('|').trim() || null,
    };
  });
}
