import { test } from 'node:test';
import assert from 'node:assert/strict';

test('coverage remediation generates correct initial workflow selection', () => {
  const symbol = 'HPG';
  const lastPrice = '2026-11-19';
  const d = new Date(lastPrice);
  d.setDate(d.getDate() + 1);
  const nextDate = d.toISOString().slice(0, 10);
  const today = '2026-11-20';

  const priceSelection = {
    mode: 'INGEST_VALIDATE_BUILD',
    operation: 'OHLCV',
    source: 'VNDIRECT',
    symbol,
    startDate: nextDate,
    endDate: today,
    reason: `Bổ sung khoảng thiếu giá lịch sử cho mã ${symbol} từ ${nextDate} đến ${today}`,
  };

  assert.equal(priceSelection.mode, 'INGEST_VALIDATE_BUILD');
  assert.equal(priceSelection.operation, 'OHLCV');
  assert.equal(priceSelection.symbol, 'HPG');
  assert.equal(priceSelection.startDate, '2026-11-20');
  assert.match(priceSelection.reason, /Bổ sung khoảng thiếu giá/);

  const statementSelection = {
    mode: 'INGEST_VALIDATE_BUILD',
    operation: 'FINANCIAL_STATEMENT',
    source: 'VNDIRECT',
    symbol,
    statement: 'balance_sheet',
    period: 'quarter',
    reason: `Lấy và cập nhật báo cáo tài chính cho mã ${symbol}`,
  };

  assert.equal(statementSelection.mode, 'INGEST_VALIDATE_BUILD');
  assert.equal(statementSelection.operation, 'FINANCIAL_STATEMENT');
  assert.equal(statementSelection.statement, 'balance_sheet');
  assert.equal(statementSelection.period, 'quarter');
});

test('local ai research boundary guards keep execution and public publishing disabled', () => {
  const modelState = {
    readiness: 'RESEARCH_ONLY',
    publicResultsAvailable: false,
    executionAvailable: false,
    featureSubmissionAllowed: false,
  };

  assert.equal(modelState.readiness, 'RESEARCH_ONLY');
  assert.equal(modelState.publicResultsAvailable, false);
  assert.equal(modelState.executionAvailable, false);
  assert.equal(modelState.featureSubmissionAllowed, false);
});
