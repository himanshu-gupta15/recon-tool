import { parseDate, parseMoney, parseWeightGrams, normalizeMode } from './parse.js';

const f = (key, label, type, required = false, synonyms = [], personal = false) => ({ key, label, type, required, synonyms, personal });

const ID = ['order id', 'order no', 'order number', 'order item id', 'orderid', 'reference order', 'order reference', 'order ref', 'channel order id', 'sub order', 'suborder id'];
const AWB = ['awb', 'awb no', 'awb number', 'tracking', 'tracking id', 'tracking number', 'waybill', 'shipment id'];

// Only mapped fields are ever stored. Any other column in a partner file is
// dropped at import, which is the main DPDP control for customer addresses.
export const SOURCES = {
  orders: {
    label: 'Orders',
    fields: [
      f('orderId', 'Order ID', 'string', true, ID),
      f('channel', 'Channel', 'string', true, ['channel', 'sales channel', 'marketplace', 'source']),
      f('value', 'Order value', 'money', true, ['value', 'order value', 'order total', 'amount', 'invoice value', 'selling price', 'total']),
      f('mode', 'Payment type', 'mode', true, ['payment', 'payment mode', 'payment type', 'payment method', 'cod prepaid']),
      f('deliveryStatus', 'Delivery status', 'string', true, ['delivery status', 'status', 'shipment status', 'order status']),
      f('orderDate', 'Order date', 'date', true, ['order date', 'date', 'created at', 'placed on']),
      f('deliveredDate', 'Delivered date', 'date', false, ['delivered date', 'delivery date', 'delivered on', 'delivered at']),
      f('returnedDate', 'Returned date', 'date', false, ['returned date', 'return date', 'rto date', 'returned on']),
      f('courier', 'Courier', 'string', false, ['courier', 'courier partner', 'carrier', 'aggregator', 'logistics partner']),
      f('awb', 'AWB', 'string', false, AWB),
      f('weight', 'Declared weight', 'weight', false, ['weight', 'declared weight', 'weight kg', 'dead weight', 'shipping weight']),
      f('zone', 'Zone', 'string', false, ['zone', 'shipping zone', 'delivery zone']),
      f('customerName', 'Customer name', 'string', false, ['customer', 'customer name', 'buyer name', 'name'], true),
      f('customerPhone', 'Customer phone', 'string', false, ['phone', 'mobile', 'customer phone', 'contact number'], true),
    ],
  },
  settlement: {
    label: 'Settlement',
    fields: [
      f('orderId', 'Order ID', 'string', false, ID),
      f('amount', 'Net amount paid', 'money', true, ['net', 'net payable', 'net amount', 'net settlement', 'amount paid', 'settled amount', 'settlement amount', 'payout', 'received', 'amount']),
      f('tcs', 'GST TCS deducted', 'money', false, ['tcs', 'gst tcs', 'tcs deducted', 'tcs amount']),
      f('tds', 'Income tax TDS deducted', 'money', false, ['tds', 'income tax tds', 'tds deducted', 'tds amount', '194o']),
      f('reference', 'Settlement reference', 'string', false, ['utr', 'reference', 'settlement id', 'settlement ref', 'payout id', 'transaction id', 'neft']),
      f('date', 'Settlement date', 'date', true, ['settlement date', 'date', 'payout date', 'paid on', 'credited on']),
    ],
  },
  cod: {
    label: 'COD remittance',
    fields: [
      f('orderId', 'Order ID', 'string', false, ID),
      f('awb', 'AWB', 'string', false, AWB),
      f('amount', 'Amount remitted', 'money', true, ['remitted', 'remittance amount', 'amount remitted', 'cod amount', 'net remitted', 'amount', 'collected']),
      f('reference', 'Remittance reference', 'string', false, ['utr', 'remittance id', 'reference', 'crf id', 'batch id', 'remittance ref']),
      f('date', 'Remittance date', 'date', true, ['remittance date', 'date', 'remitted on', 'credited on']),
    ],
  },
  freight: {
    label: 'Freight invoice',
    fields: [
      f('orderId', 'Order ID', 'string', false, ID),
      f('awb', 'AWB', 'string', false, AWB),
      f('amount', 'Freight charged', 'money', true, ['freight', 'freight charged', 'freight charge', 'shipping charge', 'charged amount', 'total freight', 'amount']),
      f('chargedWeight', 'Charged weight', 'weight', false, ['charged weight', 'billed weight', 'chargeable weight', 'applied weight']),
      f('reference', 'Invoice number', 'string', false, ['invoice', 'invoice no', 'invoice number', 'bill no']),
      f('date', 'Invoice date', 'date', false, ['invoice date', 'date', 'bill date']),
    ],
  },
  warehouse: {
    label: 'Warehouse receipt scans',
    fields: [
      f('orderId', 'Order ID', 'string', false, ID),
      f('awb', 'AWB', 'string', false, AWB),
      f('date', 'Scan date', 'date', true, ['scan date', 'received on', 'received date', 'date', 'grn date', 'scanned at']),
      f('condition', 'Condition', 'string', false, ['condition', 'item condition', 'qc status', 'qc']),
    ],
  },
};

export function transformRow(sourceType, record, columns) {
  const doc = {}; const errors = [];
  for (const field of SOURCES[sourceType].fields) {
    const col = columns[field.key];
    const raw = col ? record[col] : undefined;
    try {
      let v;
      if (field.type === 'money') v = parseMoney(raw);
      else if (field.type === 'date') v = parseDate(raw);
      else if (field.type === 'weight') v = parseWeightGrams(raw);
      else if (field.type === 'mode') v = normalizeMode(raw);
      else v = raw === null || raw === undefined || String(raw).trim() === '' ? null : String(raw).trim();
      if (v === null || v === undefined) {
        if (field.required) errors.push(`${field.label} is missing`);
        continue;
      }
      doc[field.key] = v;
    } catch (e) {
      errors.push(`${field.label}: ${e.message}`);
    }
  }
  return { doc, errors };
}
