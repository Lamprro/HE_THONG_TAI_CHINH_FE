import { Children, isValidElement, useState, type ReactNode } from 'react';

export const pageSizes = [10, 50, 100, 500];

export function ListTitle({ title, onOpen }: { title: string; onOpen: () => void }) {
  return <button type="button" className="list-title" title={title} onClick={onOpen}>{title}</button>;
}
export const usePagination = () => {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  return { page, size, setPage, changeSize: (next: number) => { setSize(next); setPage(0); } };
};

export function Pagination({ page, size, total, onPage, onSize, busy }: {
  page: number; size: number; total: number; onPage: (page: number) => void; onSize: (size: number) => void; busy?: boolean;
}) {
  return <div className="toolbar ledger-pager">
    <span>{total.toLocaleString('vi-VN')} bản ghi · Trang {page + 1}</span>
    <label>Bản ghi mỗi trang<select value={size} onChange={event => onSize(Number(event.target.value))}>
      {pageSizes.map(value => <option key={value}>{value}</option>)}
    </select></label>
    <button type="button" className="light-button" disabled={page === 0 || busy} onClick={() => onPage(page - 1)}>Trang trước</button>
    <button type="button" className="light-button" disabled={(page + 1) * size >= total || busy} onClick={() => onPage(page + 1)}>Trang sau</button>
  </div>;
}

export function PaginatedTable({ children }: { children: ReactNode }) {
  const { page, size, setPage, changeSize } = usePagination();
  const sections = Children.toArray(children);
  const body = sections.find(section => isValidElement<{ children: ReactNode }>(section) && section.type === 'tbody');
  const rows = isValidElement<{ children: ReactNode }>(body) ? Children.toArray(body.props.children) : [];
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / size) - 1));
  return <>
    <table>{sections.map(section => section === body
      ? <tbody key="rows">{rows.slice(current * size, (current + 1) * size)}</tbody>
      : section)}</table>
    <Pagination page={current} size={size} total={rows.length} onPage={setPage} onSize={changeSize}/>
  </>;
}
