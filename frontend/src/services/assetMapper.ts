import { Asset } from '../types';

const pad2 = (value: string): string => value.padStart(2, '0');

export const normalizeDateOutput = (value: unknown): string => {
  if (value == null) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const ymdMatch = trimmed.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})/);
  if (ymdMatch) return `${ymdMatch[1]}-${pad2(ymdMatch[2])}-${pad2(ymdMatch[3])}`;

  const mdyMatch = trimmed.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
  if (mdyMatch) return `${mdyMatch[3]}-${pad2(mdyMatch[1])}-${pad2(mdyMatch[2])}`;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return '';
};

export const normalizeDateInput = (value: unknown): string | null => {
  const normalized = normalizeDateOutput(value);
  return normalized || null;
};

export const mapAssetRecord = (record: any): Asset => {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    status: record.status,
    serialNumber: record.serialNumber ?? record.serial_number ?? '',
    assignedTo: record.assignedTo ?? record.assigned_to ?? undefined,
    purchaseDate: normalizeDateOutput(record.purchaseDate ?? record.purchase_date),
    warrantyExpiry: normalizeDateOutput(record.warrantyExpiry ?? record.warranty_expiry),
    cost: Number(record.cost ?? 0),
    location: record.location ?? record.location_name ?? record.locationName ?? ''
  };
};
