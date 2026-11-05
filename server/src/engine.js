// The reconciliation rules. Pure functions with no database and no AI, so every
// status can be reproduced and explained. Amounts are integer paise.
export const GAP_THRESHOLD = 1000; // the brief flags gaps over ₹10
export const DAY = 86400000;

export const pctOf = (paise, bp) => Math.round((paise * bp) / 10000);
const rupee = (paise) => Math.round(paise / 100) * 100;
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const key = (s) => String(s ?? '').trim().toLowerCase();

// Picks the version in force on the order date, so a later rate change never
// re-prices old orders.
export function cardFor(cards, kind, partner, date) {
  const list = cards.filter((c) => c.kind === kind && key(c.partner) === key(partner) && c.effectiveFrom <= date);
  return list.sort((a, b) => b.effectiveFrom - a.effectiveFrom)[0] ?? null;
}

export function expectedPayment(order, card) {
  const prepaid = order.mode === 'Prepaid';
  const rate = prepaid ? card.prepaidBp : card.codBp;
  let amount;
  let calc;
  if (order.delivery === 'returned') {
    if (prepaid) {
      amount = -pctOf(order.value, card.prepaidReturnBp);
      calc = `Prepaid return: ${card.prepaidReturnBp / 100}% charge on order value`;
    } else {
      amount = 0;
      calc = 'COD return: no cash collected, so nothing is due';
    }
  } else {
    amount = order.value - pctOf(order.value, rate) - (card.fixedPaise ?? 0);
    calc = `${order.mode}: order value less ${rate / 100}%${card.fixedPaise ? ' and fixed fee' : ''}`;
  }
  return { amount: card.roundToRupee ? rupee(amount) : amount, calc: `${calc} (${card.partner} rate card)` };
}

export function expectedFreight(order, card) {
  if (!card || !order.weight || !order.zone) return null;
  const zone = card.zones?.[String(order.zone).trim().toUpperCase()];
  if (!zone) return null;
  const slabs = Math.max(1, Math.ceil(order.weight / 500));
  let amount = zone.base + (slabs - 1) * zone.add;
  if (order.delivery === 'returned') amount += card.rtoPaise ?? 0;
  return amount;
}

const sum = (rows, f) => rows.reduce((t, r) => t + (r[f] ?? 0), 0);
const latest = (rows) => rows.reduce((d, r) => (r.date && (!d || r.date > d) ? r.date : d), null);

const PRIORITY = ['return_not_received', 'unpaid_past_due', 'short_paid', 'freight_overcharged', 'overpaid', 'missing_rate_card', 'pending', 'cancelled', 'settled'];

export function reconcileOrder(order, lines, cards, asOf) {
  const payments = lines.filter((l) => l.sourceType === 'settlement' || l.sourceType === 'cod');
  const freight = lines.filter((l) => l.sourceType === 'freight');
  const scans = lines.filter((l) => l.sourceType === 'warehouse');
  const net = sum(payments, 'amount');
  const tcs = sum(payments, 'tcs');
  const tds = sum(payments, 'tds');
  // TCS and TDS are tax credits, not leakage, so they count as received.
  const received = net + tcs + tds;
  const result = { expected: null, calc: null, net, tcs, tds, received, gap: null, freightExpected: null, freightCharged: sum(freight, 'amount'), returnStatus: null, returnDueBy: null, scanDate: scans[0]?.date ?? null, scanCondition: scans[0]?.condition ?? null, issues: [], flags: [] };
  const states = [];

  const channelCard = cardFor(cards, 'channel', order.channel, order.orderDate);
  const courierCard = order.courier ? cardFor(cards, 'courier', order.courier, order.orderDate) : null;
  const viaCourier = order.mode === 'COD' && channelCard?.codVia === 'courier';
  const payPartner = viaCourier ? (order.courier || 'Unknown courier') : order.channel;

  if (order.delivery === 'cancelled') {
    states.push(payments.length ? 'overpaid' : 'cancelled');
    if (payments.length) result.flags.push('Money received against a cancelled order');
  } else if (order.delivery === 'in_transit') {
    states.push('pending');
  } else if (!channelCard) {
    states.push('missing_rate_card');
    result.flags.push(`No rate card for ${order.channel} on the order date`);
  } else {
    const exp = expectedPayment(order, channelCard);
    result.expected = exp.amount;
    result.calc = exp.calc;
    if (!payments.length) {
      const base = order.deliveredDate ?? order.orderDate;
      const days = viaCourier ? (courierCard?.remittanceDays ?? channelCard.settlementDays) : channelCard.settlementDays;
      const due = addDays(base, days);
      result.dueDate = due;
      if (exp.amount <= 0) states.push(exp.amount === 0 ? 'settled' : 'pending');
      else if (asOf > due) {
        states.push('unpaid_past_due');
        result.gap = -exp.amount;
        result.issues.push({ type: 'unpaid_past_due', partner: payPartner, amount: exp.amount, ageFrom: due, detail: `No payment found; due by ${due.toISOString().slice(0, 10)}` });
      } else states.push('pending');
    } else {
      const gap = received - exp.amount;
      result.gap = gap;
      if (gap < -GAP_THRESHOLD) {
        states.push('short_paid');
        result.issues.push({ type: 'short_paid', partner: payPartner, amount: -gap, ageFrom: latest(payments) ?? order.orderDate, detail: `Expected ${exp.amount / 100}, received ${received / 100} including tax deductions` });
      } else if (gap > GAP_THRESHOLD) {
        states.push('overpaid');
        result.flags.push('Paid more than expected. Check before relying on this credit.');
      } else states.push('settled');
    }
  }

  if (order.delivery === 'returned') {
    const base = order.returnedDate ?? order.deliveredDate ?? order.orderDate;
    const dueBy = addDays(base, courierCard?.returnGraceDays ?? 7);
    result.returnDueBy = dueBy;
    if (scans.length) result.returnStatus = 'received';
    else if (asOf > dueBy) {
      result.returnStatus = 'not_received';
      states.push('return_not_received');
      result.issues.push({ type: 'return_not_received', partner: order.courier || 'Unknown courier', amount: order.value, ageFrom: dueBy, detail: `No warehouse scan by ${dueBy.toISOString().slice(0, 10)}. Amount is the order value, as product cost is not available.` });
    } else result.returnStatus = 'awaiting';
  }

  if (freight.length) {
    const fx = expectedFreight(order, courierCard);
    result.freightExpected = fx;
    if (fx === null) {
      result.flags.push('Freight not checked: needs a courier rate card, declared weight and zone');
    } else if (result.freightCharged - fx > GAP_THRESHOLD) {
      states.push('freight_overcharged');
      const billed = freight.find((l) => l.chargedWeight)?.chargedWeight;
      result.issues.push({ type: 'freight_overcharged', partner: order.courier, amount: result.freightCharged - fx, ageFrom: latest(freight) ?? order.orderDate, detail: `Declared ${order.weight / 1000} kg${billed ? `, billed ${billed / 1000} kg` : ''}; ${freight.length} freight line(s)` });
    }
  }

  result.status = PRIORITY.find((p) => states.includes(p)) ?? 'pending';
  return result;
}
