'use client';
import { Fragment } from 'react';
import { Receipt, Upload } from 'lucide-react';
import { useApi } from '@/lib/api';
import { num } from '@/lib/format';
import { PageHeader, Card, Money, EmptyState, ErrorState, SkeletonRows, Button } from '@/components/ui';

const monthLabel = (m) => new Date(m + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function Tax() {
  const q = useApi('/tax');
  const rows = q.data ?? [];
  const months = [...new Set(rows.map((r) => r.month))];
  const sum = (list, k) => list.reduce((t, r) => t + r[k], 0);
  return (
    <>
      <PageHeader title="TCS & TDS" sub="Deducted by partners from settlements. These are tax credits to check against your books, not leakage." actions={<Button href="/reports">All reports</Button>} />
      <Card flush>
        {q.error && !q.data ? <ErrorState message={q.error} onRetry={q.reload} /> : !q.data ? <SkeletonRows /> : !rows.length ? (
          <EmptyState icon={Receipt} title="No settlement deductions yet" actions={<Button href="/uploads" icon={Upload} variant="primary">Upload settlement file</Button>}>Upload channel settlement files that include TCS and TDS columns to see deductions here.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table responsive">
              <thead><tr><th>Partner</th><th className="num">Lines</th><th className="num">Net paid</th><th className="num">GST TCS</th><th className="num">Income tax TDS</th></tr></thead>
              <tbody>
                {months.map((m) => {
                  const list = rows.filter((r) => r.month === m);
                  return (
                    <Fragment key={m}>
                      <tr><td colSpan={5} className="m-primary" style={{ background: 'var(--surface-2)', height: 34, fontWeight: 600, fontSize: 12.5 }}>{monthLabel(m)}</td></tr>
                      {list.map((r) => (
                        <tr key={m + r.partner}>
                          <td className="m-primary">{r.partner}</td>
                          <td className="num" data-label="Lines">{num(r.lines)}</td>
                          <td className="num" data-label="Net paid"><Money value={r.net} /></td>
                          <td className="num" data-label="GST TCS"><Money value={r.tcs} /></td>
                          <td className="num" data-label="Income tax TDS"><Money value={r.tds} /></td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot><tr><td>Total</td><td className="num">{num(sum(rows, 'lines'))}</td><td className="num"><Money value={sum(rows, 'net')} /></td><td className="num"><Money value={sum(rows, 'tcs')} /></td><td className="num"><Money value={sum(rows, 'tds')} /></td></tr></tfoot>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
