'use client';
import { useState } from 'react';
import { STATUS } from '@/lib/status';
import { num, pct } from '@/lib/format';

// Stacked columns of order counts per period, one segment per status.
export function StackedColumns({ data, keys, height = 220, formatBucket = (b) => b, unitLabel = 'orders' }) {
  const [hover, setHover] = useState(null);
  const W = 720; const H = height; const padL = 36; const padB = 24; const padT = 8;
  const max = Math.max(1, ...data.map((d) => keys.reduce((t, k) => t + (d[k] ?? 0), 0)));
  const nice = niceMax(max); const ticks = [0, nice / 2, nice];
  const n = Math.max(1, data.length); const slot = (W - padL) / n; const bw = Math.max(4, Math.min(34, slot * 0.62));
  const y = (v) => H - padB - (v / nice) * (H - padB - padT);
  const every = Math.ceil(n / 8);
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }} role="img" aria-label={`Stacked chart of ${unitLabel} by status per period`}>
        {ticks.map((t) => <g key={t}><line className="grid-line" x1={padL} x2={W} y1={y(t)} y2={y(t)} /><text x={padL - 8} y={y(t) + 4} textAnchor="end">{compactNum(t)}</text></g>)}
        {data.map((d, i) => {
          let acc = 0; const x = padL + i * slot + (slot - bw) / 2;
          return (
            <g key={d.bucket} className="col" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)}>
              <rect x={padL + i * slot} y={padT} width={slot} height={H - padB - padT} fill="transparent" />
              {keys.map((k) => {
                const v = d[k] ?? 0; if (!v) return null;
                const y0 = y(acc); acc += v; const y1 = y(acc);
                return <rect key={k} className="seg" x={x} y={y1} width={bw} height={Math.max(0, y0 - y1 - (acc === v ? 0 : 1))} fill={STATUS[k]?.color} rx={1.5} opacity={hover === null || hover === i ? 1 : 0.45} />;
              })}
              {i % every === 0 && <text x={x + bw / 2} y={H - 6} textAnchor="middle">{formatBucket(d.bucket)}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div className="chart-tip" style={{ left: `clamp(0px, calc(${((padL + hover * slot + slot / 2) / W) * 100}% - 90px), calc(100% - 190px))`, top: 0 }}>
          <div className="strong" style={{ marginBottom: 6 }}>{formatBucket(data[hover].bucket, true)}</div>
          {keys.filter((k) => data[hover][k]).map((k) => (
            <div className="tip-row" key={k}><i style={{ background: STATUS[k]?.color }} /><span>{STATUS[k]?.label}</span><span className="tnum strong">{num(data[hover][k])}</span></div>
          ))}
          <div className="tip-row" style={{ borderTop: '1px solid var(--line-2)', marginTop: 4, paddingTop: 4 }}><i /><span className="muted">Total</span><span className="tnum strong">{num(data[hover].total)}</span></div>
        </div>
      )}
    </div>
  );
}

// 100% bar with a legend that carries the numbers.
export function Distribution({ items, total, onSelect }) {
  const shown = items.filter((i) => i.count > 0);
  return (
    <div className="stack gap-16">
      <div className="dist" role="img" aria-label={shown.map((i) => `${i.label} ${pct(i.count / total)}`).join(', ')}>
        {shown.map((i) => <i key={i.key} style={{ width: `${(i.count / total) * 100}%`, background: i.color }} title={`${i.label}: ${num(i.count)} (${pct(i.count / total)})`} />)}
      </div>
      <div className="legend">
        {items.map((i) => (
          <div className="legend-item" key={i.key}>
            <span className="sw" style={{ background: i.color }} />
            {onSelect ? <button type="button" className="link" style={{ color: 'var(--ink)', fontWeight: 400 }} onClick={() => onSelect(i.key)}>{i.label}</button> : <span>{i.label}</span>}
            <span><span className="lv">{num(i.count)}</span><span className="lp">{total ? pct(i.count / total, 1) : '—'}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarList({ items, format, color = 'var(--accent)' }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="barlist">
      {items.map((i) => (
        <div className="barlist-row" key={i.key}>
          <span className="truncate">{i.href ? <a href={i.href} className="link" style={{ color: 'var(--ink)', fontWeight: 400 }}>{i.label}</a> : i.label}{i.sub && <span className="faint" style={{ marginLeft: 6, fontSize: 12 }}>{i.sub}</span>}</span>
          <span className="tnum strong">{format ? format(i.value) : num(i.value)}</span>
          <div className="track"><i style={{ width: `${(i.value / max) * 100}%`, background: i.color ?? color }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values, width = 84, height = 28, color = 'var(--accent)' }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values); const min = Math.min(...values); const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={color} opacity="0.08" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts.at(-1)[0]} cy={pts.at(-1)[1]} r="2.2" fill={color} />
    </svg>
  );
}

function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v)); const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}
const compactNum = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : String(v));
