import type { WorkflowSelection } from './WorkflowPage';

const INDEX_SYMBOLS = new Set(['VNINDEX', 'VN30', 'HNXINDEX', 'HNX30', 'UPCOM']);

/**
 * Returns the most recent trading weekday (Monday–Friday) in Asia/Ho_Chi_Minh time.
 * If today is Saturday or Sunday, rolls back to Friday.
 */
export function getLatestTradingWeekday(now: Date = new Date()): string {
  // Format now in Vietnam timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(now); // "YYYY-MM-DD"
  const [y, m, d] = dateStr.split('-').map(Number);
  
  // Create UTC date with same year/month/day to do calendar day arithmetic safely
  const localDay = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = localDay.getUTCDay(); // 0 is Sunday, 6 is Saturday

  if (dayOfWeek === 0) {
    // Sunday -> Friday (-2 days)
    localDay.setUTCDate(localDay.getUTCDate() - 2);
  } else if (dayOfWeek === 6) {
    // Saturday -> Friday (-1 day)
    localDay.setUTCDate(localDay.getUTCDate() - 1);
  }

  return localDay.toISOString().slice(0, 10);
}

/**
 * Computes the coverage health status of a security row dynamically.
 * A row has a price gap if it has 0 prices or its latest price is older than the latest trading weekday.
 * A row has a statement gap if it has 0 canonical statements.
 */
export function computeRowStatus(
  dailyPrices: number,
  lastPrice: string | null,
  canonicalStatements: number,
  latestTradingWeekday: string
): 'HEALTHY' | 'GAP_PRICE' | 'GAP_STATEMENTS' {
  const hasNoPrices = dailyPrices === 0;
  const isPriceOutdated = lastPrice ? lastPrice < latestTradingWeekday : true;

  if (hasNoPrices || isPriceOutdated) {
    return 'GAP_PRICE';
  }
  if (canonicalStatements === 0) {
    return 'GAP_STATEMENTS';
  }
  return 'HEALTHY';
}

/**
 * Builds the initial WorkflowSelection for remediating missing prices.
 * Caps startDate at latestTradingWeekday so it never produces an invalid forward date.
 */
export function buildPriceRemediation(
  symbol: string,
  lastPrice: string | null,
  latestTradingWeekday: string = getLatestTradingWeekday()
): WorkflowSelection {
  const isIndex = INDEX_SYMBOLS.has(symbol.toUpperCase());
  const operation = isIndex ? 'INDEX_OHLCV' : 'OHLCV';
  const source = 'VNDIRECT';

  let startDate = '2021-01-01';
  if (lastPrice && lastPrice !== '—') {
    const nextDay = new Date(lastPrice + 'T00:00:00Z');
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const candidate = nextDay.toISOString().slice(0, 10);
    // Do not exceed latest trading weekday
    startDate = candidate <= latestTradingWeekday ? candidate : latestTradingWeekday;
  }

  return {
    mode: 'INGEST_VALIDATE_BUILD',
    operation,
    source,
    symbol: symbol.toUpperCase(),
    startDate,
    endDate: latestTradingWeekday,
    reason: `Bổ sung khoảng thiếu giá lịch sử cho mã ${symbol} từ ${startDate} đến ${latestTradingWeekday}`,
  };
}

/**
 * Builds the initial WorkflowSelection for remediating financial statements.
 */
export function buildStatementRemediation(
  symbol: string,
  statement: string = 'balance_sheet',
  period: string = 'quarter',
  source: string = 'VNDIRECT'
): WorkflowSelection {
  return {
    mode: 'INGEST_VALIDATE_BUILD',
    operation: 'FINANCIAL_STATEMENT',
    source,
    symbol: symbol.toUpperCase(),
    statement,
    period,
    reason: `Lấy và cập nhật báo cáo tài chính (${statement}/${period}) cho mã ${symbol}`,
  };
}
