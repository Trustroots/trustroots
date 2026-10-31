import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import config from './../config.mts';
import { agendaLockLifetime } from './agenda-lock.mts';
const service = new Agenda({
  defaultLockLifetime: agendaLockLifetime,
  backend: new MongoBackend({
    address: config.db.uri,
    collection: 'agendaJobs',
  }),
});
export default service;
/** @commonjs */
export { service as 'module.exports' };
