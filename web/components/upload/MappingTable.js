'use client';
import { AlertCircle, Check, Lock, Minus, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui';
import { confidenceLevel, sampleText } from './helpers';

function Confidence({ level }) {
  if (!level) return <span className="faint t-meta">—</span>;
  return <span className={`conf ${level}`}><span className="bars" aria-hidden="true"><i /><i /><i /></span>{level[0].toUpperCase() + level.slice(1)}</span>;
}

// One row per field Recon needs. The user picks which source column feeds it.
export default function MappingTable({ fields, headers, rows, columns, proposal, onChange }) {
  const used = new Set(Object.values(columns).filter(Boolean));
  const unmapped = headers.filter((h) => !used.has(h));
  return (
    <>
      <div className="table-wrap">
        <table className="table responsive">
          <thead>
            <tr><th style={{ width: '24%' }}>Recon field</th><th style={{ width: '26%' }}>Source column</th><th>Suggested by</th><th>Confidence</th><th>Sample values</th><th>Status</th></tr>
          </thead>
          <tbody>
            {fields.map((f) => {
              const col = columns[f.key] ?? '';
              const proposed = proposal.columns[f.key];
              const changed = col !== (proposed ?? '');
              const missing = f.required && !col;
              const samples = col ? rows.slice(0, 3).map((r) => sampleText(r[col])).filter(Boolean) : [];
              const by = !col ? null : changed ? 'manual' : proposal.by;
              return (
                <tr key={f.key} style={missing ? { background: 'color-mix(in srgb, var(--critical-bg) 55%, transparent)' } : undefined}>
                  <td className="m-primary">
                    <div className="cell-main">{f.label}</div>
                    <div className="row gap-4 mt-4" style={{ flexWrap: 'wrap' }}>
                      {f.required ? <span className="t-meta">Required</span> : <span className="t-meta faint">Optional</span>}
                      {f.personal && <span className="tag" title="Masked for everyone except the co-founder"><Lock aria-hidden="true" />Personal</span>}
                    </div>
                  </td>
                  <td data-label="Source column">
                    <select className={`select sm ${missing ? 'invalid' : ''}`} style={{ width: '100%', minWidth: 160 }} aria-label={`Source column for ${f.label}`} value={col} onChange={(e) => onChange({ ...columns, [f.key]: e.target.value })}>
                      <option value="">— Not in this file —</option>
                      {headers.map((h) => <option key={h} value={h} disabled={used.has(h) && h !== col}>{h}{used.has(h) && h !== col ? ' (used)' : ''}</option>)}
                    </select>
                  </td>
                  <td data-label="Suggested by">
                    {by === 'ai' ? <Badge tone="accent" icon={Sparkles}>AI suggested</Badge> : by === 'saved' ? <Badge tone="neutral" plain>Saved v{proposal.version}</Badge> : by === 'rules' ? <Badge tone="neutral" plain>Name match</Badge> : by === 'manual' ? <Badge tone="info" plain>Changed by you</Badge> : <span className="faint t-meta">—</span>}
                  </td>
                  <td data-label="Confidence">{by === 'ai' || by === 'rules' ? <Confidence level={confidenceLevel(proposal.confidence?.[f.key])} /> : by === 'saved' ? <span className="conf high"><span className="bars" aria-hidden="true"><i /><i /><i /></span>Approved before</span> : <span className="faint t-meta">—</span>}</td>
                  <td data-label="Samples">{samples.length ? <div className="samples">{samples.map((s, i) => <span key={i} title={s}>{s}</span>)}</div> : <span className="faint t-meta">—</span>}</td>
                  <td className="m-status">
                    {missing ? <Badge tone="critical" icon={AlertCircle}>Needs a column</Badge> : col ? <Badge tone="success" icon={Check}>Mapped</Badge> : <Badge tone="neutral" icon={Minus}>Skipped</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {unmapped.length > 0 && (
        <div className="table-foot" style={{ justifyContent: 'flex-start' }}>
          <span>Not imported ({unmapped.length}):</span>
          <div className="samples">{unmapped.map((h) => <span key={h}>{h}</span>)}</div>
          <span className="faint">Unmapped columns are never stored.</span>
        </div>
      )}
    </>
  );
}
