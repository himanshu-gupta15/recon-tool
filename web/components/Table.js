'use client';
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { SkeletonRows, ErrorState } from './ui';

// columns: [{ key, header, align: 'num', sortable, render(row), mobile: 'primary'|'status'|'hide'|'actions', width }]
// On phones the table turns into stacked cards using each cell's data-label.
export default function DataTable({ columns, rows, rowKey = (r) => r._id, onRowClick, sort, onSort, loading, error, onRetry, empty, sticky, maxHeight, compact, foot, chevron }) {
  const initial = loading && !rows;
  if (error && !rows) return <ErrorState message={error} onRetry={onRetry} compact />;
  return (
    <div className={`table-wrap ${sticky ? 'sticky' : ''}`} style={maxHeight ? { '--table-max': `${maxHeight}px` } : undefined} aria-busy={loading || undefined}>
      {loading && rows && <div className="loading-bar" aria-hidden="true" />}
      {initial ? <SkeletonRows cols={Math.min(columns.length, 7)} /> : (
        <table className={`table responsive ${compact ? 'compact' : ''}`}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.align === 'num' ? 'num' : ''} style={c.width ? { width: c.width } : undefined} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sortable && onSort ? (
                    <button type="button" className="sort" aria-sort={sort?.key === c.key ? sort.dir : undefined} onClick={() => onSort({ key: c.key, dir: sort?.key === c.key && sort.dir === 'desc' ? 'asc' : 'desc' })}>
                      {c.header}
                      {sort?.key === c.key ? (sort.dir === 'asc' ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />) : <ChevronsUpDown aria-hidden="true" />}
                    </button>
                  ) : c.header}
                </th>
              ))}
              {chevron && <th aria-label="Open" />}
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr
                key={rowKey(r)}
                className={onRowClick ? 'clickable' : ''}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? (e) => { if (!e.target.closest('button, a, input, select')) onRowClick(r); } : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(r); } : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} data-label={c.mobile === 'primary' || c.mobile === 'status' || c.mobile === 'actions' ? undefined : (typeof c.header === 'string' ? c.header : undefined)} className={[c.align === 'num' ? 'num' : '', c.mobile ? `m-${c.mobile}` : '', c.className ?? ''].join(' ')}>
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
                {chevron && <td className="chev"><ChevronRight aria-hidden="true" /></td>}
              </tr>
            ))}
          </tbody>
          {foot}
        </table>
      )}
      {!initial && rows && !rows.length && empty}
    </div>
  );
}
