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
    queryFn: () => getJson<{ rows: Row[]; total: number }>(API_BASE, '/api/admin/console/data/admin_commands?status=QUEUED,RUNNING&size=20'),
    refetchInterval: 3000,
    staleTime: 2000,
  });

  const active = query.data?.rows || [];

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
      // Invalidate specific resource queries instead of wiping entire client cache
      void queryClient.invalidateQueries({ queryKey: ['admin-commands'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['active-admin-commands'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-local-ai-models'] });
      void queryClient.invalidateQueries({ queryKey: ['local-ai-training-runs'] });
      void queryClient.invalidateQueries({ queryKey: ['local-ai-readiness'] });
    }
    previousRunning.current = currentRunning;
  }, [active, queryClient]);

  if (active.length === 0) return null;

  return (
    <div className="active-commands-banner">
      <div className="active-commands-info">
        <Loader2 size={15} className="spinner" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
        <span>
          Đang chạy <b>{active.length}</b> tác vụ nền:{' '}
          {active.map(c => `${c.action || 'LỆNH'} (${c.status})`).join(', ')}
        </span>
      </div>
      <div className="active-commands-actions">
        {active.map(c => (
          <button
            key={String(c.id)}
            className="light-button"
            style={{ padding: '3px 8px', fontSize: '11px', background: '#3730a3', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}
            onClick={() => onSelectCommand(String(c.id))}
          >
            Theo dõi {String(c.action || c.id).slice(0, 12)} <ArrowRight size={11} style={{ display: 'inline' }} />
          </button>
        ))}
      </div>
    </div>
  );
}
