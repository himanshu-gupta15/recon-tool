import { ObjectId } from 'mongodb';
import fs from 'node:fs';
import { commitFile } from './ingest.js';
import { runMatch } from './match.js';

// Imports run one at a time, so two uploads can't recompute claims together.
let chain = Promise.resolve();

export async function startImportJob(db, params) {
  const { insertedId } = await db.collection('jobs').insertOne({ type: 'import', status: 'running', fileName: params.fileName, startedAt: new Date() });
  chain = chain.then(async () => {
    const t0 = Date.now();
    try {
      const stats = await commitFile(db, params);
      const t1 = Date.now();
      const match = await runMatch(db);
      await db.collection('jobs').updateOne({ _id: insertedId }, { $set: { status: 'done', stats, match, importMs: t1 - t0, matchMs: Date.now() - t1, finishedAt: new Date() } });
      await db.collection('uploads').updateOne({ _id: params.uploadId }, { $set: { status: 'imported', stats, importedAt: new Date() }, $unset: { tempPath: '' } });
    } catch (e) {
      await db.collection('jobs').updateOne({ _id: insertedId }, { $set: { status: 'failed', error: e.message, finishedAt: new Date() } });
      await db.collection('uploads').updateOne({ _id: params.uploadId }, { $set: { status: 'failed', error: e.message }, $unset: { tempPath: '' } });
    } finally {
      fs.rm(params.file, { force: true }, () => {}); // raw partner files aren't kept
    }
  });
  return insertedId;
}

export const rematch = (db) => { const p = chain.then(() => runMatch(db)); chain = p.catch(() => {}); return p; };
export const jobById = (db, id) => db.collection('jobs').findOne({ _id: new ObjectId(id) });
