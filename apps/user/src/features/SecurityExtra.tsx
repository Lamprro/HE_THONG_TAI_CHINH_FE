import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot } from 'lucide-react';
import { apiData, apiPage, type Row } from '../shared/api';
import { compactVolume, date, decimal, text, tradingToday } from '../shared/format';
import { FinancialScenarioCard } from './FinancialScenarioCard';
import { Note, Pagination, QueryState } from '../shared/ui';

type Foreign = { id: string; tradingDate: string; buyVolume: string | null; sellVolume: string | null; volumeUnit: string; sourceCode: string };

export function ForeignPanel({ symbol, exchange }: { symbol: string; exchange: string }) {
  const [days, setDays] = useState(90);
  const [page, setPage] = useState(0);
  const to = tradingToday();
  const fromDate = new Date(to + 'T00:00:00Z'); fromDate.setUTCDate(fromDate.getUTCDate() - days);
  const from = fromDate.toISOString().slice(0, 10);
  const query = useQuery({ queryKey: ['foreign', symbol, exchange, from, page], staleTime: 1_800_000, queryFn: ({ signal }) => apiPage<Foreign>('foreignTrades', [symbol], { exchange, from, to, page, size: 100 }, signal) });
  const rows = query.data?.items || [];
  const nets = rows.map(r => (r.buyVolume === null || r.sellVolume === null) ? null : Number(r.buyVolume) - Number(r.sellVolume));
  const max = Math.max(1, ...nets.map(n => Math.abs(n ?? 0)));
  const total = nets.reduce<number>((sum, n) => sum + (n ?? 0), 0);
  return <section className="panel"><div className="panel-heading"><div><h2>Giao dịch khối ngoại</h2><span className="muted">Khối lượng mua/bán đã lưu (CP) · ròng trong khoảng: <b className={total >= 0 ? 'positive' : 'negative'}>{compactVolume(total)}</b></span></div><div className="segments">{[[30, '1T'], [90, '3T'], [180, '6T'], [365, '1N']].map(([v, l]) => <button key={v} className={days === v ? 'selected' : ''} onClick={() => { setDays(Number(v)); setPage(0); }}>{l}</button>)}</div></div>
    <QueryState loading={query.isPending} error={query.error} empty={!rows.length} retry={query.refetch}>
      <div className="net-bars" role="img" aria-label="Khối lượng ròng khối ngoại theo phiên">{nets.map((n, i) => <span key={rows[i].id} title={`${rows[i].tradingDate}: ${compactVolume(n)}`} className={(n ?? 0) >= 0 ? 'up' : 'down'} style={{ height: `${Math.abs(n ?? 0) / max * 50}%` }} />)}</div>
      <details><summary>Bảng chi tiết {rows.length} phiên</summary><div className="table-scroll price-history"><table><thead><tr><th>Phiên</th><th className="number">Mua</th><th className="number">Bán</th><th className="number">Ròng</th><th>Nguồn</th></tr></thead><tbody>{[...rows].reverse().map((r, i) => { const n = nets[rows.length - 1 - i]; return <tr key={r.id}><td>{date(r.tradingDate)}</td><td className="number">{decimal(r.buyVolume === null ? null : String(Math.round(Number(r.buyVolume))))}</td><td className="number">{decimal(r.sellVolume === null ? null : String(Math.round(Number(r.sellVolume))))}</td><td className={'number ' + ((n ?? 0) >= 0 ? 'positive' : 'negative')}>{compactVolume(n)}</td><td>{r.sourceCode}</td></tr>; })}</tbody></table></div></details>
    </QueryState>
    {query.data && (page > 0 || query.data.hasNext) && <Pagination page={page} total={query.data.total} hasNext={query.data.hasNext} onChange={setPage} />}
    <Note>Dữ liệu canonical đã lưu; thiếu khối lượng giữ trống, không thay bằng 0. Khối ngoại trong phiên hiện tại xem ở Sổ lệnh (nguồn trực tiếp).</Note>
  </section>;
}

export function AiPanel({ symbol, exchange }: { symbol: string; exchange: string }) {
  const forecasts = useQuery({ queryKey: ['forecasts', symbol, exchange], staleTime: 900_000, queryFn: ({ signal }) => apiData<Row[]>('forecasts', [symbol], { exchange, limit: 5 }, signal) });
  return <>
    <section className="panel"><div className="panel-heading"><div><h2><Bot size={16} /> Kịch bản tài chính AI (LLM)</h2><span className="muted">Chỉ hiển thị kết quả đã qua kiểm định và còn hiệu lực với dữ liệu nguồn hiện tại</span></div></div>
      <QueryState loading={forecasts.isPending} error={forecasts.error} retry={forecasts.refetch}>{forecasts.data?.data.length ? <div className="scenario-grid">{forecasts.data.data.map((row, i) => <FinancialScenarioCard key={[row.asOfDate, row.forecastPeriodEnd, row.targetScope, i].join(':')} row={row} />)}</div> : <div className="state"><strong>Chưa có kịch bản đủ điều kiện công bố</strong><span>Có thể chưa chạy, đã hết hiệu lực do dữ liệu nguồn đổi, hoặc chưa qua vòng kiểm định. Trang không tự gọi mô hình.</span></div>}</QueryState>
      <Note>Các kịch bản mang tính tham khảo. Giá trong kịch bản chưa được hiệu chỉnh thành giá mục tiêu.</Note>
    </section>
  </>;
}

type Reference = { id: string; observedAt: string; sourceEffectiveAt: string | null; industryName: string | null; outstandingShares: string | null; currentVenueListingDate: string | null; delistedDate: string | null; listingStatus: string | null; sourceCode: string };

export function ReferencePanel({ symbol, exchange }: { symbol: string; exchange: string }) {
  const [page, setPage] = useState(0);
  const query = useQuery({ queryKey: ['reference', symbol, exchange, page], staleTime: 3_600_000, queryFn: ({ signal }) => apiPage<Reference>('referenceObservations', [symbol], { exchange, page, size: 10 }, signal) });
  return <section className="panel"><div className="panel-heading"><div><h2>Lịch sử niêm yết</h2><span className="muted">Các lần quan sát dữ liệu tham chiếu từ nguồn, mới nhất trước</span></div></div>
    <QueryState loading={query.isPending} error={query.error} empty={!query.data?.items.length} retry={query.refetch}><div className="table-scroll"><table><thead><tr><th>Quan sát</th><th>Trạng thái</th><th>Ngày niêm yết sàn hiện tại</th><th>Hủy niêm yết</th><th className="number">CP lưu hành</th><th>Ngành</th><th>Nguồn</th></tr></thead><tbody>{query.data?.items.map(r => <tr key={r.id}><td>{date(r.observedAt)}</td><td>{text(r.listingStatus)}</td><td>{date(r.currentVenueListingDate)}</td><td>{date(r.delistedDate)}</td><td className="number">{decimal(r.outstandingShares)}</td><td>{text(r.industryName)}</td><td>{r.sourceCode}</td></tr>)}</tbody></table></div></QueryState>
    {query.data && (page > 0 || query.data.hasNext) && <Pagination page={page} total={query.data.total} hasNext={query.data.hasNext} onChange={setPage} />}
  </section>;
}
