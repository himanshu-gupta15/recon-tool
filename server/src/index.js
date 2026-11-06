import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { connect, close } from './db.js';
import { buildRouter } from './routes.js';

const db = await connect();
const app = express();
app.disable('x-powered-by');
// Hosted, requests arrive through the host's proxy and Next.js. Without this, the
// login rate limit would count every visitor as one person.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', true);
app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use('/api', buildRouter(db));
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'The file is over the 60 MB limit' });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong' });
});
const server = app.listen(Number(process.env.PORT) || 4000, '127.0.0.1', () => console.log('API on http://127.0.0.1:4000'));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(async () => { await close(); process.exit(0); }));
