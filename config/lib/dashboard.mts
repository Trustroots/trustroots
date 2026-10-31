import type { Agenda } from 'agenda';
import type { MongoBackend } from '@agendajs/mongo-backend';

/** Close the Agenda API and the standalone dashboard's owned MongoDB client. */
export async function shutdownDashboard(agenda: Agenda, backend: MongoBackend) {
  // Agenda.stop() is a no-op if the dashboard did not start a job processor.
  try {
    await agenda.stop();
  } finally {
    await backend.disconnect();
  }
}
