import type { ReactNode } from 'react';
import { text } from './format';
import { formatKey } from './structured-keys';

export { formatKey };

export function StructuredView({ data }: { data: Record<string, unknown> }): ReactNode {
  const primitives: [string, unknown][] = [];
  const complex: [string, unknown][] = [];

  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') {
      complex.push([k, v]);
    } else {
      primitives.push([k, v]);
    }
  }

  return (
    <div className="structured-view" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {primitives.length > 0 && (
        <dl className="stats" style={{ margin: 0 }}>
          {primitives.map(([k, v]) => (
            <div key={k}>
              <dt>{formatKey(k)}</dt>
              <dd>{text(typeof v === 'boolean' ? (v ? 'Có' : 'Không') : v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {complex.map(([k, v]) => (
        <div key={k} className="structured-block" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
          <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '0.4rem' }}>{formatKey(k)}</strong>
          {Array.isArray(v) ? (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
              {v.map((item, idx) => (
                <li key={idx} style={{ marginBottom: '0.25rem' }}>
                  {typeof item === 'object' && item !== null ? (
                    <StructuredView data={item as Record<string, unknown>} />
                  ) : (
                    text(item)
                  )}
                </li>
              ))}
            </ul>
          ) : typeof v === 'object' && v !== null ? (
            <StructuredView data={v as Record<string, unknown>} />
          ) : (
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{text(v)}</p>
          )}
        </div>
      ))}
    </div>
  );
}
