import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowRight } from 'lucide-react';
import { API_BASE, getJson } from '../../shared/api/client';

export function ActiveCommandsBanner({ onSelectCommand, onOpenHistory }: {
  onSelectCommand: (id: string) => void; onOpenHistory: () => void;
}) {
  const queryClient = useQueryClient();
  const previous = useRef(new Set<string>());
  const { data } = useQuery({
    queryKey: ['active-admin-commands'],
    queryFn: () => getJson<{ rows: { id: string; status: 'QUEUED' | 'RUNNING' }[]; total: number }>(
      API_BASE, '/api/admin/console/data/admin_commands?status=QUEUED,RUNNING&size=20',
    ),
    refetchInterval: 3000,
    staleTime: 2000,
  });

  const active = Array.isArray(data?.rows) ? data : undefined;
  useEffect(() => {
    if (!active) return;
    const current = new Set(active.rows.map(row => row.id));
    if ([...previous.current].some(id => !current.has(id))) {
      void queryClient.invalidateQueries({ queryKey: ['system-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-rows', 'admin_commands'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-rows', 'ingestion_runs'] });
      void queryClient.invalidateQueries({ queryKey: ['runs'] });
    }
    previous.current = current;
  }, [active, queryClient]);

  if (!active?.total) return null;
  const command = active.total === 1 ? active.rows[0] : undefined;
  const title = command
    ? (command.status === 'QUEUED' ? '1 tác vụ đang chờ' : '1 tác vụ đang chạy')
    : active.total.toLocaleString('vi-VN') + ' tác vụ chờ hoặc đang chạy';

  return <div className="active-commands-banner">
    <span><Activity size={15} aria-hidden="true"/>{title}</span>
    <button className="text-button" onClick={() => command ? onSelectCommand(command.id) : onOpenHistory()}>
      {command ? 'Theo dõi tác vụ' : 'Xem tác vụ nền'} <ArrowRight size={13} aria-hidden="true"/>
    </button>
  </div>;
}
