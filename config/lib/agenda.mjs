import Agenda from 'agenda';
import config from './../config.mjs';
let service = {};
service = new Agenda({
  db: {
    address: config.db.uri,
    collection: 'agendaJobs',
  },
});
export default service;
export { service as 'module.exports' };
