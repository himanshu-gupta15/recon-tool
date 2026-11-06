'use client';
import { useCallback } from 'react';
import { FileUp } from 'lucide-react';
import { useApi } from '@/lib/api';
import { SOURCE_LABEL } from '@/lib/status';
import { day, num, relative } from '@/lib/format';
import { useApp } from '@/components/shell/AppContext';
import { actorName } from '@/lib/activity';
import { PageHeader, Card, Badge, EmptyState } from '@/components/ui';
import DataTable from '@/components/Table';
import UploadWizard from '@/components/upload/UploadWizard';

const STATE = { imported: ['success', 'Imported'], importing: ['info', 'Importing'], failed: ['critical', 'Failed'] };

export default function Uploads() {
  const { user } = useApp();
  const history = useApi('/uploads');
  const reload = history.reload;
  const onImported = useCallback(() => reload(), [reload]);
  const columns = [
    { key: 'file', header: 'File', mobile: 'primary', render: (u) => <><div className="cell-main truncate" style={{ maxWidth: 280 }}>{u.fileName}</div><div className="cell-sub">{SOURCE_LABEL[u.sourceType]} · {u.partner}</div>{u.status === 'failed' && u.error && <div className="cell-sub neg" style={{ maxWidth: 420, whiteSpace: 'normal' }}>{u.error}</div>}</> },
    { key: 'rows', header: 'Rows', align: 'num', render: (u) => num(u.stats?.rows) },
    { key: 'dupes', header: 'Duplicates', align: 'num', render: (u) => <span className={u.stats?.duplicates ? '' : 'faint'}>{num(u.stats?.duplicates)}</span> },
    { key: 'rejected', header: 'Rejected', align: 'num', render: (u) => <span className={u.stats?.rejected ? 'neg' : 'faint'}>{num(u.stats?.rejected)}</span> },
    { key: 'by', header: 'By', render: (u) => <span className="muted">{actorName(u.by, user)}</span> },
    { key: 'date', header: 'Date', render: (u) => <span title={day(u.importedAt ?? u.createdAt)}>{relative(u.importedAt ?? u.createdAt)}</span> },
    { key: 'status', header: 'Status', mobile: 'status', render: (u) => { const [t, l] = STATE[u.status] ?? ['neutral', u.status]; return <span title={u.error}><Badge tone={t}>{l}</Badge></span>; } },
  ];
  return (
    <>
      <PageHeader title="Uploads" sub="Import partner reports. Recon detects columns, you approve the mapping, and every order is re-matched." />
      <UploadWizard onImported={onImported} />
      <div className="section">
        <Card flush title="Recent imports" sub="The last 25 files">
          <DataTable
            columns={columns} rows={history.data} loading={history.loading} error={history.error} onRetry={history.reload}
            empty={<EmptyState icon={FileUp} title="No reconciliation files yet">Upload your first settlement report to start reconciling payments.</EmptyState>}
          />
        </Card>
      </div>
    </>
  );
}
