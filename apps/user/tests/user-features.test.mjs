import test from 'node:test';
import assert from 'node:assert/strict';
import { formatKey } from '../src/shared/structured-keys.ts';
import { tradingToday, date } from '../src/shared/format.ts';

test('StructuredView formatKey translates financial terms into Vietnamese', () => {
  assert.equal(formatKey('summary'), 'Tóm tắt');
  assert.equal(formatKey('sentiment'), 'Đánh giá / Tâm lý');
  assert.equal(formatKey('key_points'), 'Điểm chính');
  assert.equal(formatKey('risks'), 'Rủi ro');
  assert.equal(formatKey('target_price'), 'Giá tham chiếu kỳ vọng');
});

test('tradingToday formats current date in Vietnam Asia/Ho_Chi_Minh', () => {
  const today = tradingToday();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
});

test('date formats ISO dates cleanly into vi-VN string', () => {
  const formatted = date('2026-11-21T00:00:00Z');
  assert.ok(formatted.includes('2026') || formatted.includes('21/11/2026') || formatted.includes('11/21/2026'));
  assert.equal(date(null), '—');
});

import { formatMacroPeriod, formatMacroValue, computeMacroStats } from '../src/shared/macro-format.ts';

test('formatMacroPeriod correctly formats quarterly, yearly, and monthly periods', () => {
  assert.equal(formatMacroPeriod('2024-03-31', 'QUARTERLY'), 'Quý 1/2024');
  assert.equal(formatMacroPeriod('2024-06-30', 'QUARTERLY'), 'Quý 2/2024');
  assert.equal(formatMacroPeriod('2024-09-30', 'QUARTERLY'), 'Quý 3/2024');
  assert.equal(formatMacroPeriod('2024-12-31', 'QUARTERLY'), 'Quý 4/2024');
  assert.equal(formatMacroPeriod('2023-12-31', 'YEARLY'), 'Năm 2023');
  assert.equal(formatMacroPeriod('2024-05-31', 'MONTHLY'), 'T05/2024');
  assert.equal(formatMacroPeriod(null, 'QUARTERLY'), '—');
});

test('formatMacroValue formats percentages, billions USD and VND correctly', () => {
  assert.equal(formatMacroValue('5.05', '%'), '5,05%');
  assert.equal(formatMacroValue(5.05, '%', true), '+5,05%');
  assert.equal(formatMacroValue('-2.1', '%', true), '-2,1%');
  assert.equal(formatMacroValue('354700000000', 'USD'), '354,7 tỷ USD');
  assert.equal(formatMacroValue('354700000000', 'USD', true), '354,7 tỷ');
  assert.equal(formatMacroValue(null, '%'), '—');
});

test('computeMacroStats accurately calculates max, min, avg, and period deltas', () => {
  const observations = [
    { id: '1', date: '2021-12-31', value: '2.56' },
    { id: '2', date: '2022-12-31', value: '8.02' },
    { id: '3', date: '2023-12-31', value: '5.05' },
  ];
  const stats = computeMacroStats(observations);
  assert.equal(stats.latest?.value, '5.05');
  assert.equal(stats.max?.value, '8.02');
  assert.equal(stats.min?.value, '2.56');
  assert.ok(Math.abs(stats.avg - (2.56 + 8.02 + 5.05) / 3) < 0.001);
  assert.equal(stats.delta, 5.05 - 8.02);
  assert.equal(stats.totalChange, 5.05 - 2.56);
});
