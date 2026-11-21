import type { ReactNode } from 'react';
import { text } from './format';
import { formatKey } from './structured-keys';

export { formatKey };

const IGNORED_KEYS = new Set([
  'raw_id', 'source_raw_id', 'record_sha256', 'source_sha256',
  'schema_version', 'manifest_sha256', 'evidence_sha256',
]);

function tryParseJson(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return val;
    }
  }
  return val;
}

export function StructuredView({
  data,
  depth = 0,
  maxDepth = 3,
}: {
  data: Record<string, unknown>;
  depth?: number;
  maxDepth?: number;
}): ReactNode {
  if (depth > maxDepth) {
    return <span className="subtle" style={{ fontSize: '0.85rem' }}>{text(data)}</span>;
  }

  const primitives: [string, unknown][] = [];
  const complex: [string, unknown][] = [];

  for (const [k, rawV] of Object.entries(data)) {
    if (rawV === null || rawV === undefined) continue;
    if (IGNORED_KEYS.has(k)) continue;

    const v = tryParseJson(rawV);
    if (typeof v === 'object' && v !== null) {
      complex.push([k, v]);
    } else {
      primitives.push([k, v]);
    }
  }

  const formatPrimitiveValue = (val: unknown): string => {
    if (typeof val === 'boolean') return val ? 'Có' : 'Không';
    if (typeof val === 'string') {
      // If it looks like a SHA-256 hex hash
      if (/^[a-f0-9]{64}$/i.test(val)) {
        return `SHA: ${val.slice(0, 8)}…`;
      }
      // If it looks like a UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
        return `${val.slice(0, 8)}…`;
      }
    }
    return text(val);
  };

  return (
    <div className="structured-view" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {primitives.length > 0 && (
        <dl className="stats" style={{ margin: 0 }}>
          {primitives.map(([k, v]) => (
            <div key={k}>
              <dt>{formatKey(k)}</dt>
              <dd>{formatPrimitiveValue(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {complex.map(([k, v]) => (
        <div key={k} className="structured-block" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
          <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '0.4rem' }}>{formatKey(k)}</strong>
          {Array.isArray(v) ? (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
              {v.map((item, idx) => {
                const parsedItem = tryParseJson(item);
                return (
                  <li key={idx} style={{ marginBottom: '0.25rem' }}>
                    {typeof parsedItem === 'object' && parsedItem !== null ? (
                      <StructuredView data={parsedItem as Record<string, unknown>} depth={depth + 1} maxDepth={maxDepth} />
                    ) : (
                      formatPrimitiveValue(parsedItem)
                    )}
                  </li>
                );
              })}
            </ul>
          ) : typeof v === 'object' && v !== null ? (
            <StructuredView data={v as Record<string, unknown>} depth={depth + 1} maxDepth={maxDepth} />
          ) : (
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{formatPrimitiveValue(v)}</p>
          )}
        </div>
      ))}
    </div>
  );
}
