// Keeps the project's private MongoDB running during `npm run dev`.
import { startLocalDb } from './db.js';

if (process.env.MONGODB_URI) {
  console.log('Using MONGODB_URI, so no local database is needed');
} else {
  const stop = await startLocalDb();
  console.log('Local database ready');
  const shutdown = async () => { await stop(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
