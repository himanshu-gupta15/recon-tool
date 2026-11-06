// Mirrors the role checks in server/src/routes.js. The UI hides what a role
// can't do; the API still enforces it.
export const ROLE_LABEL = { finance: 'Finance Executive', cofounder: 'Finance Co-founder', returns: 'Returns Manager' };

export const FINANCE = ['finance', 'cofounder'];
export const ALL = ['finance', 'cofounder', 'returns'];

export const can = (user, what) => {
  const role = user?.role;
  switch (what) {
    case 'orders': case 'review': case 'rates': case 'tax': case 'audit': case 'team': case 'reports': return FINANCE.includes(role);
    case 'writeOff': case 'customerDetails': return role === 'cofounder';
    case 'uploadAny': return FINANCE.includes(role);
    default: return ALL.includes(role);
  }
};

export const PERMISSIONS = [
  ['View overview', ALL],
  ['View orders and reconciliation', FINANCE],
  ['Upload partner reports', FINANCE],
  ['Upload warehouse scans', ALL],
  ['Approve column mappings', ALL],
  ['Resolve the review queue', FINANCE],
  ['View and update all claims', FINANCE],
  ['View and update return claims', ALL],
  ['Export claim evidence', ALL],
  ['Write off a claim', ['cofounder']],
  ['See customer name and phone', ['cofounder']],
  ['Edit rate cards', FINANCE],
  ['View reports and TCS/TDS', FINANCE],
  ['View audit log', FINANCE],
];
