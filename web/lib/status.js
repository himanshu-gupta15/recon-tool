// Display metadata for statuses the engine produces. Tones are semantic:
// success, warning, critical, info, neutral. Red is kept for money that is
// actually lost or overdue, not for every exception.
export const STATUS = {
  settled: { label: 'Matched', tone: 'success', color: 'var(--c-settled)', reason: 'The amount received is within ₹10 of the expected payout.' },
  short_paid: { label: 'Short paid', tone: 'warning', color: 'var(--c-short)', reason: 'The partner paid less than the expected payout by more than ₹10.' },
  unpaid_past_due: { label: 'Unpaid', tone: 'critical', color: 'var(--c-unpaid)', reason: 'No payment was found and the settlement window has passed.' },
  overpaid: { label: 'Overpaid', tone: 'info', color: 'var(--c-over)', reason: 'More was received than expected, or money arrived for a cancelled order. Check before relying on this credit.' },
  freight_overcharged: { label: 'Freight overcharge', tone: 'warning', color: 'var(--c-freight)', reason: 'The courier billed more freight than the rate card allows for the declared weight and zone.' },
  return_not_received: { label: 'Return missing', tone: 'critical', color: 'var(--c-return)', reason: 'The order was returned but no warehouse scan arrived within the grace period.' },
  missing_rate_card: { label: 'No rate card', tone: 'neutral', color: 'var(--c-norate)', reason: 'No channel rate card was in force on the order date, so the expected payout can’t be calculated.' },
  pending: { label: 'Not yet due', tone: 'neutral', color: 'var(--c-pending)', reason: 'The order is in transit or still inside its settlement window.' },
  cancelled: { label: 'Cancelled', tone: 'neutral', color: 'var(--c-cancel)', reason: 'The order was cancelled and no money was expected.' },
};

export const statusLabel = (s) => STATUS[s]?.label ?? s;

// Claims as the backend stores them. There is no separate "under review" state;
// a filed claim is awaiting the partner's decision.
export const CLAIM_STATUS = {
  open: { label: 'To file', tone: 'warning', hint: 'Raised by reconciliation. Not yet sent to the partner.' },
  filed: { label: 'Filed', tone: 'info', hint: 'Sent to the partner and awaiting their decision.' },
  recovered: { label: 'Recovered', tone: 'success', hint: 'The partner paid back the money.' },
  rejected: { label: 'Rejected', tone: 'critical', hint: 'The partner declined the claim.' },
  written_off: { label: 'Written off', tone: 'neutral', hint: 'Closed by the co-founder without recovery.' },
  resolved: { label: 'Auto-resolved', tone: 'success', hint: 'New partner files closed the gap.' },
};

export const ISSUE_TYPES = ['short_paid', 'unpaid_past_due', 'freight_overcharged', 'return_not_received'];

// Allowed transitions mirror PATCH /claims/:id in the API.
export const CLAIM_NEXT = {
  open: [['filed', 'Mark as filed'], ['written_off', 'Write off']],
  filed: [['recovered', 'Record recovery'], ['rejected', 'Mark rejected'], ['written_off', 'Write off']],
  rejected: [['written_off', 'Write off']],
};

export const SOURCE_LABEL = { orders: 'Orders', settlement: 'Settlement', cod: 'COD remittance', freight: 'Freight invoice', warehouse: 'Warehouse scans' };

export const claimRef = (c) => `CLM-${String(c._id).slice(-6).toUpperCase()}`;

// Order of segments in charts, from good to bad.
export const HEALTH_ORDER = ['settled', 'overpaid', 'short_paid', 'freight_overcharged', 'unpaid_past_due', 'return_not_received', 'missing_rate_card'];
