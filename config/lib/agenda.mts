import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import config from './../config.mts';
const service = new Agenda({
  backend: new MongoBackend({
    address: config.db.uri,
    collection: 'agendaJobs',
  }),
});
export default service;
export { service as 'module.exports' };
