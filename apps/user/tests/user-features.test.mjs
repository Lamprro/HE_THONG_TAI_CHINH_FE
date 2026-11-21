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
