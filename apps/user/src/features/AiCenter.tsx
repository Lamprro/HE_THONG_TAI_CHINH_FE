import { useQuery } from '@tanstack/react-query';
import { Bot } from 'lucide-react';
import { apiData } from '../shared/api';
import { text } from '../shared/format';
import { QueryState } from '../shared/ui';

type Availability = {
  newsAnalysis: { readerAvailable: boolean; publicationGuard: string }; financialScenarios: { readerAvailable: boolean; publicationGuard: string }; executesModels: boolean;
};
export function AiCenterPage() {
  const availability = useQuery({ queryKey: ['analysis-availability'], staleTime: 900_000, queryFn: ({ signal }) => apiData<Availability>('analysisAvailability', [], {}, signal) });
  const a = availability.data?.data;

  return <>
    <div className="page-heading"><div><p className="eyebrow">PHÂN TÍCH BẰNG AI</p><h1>Trung tâm AI</h1><p>Tình trạng các luồng AI: phân tích tin và kịch bản tài chính bằng LLM.</p></div></div>
    <QueryState loading={availability.isPending} error={availability.error} retry={availability.refetch}>
      <div className="ai-status-grid">
        <article className="ai-status"><Bot size={18} /><h3>Phân tích tin tức</h3><strong className={a?.newsAnalysis.readerAvailable ? 'positive' : 'muted'}>{a?.newsAnalysis.readerAvailable ? 'Sẵn sàng đọc' : 'Chưa sẵn sàng'}</strong><small>Chỉ hiển thị kết quả qua kiểm định ({text(a?.newsAnalysis.publicationGuard)}). Xem trong từng bài tin.</small></article>
        <article className="ai-status"><Bot size={18} /><h3>Kịch bản tài chính</h3><strong className={a?.financialScenarios.readerAvailable ? 'positive' : 'muted'}>{a?.financialScenarios.readerAvailable ? 'Sẵn sàng đọc' : 'Chưa sẵn sàng'}</strong><small>Xem ở tab “AI & Dự báo” của từng mã.</small></article>
      </div>
    </QueryState>

  </>;
}
