import { MongoClient } from 'mongodb';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LOCAL_PORT = 27117;
let client; let mem; let db;

const portOpen = (port) => new Promise((res) => {
  const s = net.connect(port, '127.0.0.1');
  s.setTimeout(500);
  s.once('connect', () => { s.destroy(); res(true); });
  s.once('error', () => res(false));
  s.once('timeout', () => { s.destroy(); res(false); });
});

// Uses MONGODB_URI when set. Otherwise runs a private MongoDB from the project
// folder, so nothing has to be installed on the machine.
async function resolveUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  if (process.env.NODE_ENV === 'production') throw new Error('MONGODB_URI is required in production');
  const uri = `mongodb://127.0.0.1:${LOCAL_PORT}/`;
  if (await portOpen(LOCAL_PORT)) return uri;
  if (process.env.LOCAL_DB_MANAGED) {
    // Under `npm run dev` the database is its own process, so an API restart
    // can't take it down. The first run may take a while to download MongoDB.
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await portOpen(LOCAL_PORT)) return uri;
    }
    throw new Error('The local database did not start');
  }
  await startLocalDb();
  return uri;
}

export async function startLocalDb() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const dbPath = path.join(root, '.data/mongo');
  fs.mkdirSync(dbPath, { recursive: true });
  mem = await MongoMemoryServer.create({ instance: { port: LOCAL_PORT, dbPath, storageEngine: 'wiredTiger' } });
  return async () => { await mem.stop({ doCleanup: false }); mem = undefined; };
}

export async function connect(name = process.env.DB_NAME || 'recon') {
  if (db) return db;
  client = new MongoClient(await resolveUri());
  await client.connect();
  db = client.db(name);
  await ensureIndexes(db);
  return db;
}

export async function ensureIndexes(d) {
  await Promise.all([
    d.collection('users').createIndex({ email: 1 }, { unique: true }),
    d.collection('orders').createIndex({ orderId: 1 }, { unique: true }),
    d.collection('orders').createIndex({ awb: 1 }),
    d.collection('orders').createIndex({ status: 1, orderDate: -1 }),
    d.collection('orders').createIndex({ delivery: 1, returnDueBy: 1 }),
    d.collection('lines').createIndex({ lineKey: 1 }, { unique: true }),
    d.collection('lines').createIndex({ state: 1 }),
    d.collection('lines').createIndex({ linkedOrderId: 1 }),
    d.collection('claims').createIndex({ key: 1 }, { unique: true }),
    d.collection('claims').createIndex({ status: 1, partner: 1 }),
    d.collection('mappings').createIndex({ sourceType: 1, partner: 1, version: -1 }),
  ]);
}

export async function close() {
  await client?.close();
  await mem?.stop({ doCleanup: false });
  client = mem = db = undefined;
}
