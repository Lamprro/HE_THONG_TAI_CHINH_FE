import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE, postJson } from '../../shared/api/client';
import { Panel } from '../../shared/components/Ui';

const operations = {
  master: { label: 'Nạp danh mục công ty và mã', path: '/api/admin/catalog/master-data/seed' },
  jobs: { label: 'Nạp danh mục job', path: '/api/admin/catalog/ingestion-jobs/seed' },
  prompts: { label: 'Nạp prompt phân tích tin', path: '/api/admin/catalog/news-prompts/seed' },
  forecast: { label: 'Nạp prompt dự báo tài chính', path: '/api/admin/forecasts/template/seed' },
  recovery: { label: 'Nạp prompt khôi phục nội dung tin', path: '/api/admin/news-recovery/template/seed' },
  rules: { label: 'Nạp quy tắc kiểm định', path: '/api/admin/validation/rules/seed' },
  retries: { label: 'Đưa giới hạn thử lại của job về mặc định', path: '/api/admin/catalog/ingestion-jobs/retry-budget' },
} as const;

type CatalogAction = keyof typeof operations;

export function CatalogMaintenancePanel() {
  const [selected, setSelected] = useState<CatalogAction>();
  const queries = useQueryClient();
  const mutation = useMutation({
    mutationFn: (action: CatalogAction) => postJson<{ count?: number; seeded?: number; inserted?: number }>(API_BASE, operations[action].path),
    onSuccess: () => { setSelected(undefined); void queries.invalidateQueries(); },
    retry: false,
  });

  return <Panel title="Nạp danh mục"
    action={<a className="light-button" href={API_BASE + '/admin-api-docs/index.html'} target="_blank" rel="noreferrer">Mở Swagger UI</a>}>
    <div className="toolbar">
      {(Object.keys(operations) as CatalogAction[]).map(action => <button key={action} className="light-button"
        disabled={mutation.isPending} onClick={() => { mutation.reset(); setSelected(action); }}>
        {operations[action].label}
      </button>)}
    </div>
    {selected && <div className="toolbar" aria-label="Xác nhận nạp danh mục">
      <span>{operations[selected].label}</span>
      <button className="light-button" disabled={mutation.isPending} onClick={() => setSelected(undefined)}>Hủy</button>
      <button className="primary-button" disabled={mutation.isPending}
        onClick={() => { if (!mutation.isPending) mutation.mutate(selected); }}>Xác nhận nạp</button>
    </div>}
    {mutation.isSuccess && <p role="status">Hoàn tất · {mutation.data.count ?? mutation.data.seeded ?? mutation.data.inserted ?? '—'} bản ghi.</p>}
    {mutation.isError && <p role="alert">{mutation.error.message}</p>}
  </Panel>;
}
