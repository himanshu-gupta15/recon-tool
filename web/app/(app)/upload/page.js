'use client';
import { useEffect, useRef, useState } from 'react';
import { api, useApi, Loading, day } from '../../lib';

const BY = { saved: 'Saved mapping', ai: 'AI suggestion. Check it before approving', rules: 'Suggested by matching column names. Check it before approving' };

export default function Upload() {
  const meta = useApi('/sources'); const history = useApi('/uploads');
  const [sourceType, setSourceType] = useState(''); const [partner, setPartner] = useState(''); const [file, setFile] = useState(null);
  const [up, setUp] = useState(null); const [columns, setColumns] = useState({}); const [preview, setPreview] = useState(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [job, setJob] = useState(null);
  const inputRef = useRef(null);
  const source = meta.data?.sources.find((s) => s.key === sourceType);
  const partners = meta.data?.partners[sourceType] ?? [];
  const versions = useApi(up ? `/mappings?sourceType=${sourceType}&partner=${encodeURIComponent(partner)}` : null);

  useEffect(() => {
    if (!up) return;
    let live = true;
    api(`/uploads/${up.id}/preview`, { json: { columns } }).then((r) => live && setPreview(r.rows)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [up, columns]);

  useEffect(() => {
    if (!job || job.status !== 'running') return;
    const t = setInterval(async () => {
      const j = await api(`/jobs/${job._id}`).catch(() => null);
      if (j && j.status !== 'running') { setJob(j); history.reload(); }
    }, 800);
    return () => clearInterval(t);
  }, [job, history]);

  const reset = () => { setUp(null); setPreview(null); setFile(null); setColumns({}); if (inputRef.current) inputRef.current.value = ''; };

  const start = async (e) => {
    e.preventDefault(); setError(''); setJob(null); setBusy(true);
    const form = new FormData();
    form.append('sourceType', sourceType); form.append('partner', partner); form.append('file', file);
    try { const r = await api('/uploads', { method: 'POST', body: form }); setUp(r); setColumns(r.proposal.columns); } catch (err) { setError(err.message); }
    setBusy(false);
  };

  const commit = async () => {
    setError(''); setBusy(true);
    try {
      const r = await api(`/uploads/${up.id}/commit`, { json: { columns, proposedBy: up.proposal.by } });
      setJob({ _id: r.jobId, status: 'running', fileName: up.fileName }); reset();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  const restore = async (v) => {
    setColumns(Object.fromEntries(Object.entries(v.columns).filter(([, c]) => up.headers.includes(c))));
  };

  if (!meta.data) return <Loading q={meta} />;
  const missing = source?.fields.filter((f) => f.required && !columns[f.key]) ?? [];
  const badRows = preview?.filter((p) => p.errors.length).length ?? 0;
  const shown = source?.fields.filter((f) => columns[f.key]) ?? [];
  const cell = (v, type) => {
    if (v === undefined) return '—';
    if (type === 'money') return (v / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    if (type === 'date') return day(v);
    if (type === 'weight') return `${v / 1000} kg`;
    return String(v);
  };

  return (
    <>
      <div className="head"><div><h1>Upload files</h1><p className="sub">Upload the orders file first. New files recalculate every order. Uploading the same lines twice does not count them twice.</p></div></div>
      {error && <div className="notice err" role="alert">{error}</div>}
      {job?.status === 'running' && <div className="notice" role="status">Importing {job.fileName} and matching orders…</div>}
      {job?.status === 'failed' && <div className="notice err" role="alert">{job.fileName}: {job.error}</div>}
      {job?.status === 'done' && (
        <div className="notice good" role="status">
          <strong>{job.fileName}</strong>: {job.stats.rows.toLocaleString('en-IN')} rows read, {job.stats.duplicates} duplicates skipped, {job.stats.rejected} rejected, in {((job.importMs + job.matchMs) / 1000).toFixed(1)} seconds.
          {job.stats.errors?.length > 0 && <ul className="small" style={{ margin: '8px 0 0', paddingLeft: 18 }}>{job.stats.errors.slice(0, 8).map((e) => <li key={e.row}>Row {e.row}: {e.errors.join(', ')}</li>)}</ul>}
        </div>
      )}

      {!up && (
        <form onSubmit={start} className="form" style={{ marginBottom: 28 }}>
          <label className="f">Report type<select required value={sourceType} onChange={(e) => { setSourceType(e.target.value); setPartner(meta.data.partners[e.target.value]?.length === 1 ? meta.data.partners[e.target.value][0] : ''); }}><option value="">Choose</option>{meta.data.sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
          <label className="f">Partner<select required disabled={!sourceType} value={partner} onChange={(e) => setPartner(e.target.value)}><option value="">Choose</option>{partners.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label className="f">File (.csv or .xlsx, up to 60 MB)<input ref={inputRef} required type="file" accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <div><button className="btn primary" disabled={busy || !file}>{busy ? 'Reading…' : 'Continue'}</button></div>
        </form>
      )}

      {up && (
        <>
          {up.formatChanged && <div className="notice"><strong>{partner} changed its file format.</strong> The saved mapping no longer fits, so a new one is proposed below. It saves as a new version once you approve it.</div>}
          {up.seenBefore && <div className="notice">This exact file was imported on {day(up.seenBefore.at)}. Importing again won't double count.</div>}
          <div className="row spread" style={{ marginBottom: 12 }}>
            <div><h2 style={{ margin: 0 }}>Match the columns in {up.fileName}</h2><p className="small muted">{BY[up.proposal.by]}{up.proposal.version ? ` (version ${up.proposal.version})` : ''}. Columns you don't map are never stored.</p></div>
            <div className="row">
              <button className="btn" onClick={reset}>Cancel</button>
              <button className="btn primary" disabled={busy || missing.length > 0} onClick={commit}>Approve and import</button>
            </div>
          </div>
          <div className="form" style={{ marginBottom: 22 }}>
            {source.fields.map((f) => (
              <label className="f" key={f.key}>
                <span>{f.label}{f.required ? ' (required)' : ''}{f.personal ? ', personal data' : ''}</span>
                <select value={columns[f.key] ?? ''} onChange={(e) => setColumns({ ...columns, [f.key]: e.target.value })} style={f.required && !columns[f.key] ? { borderColor: 'var(--risk)' } : undefined}>
                  <option value="">Not in this file</option>
                  {up.headers.map((h) => <option key={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          {missing.length > 0 && <div className="notice err">Still needed: {missing.map((f) => f.label).join(', ')}</div>}
          <h2>Preview of the first {preview?.length ?? 0} rows as they will import {badRows > 0 && <span className="neg">({badRows} with problems)</span>}</h2>
          <div className="tablewrap" style={{ maxHeight: 420, overflow: 'auto' }}><table>
            <thead><tr>{shown.map((f) => <th key={f.key} className={f.type === 'money' ? 'num' : ''}>{f.label}</th>)}<th>Problems</th></tr></thead>
            <tbody>{preview?.map((p, i) => (
              <tr key={i}>
                {shown.map((f) => <td key={f.key} className={f.type === 'money' ? 'num' : ''}>{cell(p.doc[f.key], f.type)}</td>)}
                <td className="neg small">{p.errors.join(', ')}</td>
              </tr>
            ))}</tbody>
          </table></div>
          {versions.data?.length > 0 && (
            <div className="section"><h2>Earlier mappings for {partner}</h2>
              {versions.data.map((v) => <div className="row small" key={v._id} style={{ marginBottom: 6 }}><span>Version {v.version}, approved by {v.approvedBy} on {day(v.approvedAt)}</span><button className="btn small" onClick={() => restore(v)}>Use this one</button></div>)}
            </div>
          )}
        </>
      )}

      {!up && history.data && (
        <section><h2>Recent files</h2>
          <div className="tablewrap"><table>
            <thead><tr><th>File</th><th>Type</th><th>Partner</th><th className="num">Rows</th><th className="num">Rejected</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {history.data.map((u) => <tr key={u._id}><td>{u.fileName}</td><td>{meta.data.sources.find((s) => s.key === u.sourceType)?.label}</td><td>{u.partner}</td><td className="num">{u.stats?.rows?.toLocaleString('en-IN') ?? '—'}</td><td className="num">{u.stats?.rejected ?? '—'}</td><td title={u.error}>{u.status === 'failed' ? <span className="neg">Failed</span> : u.status === 'imported' ? 'Imported' : 'Importing'}</td><td>{day(u.importedAt ?? u.createdAt)}</td></tr>)}
              {!history.data.length && <tr><td colSpan={7} className="empty">No files yet</td></tr>}
            </tbody>
          </table></div>
        </section>
      )}
    </>
  );
}
