import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowRight, Loader2 } from 'lucide-react';
import { API_BASE, getJson } from '../../shared/api/client';
import type { Row } from './Records';

export function ActiveCommandsBanner({ onSelectCommand }: { onSelectCommand: (id: string) => void }) {
  const queryClient = useQueryClient();
  const previousRunning = useRef<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ['active-admin-commands'],
    queryFn: () => getJson<{ rows: Row[]; total: number }>(API_BASE, '/api/admin/console/data/admin_commands?page=0&size=10'),
    refetchInterval: 3000,
    staleTime: 2000,
  });

  const rows = query.data?.rows || [];
  const active = rows.filter(r => r.status === 'RUNNING' || r.status === 'QUEUED');

  useEffect(() => {
    const currentRunning = new Set(active.map(r => String(r.id)));
    // Check if any previously running command has finished
    let hasFinished = false;
    for (const id of previousRunning.current) {
      if (!currentRunning.has(id)) {
        hasFinished = true;
        break;
      }
    }
    if (hasFinished) {
      // Auto-invalidate active queries to refresh view
      void queryClient.invalidateQueries({ type: 'active' });
    }
    previousRunning.current = currentRunning;
  }, [active, queryClient]);

  if (active.length === 0) return null;

  return (
    <div
      className="active-commands-banner"
      style={{
        background: 'linear-gradient(90deg, #1e1b4b 0%, #312e81 100%)',
        border: '1px solid #4338ca',
        color: '#e0e7ff',
        padding: '0.5rem 1rem',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.75rem',
        fontSize: '0.875rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Loader2 size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
        <span>
          Đang chạy <b>{active.length}</b> tác vụ nền:{' '}
          {active.map(c => `${c.action || 'LỆNH'} (${c.status})`).join(', ')}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {active.map(c => (
          <button
            key={String(c.id)}
            className="light-button"
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', background: '#3730a3', color: '#fff', border: 'none' }}
            onClick={() => onSelectCommand(String(c.id))}
          >
            Theo dõi {String(c.action || c.id).slice(0, 15)} <ArrowRight size={12} style={{ display: 'inline' }} />
          </button>
        ))}
      </div>
    </div>
  );
}
