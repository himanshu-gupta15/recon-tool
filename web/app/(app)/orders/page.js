import { redirect } from 'next/navigation';
// The orders list now lives under Reconciliation.
export default function Page() { redirect('/reconciliation'); }
