import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLatestTradingWeekday,
  computeRowStatus,
  buildPriceRemediation,
  buildStatementRemediation,
} from '../src/features/admin/coverage';

test('getLatestTradingWeekday rolls back weekend days to Friday', () => {
  // Sunday 2026-11-22 10:00 UTC -> should roll back to Friday 2026-11-20
  const sunday = new Date('2026-11-22T10:00:00Z');
  assert.equal(getLatestTradingWeekday(sunday), '2026-11-20');

  // Saturday 2026-11-21 10:00 UTC -> should roll back to Friday 2026-11-20
  const saturday = new Date('2026-11-21T10:00:00Z');
  assert.equal(getLatestTradingWeekday(saturday), '2026-11-20');

  // Wednesday 2026-11-18 10:00 UTC -> remains Wednesday 2026-11-18
  const wednesday = new Date('2026-11-18T10:00:00Z');
  assert.equal(getLatestTradingWeekday(wednesday), '2026-11-18');
});

test('computeRowStatus correctly evaluates price, statement, and healthy gaps', () => {
  const latestTradingDay = '2026-11-20';

  // No prices -> GAP_PRICE
  assert.equal(computeRowStatus(0, null, 10, latestTradingDay), 'GAP_PRICE');

  // Outdated price (2026-11-15 < 2026-11-20) -> GAP_PRICE
  assert.equal(computeRowStatus(500, '2026-11-15', 10, latestTradingDay), 'GAP_PRICE');

  // Up-to-date price (2026-11-20) but no statements -> GAP_STATEMENTS
  assert.equal(computeRowStatus(500, '2026-11-20', 0, latestTradingDay), 'GAP_STATEMENTS');

  // Up-to-date price and positive statements -> HEALTHY
  assert.equal(computeRowStatus(500, '2026-11-20', 8, latestTradingDay), 'HEALTHY');
});

test('buildPriceRemediation builds valid range and maps index operations', () => {
  const latestTradingDay = '2026-11-20';

  // Regular stock HPG
  const hpgSelection = buildPriceRemediation('HPG', '2026-11-18', latestTradingDay);
  assert.equal(hpgSelection.mode, 'INGEST_VALIDATE_BUILD');
  assert.equal(hpgSelection.operation, 'OHLCV');
  assert.equal(hpgSelection.symbol, 'HPG');
  assert.equal(hpgSelection.startDate, '2026-11-19');
  assert.equal(hpgSelection.endDate, '2026-11-20');
  assert.match(hpgSelection.reason, /Bổ sung khoảng thiếu giá lịch sử cho mã HPG/);

  // Index symbol VN30 -> operation INDEX_OHLCV
  const vn30Selection = buildPriceRemediation('VN30', '2026-11-18', latestTradingDay);
  assert.equal(vn30Selection.operation, 'INDEX_OHLCV');
  assert.equal(vn30Selection.symbol, 'VN30');

  // When already up to date (lastPrice is latestTradingDay), startDate is capped at latestTradingDay
  const upToDateSelection = buildPriceRemediation('FPT', '2026-11-20', latestTradingDay);
  assert.equal(upToDateSelection.startDate, '2026-11-20');
  assert.equal(upToDateSelection.endDate, '2026-11-20');

  // When lastPrice is null or placeholder '—', defaults to 2021-01-01
  const emptyPriceSelection = buildPriceRemediation('NEW', '—', latestTradingDay);
  assert.equal(emptyPriceSelection.startDate, '2021-01-01');
  assert.equal(emptyPriceSelection.endDate, latestTradingDay);
});

test('buildStatementRemediation supports configurable types and periods', () => {
  const balanceSheet = buildStatementRemediation('VNM', 'balance_sheet', 'quarter', 'CAFEF');
  assert.equal(balanceSheet.mode, 'INGEST_VALIDATE_BUILD');
  assert.equal(balanceSheet.operation, 'FINANCIAL_STATEMENT');
  assert.equal(balanceSheet.symbol, 'VNM');
  assert.equal(balanceSheet.statement, 'balance_sheet');
  assert.equal(balanceSheet.period, 'quarter');
  assert.equal(balanceSheet.source, 'CAFEF');
  assert.match(balanceSheet.reason, /balance_sheet\/quarter/);

  const incomeStatement = buildStatementRemediation('ACB', 'income_statement', 'year', 'VNDIRECT');
  assert.equal(incomeStatement.statement, 'income_statement');
  assert.equal(incomeStatement.period, 'year');
});
