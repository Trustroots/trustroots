import type { Agenda } from 'agenda';
import agenda from '../../config/lib/agenda.mjs';
import config from '../../config/config.mjs';

export type CapturedJob = {
  type: string;
  data: unknown;
};

type AgendaTestService = Pick<Agenda, 'now'>;
type AgendaJob = Awaited<ReturnType<Agenda['now']>>;
type TestConfig = {
  mailer: { options: unknown };
};

const agendaService = agenda as unknown as AgendaTestService;
const testConfig = config as unknown as TestConfig;
type MochaHook = (callback: () => void) => void;
const mochaHooks = globalThis as typeof globalThis & {
  beforeEach: MochaHook;
  afterEach: MochaHook;
};

/**
 * Helper for testing Agenda jobs
 */
export function catchJobs(): CapturedJob[] {
  const jobs: CapturedJob[] = [];
  let originalNow: AgendaTestService['now'];

  mochaHooks.beforeEach(() => {
    jobs.length = 0;

    // Make agenda.now() give us its jobs
    originalNow = agendaService.now;
    agendaService.now = function (type: string, data: unknown) {
      // ensure it is plain data by serializing to json and back
      jobs.push(JSON.parse(JSON.stringify({ type, data })) as CapturedJob);

      // Resolve asynchronously, matching Agenda's promise-based API.
      return new Promise<AgendaJob>(resolve => {
        process.nextTick(() => {
          resolve({ attrs: { name: type, data } } as AgendaJob);
        });
      });
    };
  });

  mochaHooks.afterEach(() => {
    // Revert all changes we made
    agendaService.now = originalNow;
  });

  return jobs;
}

type CapturedMailerTransport = {
  name: string;
  version: string;
  send(
    data: unknown,
    callback: (error?: Error | null, info?: unknown) => void,
  ): void;
  logger: false;
};

/**
 * Helper for testing sending emails
 * This helper just catches them up without sending them anywhere.
 */
export function catchEmails(): unknown[] {
  const sentEmails: unknown[] = [];
  let originalMailerOptions: unknown;

  mochaHooks.beforeEach(() => {
    sentEmails.length = 0;

    // Make nodemailer give us its emails
    originalMailerOptions = testConfig.mailer.options;
    testConfig.mailer.options = {
      name: 'testsend',
      version: '1',
      send(data, callback) {
        sentEmails.push(data);
        callback();
      },
      logger: false,
    } satisfies CapturedMailerTransport;
  });

  mochaHooks.afterEach(() => {
    // Revert all changes we made
    testConfig.mailer.options = originalMailerOptions;
  });

  return sentEmails;
}
