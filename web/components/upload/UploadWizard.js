'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Box, CheckCircle2, FileCheck2, History, Inbox, Package, Receipt, RotateCcw, Sparkles, Truck, Wallet, Warehouse } from 'lucide-react';
import { api, uploadWithProgress, useApi } from '@/lib/api';
import { day, num, pct } from '@/lib/format';
import { SOURCE_LABEL } from '@/lib/status';
import { useApp } from '@/components/shell/AppContext';
import { Alert, Badge, Button, EmptyState, Field } from '@/components/ui';
import Stepper from './Stepper';
import FileDrop, { FileRow } from './FileDrop';
import MappingTable from './MappingTable';
import { STEPS, guessSource, validateFile, formatCell, readCsvHeader } from './helpers';

const SOURCE_META = {
  orders: { icon: Package, sub: 'Your order export. Upload first.' },
  settlement: { icon: Wallet, sub: 'Marketplace / channel payouts' },
  cod: { icon: Receipt, sub: 'Courier COD remittances' },
  freight: { icon: Truck, sub: 'Courier freight invoices' },
  warehouse: { icon: Warehouse, sub: 'Return receipt scans' },
};
const BY_TEXT = {
  saved: (v) => `Using the mapping you approved before (version ${v}). Check it still fits.`,
  ai: () => 'Claude suggested this mapping from column names and masked sample values. Review each row before approving.',
  rules: () => 'Suggested by matching column names. Review each row before approving.',
};

function Footer({ children }) {
  return <div className="card-foot" style={{ flexWrap: 'wrap' }}>{children}</div>;
}

export default function UploadWizard({ onImported }) {
  const { user, refreshCounts } = useApp();
  const meta = useApi('/sources');
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null); const [fileError, setFileError] = useState('');
  const [sourceType, setSourceType] = useState(''); const [partner, setPartner] = useState(''); const [guess, setGuess] = useState(null);
  const [progress, setProgress] = useState(0); const [uploading, setUploading] = useState(false);
  const [up, setUp] = useState(null); const [columns, setColumns] = useState({});
  const [preview, setPreview] = useState(null); const [previewError, setPreviewError] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);
  const versions = useApi(up ? `/mappings?sourceType=${sourceType}&partner=${encodeURIComponent(partner)}` : null);
  const returnsOnly = user.role === 'returns';

  const sources = meta.data?.sources ?? [];
  const source = sources.find((s) => s.key === sourceType);
  const partners = meta.data?.partners[sourceType] ?? [];

  // Live preview of the first 20 rows as they would import.
  useEffect(() => {
    if (!up) return undefined;
    let live = true;
    api(`/uploads/${up.id}/preview`, { json: { columns } })
      .then((r) => { if (live) { setPreview(r.rows); setPreviewError(''); } })
      .catch((e) => live && setPreviewError(e.message));
    return () => { live = false; };
  }, [up, columns]);

  // Poll the import job.
  useEffect(() => {
    if (!job || job.status !== 'running') return undefined;
    const t = setInterval(async () => {
      const j = await api(`/jobs/${job._id}`).catch(() => null);
      if (j && j.status !== 'running') { setJob(j); if (j.status === 'done') { setStep(6); refreshCounts(); } onImported?.(); }
    }, 800);
    return () => clearInterval(t);
  }, [job, onImported, refreshCounts]);

  const reset = () => { setStep(0); setFile(null); setFileError(''); setUp(null); setColumns({}); setPreview(null); setError(''); setJob(null); setProgress(0); setGuess(null); setSourceType(''); setPartner(''); };

  const pickFile = async (f) => {
    const err = validateFile(f); setFile(f); setFileError(err); setError('');
    if (err || !meta.data) return;
    const header = await readCsvHeader(f).catch(() => null);
    const g = guessSource(f.name, meta.data.partners, header);
    if (returnsOnly) { g.type = 'warehouse'; g.partner = meta.data.partners.warehouse?.[0] ?? ''; }
    setGuess(g); setSourceType(g.type); setPartner(g.partner || (g.type && meta.data.partners[g.type]?.length === 1 ? meta.data.partners[g.type][0] : ''));
    setStep(1);
  };

  const send = async () => {
    setError(''); setUploading(true); setProgress(0);
    const form = new FormData();
    form.append('sourceType', sourceType); form.append('partner', partner); form.append('file', file);
    try {
      const r = await uploadWithProgress('/uploads', form, setProgress);
      setUp(r); setColumns(r.proposal.columns); setStep(2);
    } catch (e) { setError(e.message); }
    setUploading(false);
  };

  const commit = async () => {
    setError(''); setBusy(true);
    try {
      const r = await api(`/uploads/${up.id}/commit`, { json: { columns, proposedBy: up.proposal.by } });
      setJob({ _id: r.jobId, status: 'running', fileName: up.fileName }); setStep(5);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const missing = source?.fields.filter((f) => f.required && !columns[f.key]) ?? [];
  const badRows = preview?.filter((p) => p.errors.length).length ?? 0;
  const mapped = source?.fields.filter((f) => columns[f.key]) ?? [];
  const lastVersion = versions.data?.[0];
  const willSaveVersion = !lastVersion || JSON.stringify(lastVersion.columns) !== JSON.stringify(Object.fromEntries(Object.entries(columns).filter(([, v]) => v)));
  const changedCount = useMemo(() => (up ? Object.keys({ ...up.proposal.columns, ...columns }).filter((k) => (columns[k] ?? '') !== (up.proposal.columns[k] ?? '')).length : 0), [up, columns]);

  if (meta.error) return <div className="card"><EmptyState icon={AlertTriangle} title="Couldn’t load report types">{meta.error}</EmptyState></div>;

  return (
    <section className="card" aria-label="Upload a report">
      <Stepper steps={STEPS} current={step} />

      {/* Step 1: file */}
      {step === 0 && (
        <div className="card-body stack gap-16">
          <div><h2 className="t-section">Upload a partner report</h2><p className="t-meta">{returnsOnly ? 'Upload a warehouse receipt scan export. Recon checks every return against it.' : 'Upload the orders file first. Then add settlement, COD remittance, freight and warehouse reports in any order. Re-uploading the same lines never double-counts.'}</p></div>
          <FileDrop onFile={pickFile} />
          {file && fileError && <FileRow file={file} error={fileError} onRemove={() => { setFile(null); setFileError(''); }} />}
        </div>
      )}

      {/* Step 2: detect type and partner */}
      {step === 1 && file && (
        <>
          <div className="card-body stack gap-24">
            <FileRow file={file} status={uploading ? 'uploading' : 'ready'} progress={progress} onRemove={reset} />
            <div>
              <div className="row between wrap" style={{ marginBottom: 10 }}>
                <h2 className="t-section">What kind of report is this?</h2>
                {guess?.type && <Badge tone="accent" icon={Sparkles}>Detected from {guess.from}: {SOURCE_LABEL[guess.type]}{guess.partner ? ` · ${guess.partner}` : ''}</Badge>}
              </div>
              <div className="choice-grid">
                {sources.map((s) => {
                  const M = SOURCE_META[s.key] ?? { icon: Box };
                  const disabled = returnsOnly && s.key !== 'warehouse';
                  return (
                    <button key={s.key} type="button" className="choice" aria-pressed={sourceType === s.key} disabled={disabled || uploading}
                      onClick={() => { setSourceType(s.key); const ps = meta.data.partners[s.key] ?? []; setPartner(ps.length === 1 ? ps[0] : guess?.type === s.key ? guess.partner : ''); }}>
                      <span className="choice-title"><M.icon aria-hidden="true" />{s.label}</span>
                      <span className="choice-sub">{disabled ? 'Not available for your role' : M.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ maxWidth: 360 }}>
              <Field label="Partner" hint={sourceType ? (partners.length ? 'Each partner keeps its own saved column mapping.' : 'Add a rate card for this partner type first.') : 'Choose a report type first.'}>
                <select className="select" value={partner} disabled={!sourceType || uploading} onChange={(e) => setPartner(e.target.value)}>
                  <option value="">Choose partner</option>
                  {partners.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
            </div>
            {error && <Alert tone="critical" title="Couldn’t read this file">{error}</Alert>}
          </div>
          <Footer>
            <Button icon={ArrowLeft} onClick={reset} disabled={uploading}>Choose another file</Button>
            <Button variant="primary" iconRight={ArrowRight} disabled={!sourceType || !partner} loading={uploading} onClick={send}>{uploading ? 'Uploading…' : 'Upload and detect columns'}</Button>
          </Footer>
        </>
      )}

      {/* Step 3: map columns */}
      {step === 2 && up && source && (
        <>
          <div className="card-body stack gap-12" style={{ paddingBottom: 12 }}>
            <div className="row between wrap gap-12">
              <div>
                <h2 className="t-section">Map columns in {up.fileName}</h2>
                <p className="t-meta">{SOURCE_LABEL[sourceType]} · {partner} · {up.headers.length} columns found</p>
              </div>
              {versions.data?.length > 0 && (
                <label className="row t-meta" style={{ gap: 8 }}>
                  <History aria-hidden="true" style={{ width: 14, height: 14 }} />Load a saved mapping
                  <select className="select sm" value="" onChange={(e) => { const v = versions.data.find((x) => String(x.version) === e.target.value); if (v) setColumns(Object.fromEntries(Object.entries(v.columns).filter(([, c]) => up.headers.includes(c)))); }}>
                    <option value="">Choose version</option>
                    {versions.data.map((v) => <option key={v._id} value={v.version}>v{v.version} · {v.approvedBy === 'seed' ? 'demo' : v.approvedBy} · {day(v.approvedAt)}</option>)}
                  </select>
                </label>
              )}
            </div>
            {up.formatChanged && <Alert tone="warning" title={`${partner} changed its file format`}>The saved mapping no longer fits these columns, so a new one is suggested. Approving it saves a new version; earlier versions stay available.</Alert>}
            {up.seenBefore && <Alert tone="info" title="This exact file was imported before">Last imported {day(up.seenBefore.at)}. Importing again is safe: lines already stored won’t be counted twice.</Alert>}
            <Alert tone="info">{BY_TEXT[up.proposal.by]?.(up.proposal.version)}</Alert>
          </div>
          <MappingTable fields={source.fields} headers={up.headers} rows={up.rows} columns={columns} proposal={up.proposal} onChange={setColumns} />
          <Footer>
            <Button icon={ArrowLeft} onClick={reset}>Cancel</Button>
            <div className="row wrap">
              {missing.length > 0 && <span className="t-meta neg">Map {missing.map((f) => f.label).join(', ')} to continue</span>}
              <Button variant="primary" iconRight={ArrowRight} disabled={missing.length > 0} onClick={() => setStep(3)}>Preview import</Button>
            </div>
          </Footer>
        </>
      )}

      {/* Step 4: preview */}
      {step === 3 && up && source && (
        <>
          <div className="card-body stack gap-12" style={{ paddingBottom: 12 }}>
            <div className="row between wrap">
              <div><h2 className="t-section">Preview the first {preview?.length ?? 0} rows</h2><p className="t-meta">Exactly as they’ll be stored: amounts in rupees, dates read day-first.</p></div>
              {preview && (badRows ? <Badge tone="warning">{badRows} of {preview.length} rows have problems</Badge> : <Badge tone="success">All preview rows read cleanly</Badge>)}
            </div>
            {previewError && <Alert tone="critical" title="Couldn’t build the preview">{previewError}</Alert>}
            {badRows > 0 && <Alert tone="warning">Rows with problems are skipped and listed by row number after import. If more than half the file can’t be read, nothing is imported.</Alert>}
          </div>
          <div className="table-wrap sticky" style={{ '--table-max': '440px', borderTop: '1px solid var(--line-2)' }}>
            <table className="table compact">
              <thead><tr><th className="num" style={{ width: 48 }}>#</th>{mapped.map((f) => <th key={f.key} className={f.type === 'money' ? 'num' : ''}>{f.label}</th>)}<th>Problems</th></tr></thead>
              <tbody>
                {preview?.map((p, i) => (
                  <tr key={i} style={p.errors.length ? { background: 'color-mix(in srgb, var(--warning-bg) 70%, transparent)' } : undefined}>
                    <td className="num faint">{i + 1}</td>
                    {mapped.map((f) => <td key={f.key} className={f.type === 'money' ? 'num' : f.key === 'orderId' || f.key === 'awb' || f.key === 'reference' ? 'mono' : ''}>{formatCell(p.doc[f.key], f.type)}</td>)}
                    <td className={p.errors.length ? 'neg' : 'faint'} style={{ fontSize: 12.5 }}>{p.errors.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Footer>
            <Button icon={ArrowLeft} onClick={() => setStep(2)}>Back to mapping</Button>
            <Button variant="primary" iconRight={ArrowRight} disabled={!preview} onClick={() => setStep(4)}>Continue</Button>
          </Footer>
        </>
      )}

      {/* Step 5: approve */}
      {step === 4 && up && source && (
        <>
          <div className="card-body stack gap-16">
            <div><h2 className="t-section">Approve mapping and import</h2><p className="t-meta">Check the summary. Every order is re-matched after the import.</p></div>
            <div className="stat-tiles">
              <div className="stat-tile"><div className="st-label">File</div><div className="strong mt-4 truncate">{up.fileName}</div><div className="t-meta">{SOURCE_LABEL[sourceType]} · {partner}</div></div>
              <div className="stat-tile"><div className="st-label">Fields mapped</div><div className="st-value">{mapped.length}<span className="t-meta"> / {source.fields.length}</span></div></div>
              <div className="stat-tile"><div className="st-label">Preview problems</div><div className="st-value" style={badRows ? { color: 'var(--warning)' } : undefined}>{badRows}<span className="t-meta"> rows</span></div></div>
              <div className="stat-tile"><div className="st-label">Mapping</div><div className="strong mt-4">{willSaveVersion ? `Saves as v${(lastVersion?.version ?? 0) + 1}` : `Reuses v${lastVersion.version}`}</div><div className="t-meta">{changedCount ? `${changedCount} changed by you` : up.proposal.by === 'ai' ? 'AI suggestion, unchanged' : 'As suggested'}</div></div>
            </div>
            <dl className="kv">
              {mapped.map((f) => <Fragment key={f.key}><dt>{f.label}</dt><dd><span className="mono">{columns[f.key]}</span></dd></Fragment>)}
            </dl>
            <div className="callout"><FileCheck2 aria-hidden="true" style={{ color: 'var(--muted)' }} /><div className="t-meta" style={{ color: 'var(--ink-2)' }}>Approving records you as the approver in the audit log. Unmapped columns are dropped and the raw file is deleted after import.</div></div>
            {error && <Alert tone="critical" title="Couldn’t start the import">{error}</Alert>}
          </div>
          <Footer>
            <Button icon={ArrowLeft} onClick={() => setStep(3)}>Back</Button>
            <Button variant="primary" icon={CheckCircle2} loading={busy} onClick={commit}>Approve mapping and import</Button>
          </Footer>
        </>
      )}

      {/* Step 6: import */}
      {step === 5 && job && (
        <div className="card-body">
          {job.status === 'failed' ? (
            <EmptyState icon={AlertTriangle} title="Couldn’t process this file" actions={<Button variant="primary" icon={RotateCcw} onClick={reset}>Upload again</Button>}>
              {job.error} Nothing from this file was imported. Fix the mapping or the file and upload it again.
            </EmptyState>
          ) : (
            <div className="stack gap-12" style={{ maxWidth: 520, margin: '24px auto', textAlign: 'center', alignItems: 'center' }}>
              <span className="spinner" style={{ width: 22, height: 22, color: 'var(--accent)' }} aria-hidden="true" />
              <h2 className="t-section">Importing {job.fileName}</h2>
              <p className="t-meta">Reading every row, skipping duplicates, then re-matching all orders and updating claims. Large files take a minute.</p>
              <div className="progress indeterminate" style={{ width: '100%' }}><i /></div>
            </div>
          )}
        </div>
      )}

      {/* Step 7: results */}
      {step === 6 && job?.status === 'done' && (
        <>
          <div className="card-body stack gap-24">
            <div className="row gap-16">
              <span className="success-mark"><CheckCircle2 aria-hidden="true" /></span>
              <div><h2 className="t-section">{job.fileName} imported</h2><p className="t-meta">Finished in {((job.importMs + job.matchMs) / 1000).toFixed(1)}s · all orders re-matched</p></div>
            </div>
            <div>
              <div className="t-label" style={{ marginBottom: 8 }}>File</div>
              <div className="stat-tiles">
                <div className="stat-tile"><div className="st-label">Rows read</div><div className="st-value">{num(job.stats.rows)}</div></div>
                <div className="stat-tile"><div className="st-label">New or updated</div><div className="st-value">{num(job.stats.stored)}</div></div>
                <div className="stat-tile"><div className="st-label">Duplicates skipped</div><div className="st-value">{num(job.stats.duplicates)}</div></div>
                <div className="stat-tile"><div className="st-label">Rejected</div><div className="st-value" style={job.stats.rejected ? { color: 'var(--warning)' } : undefined}>{num(job.stats.rejected)}</div></div>
              </div>
            </div>
            {job.match && (
              <div>
                <div className="t-label" style={{ marginBottom: 8 }}>Reconciliation</div>
                <div className="stat-tiles">
                  <div className="stat-tile"><div className="st-label">Orders checked</div><div className="st-value">{num(job.match.orders)}</div></div>
                  <div className="stat-tile"><div className="st-label">Due for payment</div><div className="st-value">{num(job.match.eligible)}</div></div>
                  <div className="stat-tile"><div className="st-label">Matched automatically</div><div className="st-value">{pct(job.match.autoMatchRate)}</div></div>
                  <div className="stat-tile"><div className="st-label">Lines to review</div><div className="st-value" style={job.match.review ? { color: 'var(--info)' } : undefined}>{num(job.match.review)}</div></div>
                </div>
              </div>
            )}
            {job.stats.errors?.length > 0 && (
              <Alert tone="warning" title={`${job.stats.rejected} rows were skipped`}>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{job.stats.errors.slice(0, 6).map((e) => <li key={e.row}>Row {e.row}: {e.errors.join(', ')}</li>)}</ul>
                {job.stats.errors.length > 6 && <div className="t-meta mt-4">and {job.stats.errors.length - 6} more</div>}
              </Alert>
            )}
          </div>
          <Footer>
            <Button icon={RotateCcw} onClick={reset}>Upload another file</Button>
            <div className="row wrap">
              {job.match?.review > 0 && user.role !== 'returns' && <Button href="/review" icon={Inbox}>Review {num(job.match.review)} lines</Button>}
              <Button variant="primary" iconRight={ArrowRight} href={user.role === 'returns' ? '/returns' : '/reconciliation'}>{user.role === 'returns' ? 'View returns' : 'View reconciliation results'}</Button>
            </div>
          </Footer>
        </>
      )}
    </section>
  );
}
