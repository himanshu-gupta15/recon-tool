'use client';
import { useRef, useState } from 'react';
import { FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import { fileSize } from '@/lib/format';
import { Badge } from '@/components/ui';

export function FileRow({ file, progress, status, onRemove, error }) {
  const done = status === 'uploaded';
  return (
    <div className="file-row">
      <span className="file-icon" style={error ? { background: 'var(--critical-bg)', color: 'var(--critical)' } : undefined}><FileSpreadsheet aria-hidden="true" /></span>
      <div style={{ minWidth: 0 }}>
        <div className="row gap-12" style={{ flexWrap: 'nowrap' }}>
          <span className="strong truncate">{file.name}</span>
          {error ? <Badge tone="critical">Invalid</Badge> : done ? <Badge tone="success">Uploaded</Badge> : status === 'uploading' ? <Badge tone="info">Uploading {Math.round((progress ?? 0) * 100)}%</Badge> : <Badge tone="neutral">Ready</Badge>}
        </div>
        <div className="t-meta">{fileSize(file.size)} · {file.name.split('.').pop().toUpperCase()}{error ? <span className="neg"> · {error}</span> : null}</div>
        {status === 'uploading' && <div className="progress"><i style={{ width: `${Math.max(4, (progress ?? 0) * 100)}%` }} /></div>}
      </div>
      {onRemove && status !== 'uploading' && <button type="button" className="icon-btn" aria-label="Remove file" onClick={onRemove}><X aria-hidden="true" /></button>}
    </div>
  );
}

export default function FileDrop({ onFile, hint }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`} role="button" tabIndex={0}
      aria-label="Upload a file: drop it here or press Enter to browse"
      onClick={() => input.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
    >
      <span className="dz-icon"><UploadCloud aria-hidden="true" /></span>
      <div className="strong">Drop a partner report here, or <span style={{ color: 'var(--accent)' }}>browse</span></div>
      <div className="t-meta">{hint ?? 'CSV or XLSX (first sheet), up to 60 MB'}</div>
      <input ref={input} type="file" accept=".csv,.xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </div>
  );
}
