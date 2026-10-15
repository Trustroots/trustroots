import { Agenda, type DefineOptions, type Job } from 'agenda';
import config from './../config.mts';
// The installed Agenda implementation accepts string priorities and typed job
// payloads; its published define() signature omits these combinations.
export type RuntimeAgenda = Agenda & {
  define<Data extends object>(
    name: string,
    options: Omit<DefineOptions, 'priority'> & {
      priority?:
        | DefineOptions['priority']
        | 'lowest'
        | 'low'
        | 'normal'
        | 'high'
        | 'highest';
    },
    processor: (
      job: Job<Data>,
      done: (error?: Error | null) => void,
    ) => void | Promise<void>,
  ): void;
};
const service = new Agenda({
  db: {
    address: config.db.uri,
    collection: 'agendaJobs',
  },
}) as RuntimeAgenda;
export default service;
export { service as 'module.exports' };
