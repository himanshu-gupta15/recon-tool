import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileOrder, expectedFreight } from '../src/engine.js';
import { parseMoney, parseDate, parseWeightGrams, csvCell, maskPhone } from '../src/parse.js';
import { suggestByRules, maskSample } from '../src/mapping.js';

const d = (s) => new Date(s + 'T00:00:00Z');
const asOf = d('2026-11-05');
const cards = [
  { kind: 'channel', partner: 'Website', effectiveFrom: d('2020-01-01'), codVia: 'courier', codBp: 600, prepaidBp: 200, prepaidReturnBp: 400, settlementDays: 3, roundToRupee: true },
  { kind: 'channel', partner: 'Marketplace 1', effectiveFrom: d('2020-01-01'), codBp: 2500, prepaidBp: 2500, prepaidReturnBp: 500, settlementDays: 7, roundToRupee: true },
  { kind: 'channel', partner: 'Marketplace 2', effectiveFrom: d('2020-01-01'), codBp: 2000, prepaidBp: 2000, prepaidReturnBp: 500, settlementDays: 7, roundToRupee: true },
  { kind: 'channel', partner: 'Marketplace 2', effectiveFrom: d('2026-10-01'), codBp: 2200, prepaidBp: 2200, prepaidReturnBp: 500, settlementDays: 7, roundToRupee: true },
  { kind: 'courier', partner: 'Courier A', effectiveFrom: d('2020-01-01'), remittanceDays: 7, returnGraceDays: 7, rtoPaise: 5000, zones: { A: { base: 4000, add: 3500 } } },
];
const order = (o) => ({ orderId: 'X', channel: 'Website', mode: 'COD', delivery: 'delivered', orderDate: d('2026-09-01'), deliveredDate: d('2026-09-05'), courier: 'Courier A', ...o });
const pay = (amount, o = {}) => ({ sourceType: 'settlement', amount, date: d('2026-09-20'), ...o });

test('brief sample 1: delivered COD with nothing received is unpaid past due, -1409', () => {
  const r = reconcileOrder(order({ value: 149900 }), [], cards, asOf);
  assert.equal(r.expected, 140900);
  assert.equal(r.gap, -140900);
  assert.equal(r.status, 'unpaid_past_due');
  assert.equal(r.issues[0].partner, 'Courier A');
});

test('brief sample 2: marketplace prepaid 899 expected, 862 received, -37', () => {
  const r = reconcileOrder(order({ channel: 'Marketplace 1', mode: 'Prepaid', value: 119900 }), [pay(86200)], cards, asOf);
  assert.equal(r.expected, 89900);
  assert.equal(r.gap, -3700);
  assert.equal(r.status, 'short_paid');
  assert.equal(r.issues[0].partner, 'Marketplace 1');
});

test('brief sample 3: returned prepaid -96 expected, -142 received, -46', () => {
  const r = reconcileOrder(order({ mode: 'Prepaid', delivery: 'returned', value: 239800, returnedDate: d('2026-09-10') }), [pay(-14200), { sourceType: 'warehouse', date: d('2026-09-12') }], cards, asOf);
  assert.equal(r.expected, -9600);
  assert.equal(r.gap, -4600);
  assert.equal(r.status, 'short_paid');
  assert.equal(r.returnStatus, 'received');
});

test('TCS and TDS are separate and are not leakage', () => {
  const r = reconcileOrder(order({ channel: 'Marketplace 1', mode: 'Prepaid', value: 119900 }), [pay(89180, { tcs: 600, tds: 120 })], cards, asOf);
  assert.equal(r.status, 'settled');
  assert.equal(r.tcs, 600);
  assert.equal(r.tds, 120);
  assert.equal(r.issues.length, 0);
});

test('a gap of exactly ₹10 is not flagged, and ₹10.01 is', () => {
  const o = order({ channel: 'Marketplace 1', mode: 'Prepaid', value: 119900 });
  assert.equal(reconcileOrder(o, [pay(88900)], cards, asOf).status, 'settled');
  assert.equal(reconcileOrder(o, [pay(88899)], cards, asOf).status, 'short_paid');
});

test('COD inside its remittance window is pending, not a leak', () => {
  const r = reconcileOrder(order({ value: 149900, deliveredDate: d('2026-11-01') }), [], cards, asOf);
  assert.equal(r.status, 'pending');
  assert.equal(r.issues.length, 0);
});

test('payment split across two settlements adds up', () => {
  const o = order({ channel: 'Marketplace 1', mode: 'Prepaid', value: 119900 });
  assert.equal(reconcileOrder(o, [pay(50000), pay(39900)], cards, asOf).status, 'settled');
});

test('return with no scan: awaiting inside the grace period, then not received', () => {
  const o = order({ delivery: 'returned', value: 100000, returnedDate: d('2026-11-01') });
  assert.equal(reconcileOrder(o, [], cards, asOf).returnStatus, 'awaiting');
  const late = reconcileOrder({ ...o, returnedDate: d('2026-10-01') }, [], cards, asOf);
  assert.equal(late.status, 'return_not_received');
  assert.equal(late.issues[0].amount, 100000);
});

test('freight uses weight slabs and flags an overcharge', () => {
  const o = order({ value: 149900, weight: 900, zone: 'a' });
  assert.equal(expectedFreight(o, cards[4]), 7500);
  const r = reconcileOrder(o, [{ sourceType: 'freight', amount: 11000, chargedWeight: 1400, date: d('2026-09-30') }, pay(140900)], cards, asOf);
  assert.equal(r.status, 'freight_overcharged');
  assert.equal(r.issues[0].amount, 3500);
});

test('freight with no declared weight is not flagged as overcharged', () => {
  const r = reconcileOrder(order({ value: 149900 }), [{ sourceType: 'freight', amount: 99900 }, pay(140900)], cards, asOf);
  assert.equal(r.issues.length, 0);
  assert.ok(r.flags[0].includes('not checked'));
});

test('one order can carry several issues', () => {
  const o = order({ value: 149900, weight: 400, zone: 'A' });
  const r = reconcileOrder(o, [{ sourceType: 'freight', amount: 9000, date: d('2026-09-30') }], cards, asOf);
  assert.deepEqual(r.issues.map((i) => i.type).sort(), ['freight_overcharged', 'unpaid_past_due']);
});

test('the rate card in force on the order date is used', () => {
  const base = { channel: 'Marketplace 2', mode: 'Prepaid', value: 100000 };
  assert.equal(reconcileOrder(order({ ...base, orderDate: d('2026-09-01') }), [pay(80000)], cards, asOf).expected, 80000);
  assert.equal(reconcileOrder(order({ ...base, orderDate: d('2026-10-15'), deliveredDate: d('2026-10-20') }), [pay(78000)], cards, asOf).expected, 78000);
});

test('no rate card gives a visible status, never a false claim', () => {
  const r = reconcileOrder(order({ channel: 'New App', value: 100000 }), [], cards, asOf);
  assert.equal(r.status, 'missing_rate_card');
  assert.equal(r.issues.length, 0);
});

test('money parsing handles partner formats without float errors', () => {
  assert.equal(parseMoney('₹1,00,000.50'), 10000050);
  assert.equal(parseMoney('(37.00)'), -3700);
  assert.equal(parseMoney('142.00 Dr'), -14200);
  assert.equal(parseMoney('-142'), -14200);
  assert.equal(parseMoney('1.1'), 110);
  assert.equal(parseMoney('19.99'), 1999);
  assert.equal(parseMoney('Rs. 899'), 89900);
  assert.equal(parseMoney(''), null);
  assert.throws(() => parseMoney('abc'));
});

test('dates are day first, with Excel serials and impossible dates handled', () => {
  assert.equal(parseDate('03/04/2026').toISOString().slice(0, 10), '2026-04-03');
  assert.equal(parseDate('10/25/2026').toISOString().slice(0, 10), '2026-10-25');
  assert.equal(parseDate('2026-11-05').toISOString().slice(0, 10), '2026-11-05');
  assert.equal(parseDate('5 Nov 2026').toISOString().slice(0, 10), '2026-11-05');
  assert.equal(parseDate(46000).toISOString().slice(0, 10), '2025-12-09');
  assert.throws(() => parseDate('31/02/2026'));
});

test('weights, masks and export safety', () => {
  assert.equal(parseWeightGrams('0.5'), 500);
  assert.equal(parseWeightGrams('450 g'), 450);
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(maskPhone('+91 98765 43210'), '••••••3210');
  assert.equal(maskSample('Asha 98765'), 'xxxx 99999');
});

test('rules map unfamiliar headers and leave unknown ones alone', () => {
  const m = suggestByRules('cod', ['AWB Number', 'Remitted', 'CRF ID', 'Remitted On', 'Customer Address']);
  assert.equal(m.columns.awb, 'AWB Number');
  assert.equal(m.columns.amount, 'Remitted');
  assert.equal(m.columns.date, 'Remitted On');
  assert.ok(!Object.values(m.columns).includes('Customer Address'));
});
