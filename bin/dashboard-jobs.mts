import { parseArgs } from 'node:util';
import type { Server } from 'node:http';
import express from 'express';
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import { createExpressMiddleware } from 'agendash';
import config from './../config/config.mts';
import { shutdownDashboard } from './../config/lib/dashboard.mts';

const { values } = parseArgs({
  options: {
    db: { type: 'string' },
    collection: { type: 'string' },
    port: { type: 'string' },
  },
  strict: true,
});

const backend = new MongoBackend({
  address: values.db ?? config.db.uri,
  collection: values.collection ?? 'agendaJobs',
});
const agenda = new Agenda({
  backend,
});

try {
  await agenda.ready;
} catch (error) {
  await backend.disconnect();
  throw error;
}

const app = express();
app.use('/', createExpressMiddleware(agenda));

const port = Number(values.port ?? 1081);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  await shutdownDashboard(agenda, backend);
  throw new Error('Dashboard port must be an integer between 1 and 65535');
}

let server: Server;
try {
  server = await new Promise<Server>((resolve, reject) => {
    const listeningServer = app.listen(port, '127.0.0.1', () =>
      resolve(listeningServer),
    );
    listeningServer.once('error', reject);
  });
} catch (error) {
  await shutdownDashboard(agenda, backend);
  throw error;
}

console.log(`[Agendash] Dashboard listening on port ${port}`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(async error => {
    if (error) {
      console.error('[Agendash] Could not close dashboard server.', error);
      process.exitCode = 1;
    }
    try {
      await shutdownDashboard(agenda, backend);
    } catch (stopError) {
      console.error('[Agendash] Could not close Agenda cleanly.', stopError);
      process.exitCode = 1;
    }
  });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
