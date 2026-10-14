import type { MailMessage } from 'nodemailer';
import agenda from '../../config/lib/agenda.mjs';
import config from '../../config/config.mjs';

export type CapturedJob<TData = unknown> = {
  type: string;
  data: TData;
};

type AgendaJobDouble = {
  attrs: {
    name: string;
    data: unknown;
  };
};
type AgendaNow = (
  this: unknown,
  type: string,
  data: unknown,
) => Promise<AgendaJobDouble>;
type AgendaTestService = { now: AgendaNow };
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
export function catchJobs<TData = unknown>(): CapturedJob<TData>[] {
  const jobs: CapturedJob<TData>[] = [];
  let originalNow: AgendaTestService['now'];

  mochaHooks.beforeEach(() => {
    jobs.length = 0;

    // Make agenda.now() give us its jobs
    originalNow = agendaService.now;
    agendaService.now = function (type: string, data: unknown) {
      // ensure it is plain data by serializing to json and back
      jobs.push(
        JSON.parse(JSON.stringify({ type, data })) as CapturedJob<TData>,
      );

      // Resolve asynchronously, matching Agenda's promise-based API.
      return new Promise<AgendaJobDouble>(resolve => {
        process.nextTick(() => {
          resolve({ attrs: { name: type, data } });
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
    mail: MailMessage,
    callback: (error?: Error | null, info?: unknown) => void,
  ): void;
  logger: false;
};

export type CapturedEmail = MailMessage;

/**
 * Helper for testing sending emails
 * This helper just catches them up without sending them anywhere.
 */
export function catchEmails(): CapturedEmail[] {
  const sentEmails: CapturedEmail[] = [];
  let originalMailerOptions: unknown;

  mochaHooks.beforeEach(() => {
    sentEmails.length = 0;

    // Make nodemailer give us its emails
    originalMailerOptions = testConfig.mailer.options;
    testConfig.mailer.options = {
      name: 'testsend',
      version: '1',
      send(mail, callback) {
        sentEmails.push(mail);
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
