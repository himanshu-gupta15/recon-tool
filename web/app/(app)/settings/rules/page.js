import { Card, Badge } from '@/components/ui';

// Describes server/src/engine.js. Keep in sync if the rules change.
const RULES = [
  ['Expected payout', 'Order value less the channel’s fee from the rate card in force on the order date. Prepaid returns are charged a percentage of order value; COD returns expect nothing.'],
  ['Amount received', 'Net paid plus GST TCS plus income tax TDS. Tax deducted at source is a credit, so it isn’t treated as leakage.'],
  ['Tolerance', 'A gap over ₹10 is flagged. A gap of exactly ₹10 or less counts as matched.'],
  ['Short paid', 'Received is more than ₹10 below expected. Raises a claim against the partner that paid.'],
  ['Unpaid', 'No payment found after the settlement window (channel days, or courier remittance days for COD shipped via courier).'],
  ['Overpaid', 'Received is more than ₹10 above expected, or money arrived for a cancelled order. Flagged for checking; no claim.'],
  ['Freight overcharge', 'Billed freight exceeds the courier’s slab rate for declared weight and zone by more than ₹10. Needs a courier rate card, weight and zone.'],
  ['Return missing', 'A returned order has no warehouse scan after the courier’s grace period. Claimed at order value because product cost isn’t in the files.'],
  ['No rate card', 'No channel rate card covers the order date. The order is left unchecked and no claim is raised.'],
  ['Duplicates', 'The same statement line uploaded twice counts once. A second payment with a different reference still adds up.'],
  ['Missing order ID', 'Lines that can’t be tied to an order go to the review queue with rule-scored suggestions. Nothing is linked without a person.'],
  ['Claims lifecycle', 'Claims update as new files arrive: a closed gap is auto-resolved, and a gap that comes back reopens the claim. Write-offs need the co-founder and a reason.'],
];

export default function Rules() {
  return (
    <Card flush title="Reconciliation rules" sub="Fixed rules, not AI, so every status can be reproduced and explained." actions={<Badge tone="neutral" plain>Read-only</Badge>}>
      {RULES.map(([t, d]) => <div key={t} className="setting-row"><div className="sr-title">{t}</div><div className="t-body" style={{ color: 'var(--ink-2)' }}>{d}</div></div>)}
    </Card>
  );
}
