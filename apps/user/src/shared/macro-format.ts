export function formatMacroPeriod(dateStr: string | null | undefined, frequency: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length < 3) return dateStr;
  const year = parts[0];
  const month = parseInt(parts[1], 10);
  const day = parts[2];

  if (frequency === 'YEARLY') {
    return `Năm ${year}`;
  }
  if (frequency === 'QUARTERLY') {
    const q = Math.ceil(month / 3);
    return `Quý ${q}/${year}`;
  }
  if (frequency === 'MONTHLY') {
    return `T${month.toString().padStart(2, '0')}/${year}`;
  }
  return `${day}/${month.toString().padStart(2, '0')}/${year}`;
}

export function formatMacroValue(val: string | number | null | undefined, unit: string, compact = false): string {
  if (val === null || val === undefined || val === '') return '—';
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return '—';

  if (unit === 'USD') {
    if (Math.abs(n) >= 1e12) return (n / 1e12).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + (compact ? ' NT' : ' nghìn tỷ USD');
    if (Math.abs(n) >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + (compact ? ' tỷ' : ' tỷ USD');
    if (Math.abs(n) >= 1e6) return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + (compact ? ' tr' : ' triệu USD');
    return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' USD';
  }

  if (unit === '%') {
    const prefix = compact && n > 0 ? '+' : '';
    return prefix + n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%';
  }

  if (unit === 'VND') {
    if (Math.abs(n) >= 1e12) return (n / 1e12).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + (compact ? ' NT' : ' nghìn tỷ đ');
    if (Math.abs(n) >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + (compact ? ' tỷ' : ' tỷ đ');
    return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' đ';
  }

  if (Math.abs(n) >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tỷ';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + (unit ? ' ' + unit : '');
}

export type MacroObservationItem = {
  id?: string;
  date: string;
  value: string | null;
  unit?: string;
  sourceCode?: string;
};

export type MacroStats = {
  latest: MacroObservationItem | undefined;
  max: MacroObservationItem | undefined;
  min: MacroObservationItem | undefined;
  avg: number;
  delta: number | null;
  totalChange: number | null;
};

export function computeMacroStats(observations: MacroObservationItem[]): MacroStats {
  if (!observations.length) {
    return { latest: undefined, max: undefined, min: undefined, avg: 0, delta: null, totalChange: null };
  }
  const nums = observations.map(o => Number(o.value)).filter(v => Number.isFinite(v));
  if (!nums.length) {
    return { latest: undefined, max: undefined, min: undefined, avg: 0, delta: null, totalChange: null };
  }
  const maxVal = Math.max(...nums);
  const minVal = Math.min(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const max = observations.find(o => Number(o.value) === maxVal);
  const min = observations.find(o => Number(o.value) === minVal);
  const latest = observations.at(-1);
  const prev = observations.at(-2);
  const first = observations[0];
  const delta = latest && prev && latest.value !== null && prev.value !== null ? Number(latest.value) - Number(prev.value) : null;
  const totalChange = latest && first && latest.value !== null && first.value !== null ? Number(latest.value) - Number(first.value) : null;

  return { latest, max, min, avg, delta, totalChange };
}
