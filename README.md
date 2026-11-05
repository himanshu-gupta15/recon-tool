# Recon

A working prototype of the order, payment and return reconciliation tool for the D2C home brand brief (Brief 5). Finance uploads partner reports and sees, per order, whether the right amount was paid. Anything short, late or overcharged goes into a claims list with evidence.

Stack: Next.js, Express, Node.js and MongoDB.

## Run it

You need Node.js 20 or later.

```
npm install
npm run dev          # database, API on :4000, web on http://localhost:3000
npm run seed         # in a second terminal: resets the database and loads demo data
```

The first run downloads a private copy of MongoDB into the project's cache, which can take a few minutes. To use your own MongoDB, set `MONGODB_URI`.

Demo sign-ins all use the password `demo1234`:

| Email | Role | Can do |
|---|---|---|
| `finance@demo.local` | Finance executive | Everything except write-offs. Customer details are masked. |
| `founder@demo.local` | Finance co-founder | Everything, including write-offs and viewing customer details |
| `returns@demo.local` | Returns manager | Returns, return claims and warehouse scan uploads |

To see a partner's format change handled, upload `server/seed-files/try-me-courier-a-new-format.csv` as COD remittance for Courier Aggregator A.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Rule and file-reading tests |
| `npm run perf` | Times a 1 lakh row settlement file through import and matching, on a separate database |
| `npm run build` | Production build of the web app |

## How it decides

Matching and expected amounts are fixed rules in `server/src/engine.js`, not AI.

- **Expected amount:** order value less the channel's fee, from the rate card in force on the order date.
- **Received:** net paid + TCS + TDS. Tax deductions are shown separately and aren't treated as leakage.
- **Flag:** a gap over ₹10 (exactly ₹10 is not flagged).
- **Statuses:** settled, short-paid, unpaid past due, freight overcharged and return not received. Added beyond the brief: not yet due, overpaid (check), cancelled and no rate card. One order can have several issues.
- **Duplicates:** the same statement line uploaded twice counts once. A second payment with a different reference still adds up.

## When something is wrong

- **Column mapping:** a proposal is previewed on 20 rows and needs approval. Each approval saves a new version, and earlier versions can be reused from the upload screen.
- **Wrong mapping:** if more than half the rows can't be read, nothing is imported. Otherwise bad rows are rejected and listed by row number.
- **Missing order ID:** the line goes to the review queue with suggestions. Nothing is linked without a person.
- **Missing rate card or freight data:** the order is marked as unchecked, and no claim is raised.
- **Claims:** filing with a partner stays manual. Write-offs need the co-founder and a reason. Actions are written to an audit log.

## Data protection

- Columns that aren't mapped are never stored, and uploaded files are deleted after import.
- Customer name and phone are optional. They are masked for everyone except the co-founder and left out of evidence exports.
- The AI sees only column names and sample values with letters and digits masked.

## AI

Column mapping uses Claude when `ANTHROPIC_API_KEY` is set, with the model set by `ANTHROPIC_MODEL` (default `claude-opus-5-5`). With no key, or if the call fails, it uses rule-based name matching.

## Assumptions and limits

These are prototype choices that need confirming with the client.

- All rates, fees, windows and demo data are invented. Website and Marketplace 1 rates were set so the brief's three sample rows come out exactly (−₹1,409, −₹37, −₹46), and expected amounts round to the rupee to match them.
- A prepaid return is charged a percentage of order value, and a COD return expects no money.
- A missing return counts at full order value because product cost isn't in the files.
- Couriers remit COD on Website orders, and missing returns are claimed against the courier.
- Dates are read as day first unless that's impossible.
- Partner lines with no ID get rule-scored match suggestions. The brief calls for AI here, and that isn't built.
- The demo's 99.4% match rate comes from invented data and says nothing about real partner files.
- Before real use, this still needs real partner samples, a security review, hosted deployment, backups and proper user management. Demo sign-ins must be replaced.
