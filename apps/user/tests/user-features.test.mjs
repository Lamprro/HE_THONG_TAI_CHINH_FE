import test from 'node:test';
import assert from 'node:assert/strict';
import { formatKey } from '../src/shared/structured-keys.ts';
import { tradingToday, date, decimal } from '../src/shared/format.ts';

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

test('decimal displays values serialized in scientific notation without rounding', () => {
  assert.equal(decimal('3.2567425051243E+13'), '32.567.425.051.243');
  assert.equal(decimal('9.007199254740993E+15'), '9.007.199.254.740.993');
  assert.equal(decimal('-5E-3'), '-0,005');
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

import { parseAiData, parseScenarioData } from '../src/shared/ai-parsers.ts';

test('parseAiData parses JSON string from LLM news summary and extracts sections', () => {
  const jsonStr = JSON.stringify({
    status: 'SUFFICIENT',
    overview: 'Đoàn công tác tỉnh Đắk Lắk đã có buổi làm việc với Công ty Cổ phần Tập đoàn Hòa Phát.',
    sections: [
      {
        type: 'EVENT',
        heading: 'Làm việc giữa tỉnh Đắk Lắk và Tập đoàn Hòa Phát',
        content: 'Sáng 28/9 tại Hà Nội, Đoàn công tác làm việc về tình hình triển khai các dự án.',
        evidence: [
          {
            quote: 'Theo Báo Đắk Lắk, sáng 28/9, tại Hà Nội...',
            segment_id: 'p1'
          }
        ]
      },
      {
        type: 'KEY_FACT',
        heading: 'Quy mô dự án thép Phú Yên',
        content: 'Tổng vốn dự kiến khoảng 86.000 tỷ đồng, công suất thiết kế 6 triệu tấn thép mỗi năm.',
        evidence: [
          {
            quote: 'Dự án từng được nhắc đến như cú đấm thép thứ ba...',
            segment_id: 'p2'
          }
        ]
      }
    ],
    company_impacts: [
      {
        symbol: 'HPG',
        direction: 'POSITIVE',
        rationale: 'Hỗ trợ tháo gỡ khó khăn thúc đẩy tiến độ dự án cảng Bãi Gốc và liên hợp gang thép.',
        confidence: 'HIGH'
      }
    ],
    facts: [
      {
        metric_name: 'Vốn đầu tư dự kiến',
        value_text: '86.000 tỷ',
        unit: 'VND',
        period: '2025-2030',
        fact_kind: 'TARGET'
      }
    ],
    limitations: 'Dự án đang trong giai đoạn đề xuất tháo gỡ vướng mắc, chưa có quyết định giao đất chính thức.'
  });

  const parsed = parseAiData(jsonStr);
  assert.equal(parsed.status, 'SUFFICIENT');
  assert.ok(parsed.overview?.includes('Đắk Lắk'));
  assert.equal(parsed.sections?.length, 2);
  assert.equal(parsed.sections?.[0].heading, 'Làm việc giữa tỉnh Đắk Lắk và Tập đoàn Hòa Phát');
  assert.equal(parsed.sections?.[0].evidence?.[0].segment_id, undefined);
  assert.equal(parsed.company_impacts?.length, 1);
  assert.equal(parsed.company_impacts?.[0].symbol, 'HPG');
  assert.equal(parsed.company_impacts?.[0].direction, 'POSITIVE');
  assert.equal(parsed.facts?.length, 1);
  assert.equal(parsed.facts?.[0].value_text, '86.000 tỷ');
  assert.ok(parsed.limitations?.includes('vướng mắc'));
});

test('parseAiData safely handles object, plain string, and invalid inputs', () => {
  const objInput = { overview: 'Direct object overview' };
  assert.equal(parseAiData(objInput).overview, 'Direct object overview');

  const plainText = 'Plain non-json text';
  assert.equal(parseAiData(plainText).overview, 'Plain non-json text');

  assert.deepEqual(parseAiData(null), {});
  assert.deepEqual(parseAiData(undefined), {});
});

test('parseScenarioData reads the published forecast and keeps separate limitations', () => {
  const parsed = parseScenarioData({
    forecasts: [{metric_code: 'STOCK_PRICE', bear: {growth_percent: '-2.5',
      rationale: 'Mức 12.500 theo FSI:2f03bff7-4ae0-45a6-bed4-d6842bbaba66 và PRICE:73017.'},
      base: {growth_percent: '0'}, bull: {growth_percent: '3.25'}}],
    calculated_values: [{metric_code: 'STOCK_PRICE', base_value: '123456.78000000', unit: 'VND'}],
    limitations: ['Report scope UNKNOWN: consolidation cannot be assumed.', 'Một lưu ý khác.'],
  });
  assert.equal(parsed.scenarios[0].bull.growth_percent, '3.25');
  assert.equal(parsed.scenarios[0].bear.rationale, 'Mức 12.500 theo dữ liệu nguồn.');
  assert.equal(parsed.calculatedValues[0].base_value, '123456.78000000');
  assert.deepEqual(parsed.limitations, ['Chưa xác định báo cáo là hợp nhất hay riêng lẻ.', 'Một lưu ý khác.']);
});

test('parseScenarioData correctly parses 3 financial scenarios (bear, base, bull)', () => {
  const scenarioJson = JSON.stringify({
    overview: 'Dự phóng kết quả kinh doanh quý 4/2026 dựa trên chu kỳ ngành thép và sản lượng Dung Quất 2.',
    horizon_period: '2026-Q4',
    scenarios: [
      {
        metric_code: 'NET_PROFIT_AFTER_TAX',
        bear: { growth_percent: -5.2, rationale: 'Giá bán thép giảm do cung dồi dào từ Trung Quốc.' },
        base: { growth_percent: 12.8, rationale: 'Sản lượng tăng bù đắp biên lợi nhuận thu hẹp nhẹ.' },
        bull: { growth_percent: 24.5, rationale: 'Nhu cầu xây dựng phục hồi mạnh mẽ và thuế chống bán phá giá có hiệu lực.' }
      }
    ],
    limitations: 'Chưa tính đến biến động tỷ giá USD/VND vượt biên độ 4%.'
  });

  const parsed = parseScenarioData(scenarioJson);
  assert.equal(parsed.horizon_period, '2026-Q4');
  assert.equal(parsed.scenarios?.length, 1);
  const npat = parsed.scenarios?.[0];
  assert.equal(npat?.metric_code, 'NET_PROFIT_AFTER_TAX');
  assert.equal(npat?.bear.growth_percent, -5.2);
  assert.equal(npat?.base.growth_percent, 12.8);
  assert.equal(npat?.bull.growth_percent, 24.5);
  assert.ok(npat?.bull.rationale.includes('thuế'));
});
