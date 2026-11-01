#!/usr/bin/env node
// Pixel-diff harness: compares a base checkout with a head checkout.
// See scripts/visual/README.md for usage.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { MongoClient, ObjectId } from 'mongodb';

import { routeTargets, stateTargets, type SeedParams } from './app/routes.mts';
import { shootApp } from './app/shoot.mts';
import { listFixtures, shootComponents } from './components/shoot.mts';
import { PixelComparer } from './lib/pixels.mts';
import { writeReport } from './lib/report.mts';
import { ResultStore } from './lib/results.mts';

const { values } = parseArgs({
  options: {
    base: { type: 'string' },
    head: { type: 'string', default: process.cwd() },
    out: { type: 'string' },
    suite: { type: 'string', default: 'all' },
    'skip-build': { type: 'boolean', default: false },
    only: { type: 'string' },
    retries: { type: 'string', default: '4' },
    workers: { type: 'string', default: '3' },
  },
});

if (!values.base || !values.out) {
  console.error(
    'Usage: node scripts/visual/run.mts --base DIR [--head DIR] --out DIR [--suite components|app|all] [--skip-build] [--only REGEX] [--retries N] [--workers N]',
  );
  process.exit(2);
}

const base = resolve(values.base);
const head = resolve(values.head);
const out = resolve(values.out);
const only = values.only ? new RegExp(values.only) : undefined;
const retries = Number(values.retries);
const suites =
  values.suite === 'all' ? ['components', 'app'] : values.suite.split(',');
const here = import.meta.dirname;

function run(command: string, args: string[], cwd: string, env = {}) {
  console.log(`$ (${cwd}) ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
  }
}

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address
          ? done(address.port)
          : fail(new Error('No port')),
      );
    });
  });
}

async function waitFor(url: string, timeout = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise(done => setTimeout(done, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function seedParams(mongoUri: string): Promise<SeedParams> {
  const client = await MongoClient.connect(mongoUri);
  try {
    const db = client.db();
    const fallback = new ObjectId('000000000000000000000000').toHexString();
    const first = async (collection: string, filter = {}) => {
      const document = await db.collection(collection).findOne(filter);
      return document?._id?.toString() ?? fallback;
    };
    const circle = await db.collection('tribes').findOne({});
    const collections = (await db.listCollections().toArray()).map(c => c.name);
    const supportCollection = collections.find(name => /support/i.test(name));
    return {
      circle: String(circle?.slug ?? 'hitchhikers'),
      otherMemberId: await first('users', { username: 'e2e-seeded-berlin' }),
      experienceId: await first('experiences'),
      contactId: await first('contacts'),
      offerId: await first('offers', { type: 'meet' }),
      requestId: supportCollection ? await first(supportCollection) : fallback,
    };
  } finally {
    await client.close();
  }
}

const children: ChildProcess[] = [];
let mongoContainer: string | null = null;

function cleanup() {
  for (const child of children) {
    if (child.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // Already gone.
      }
    }
  }
  if (mongoContainer) {
    spawnSync('docker', ['rm', '-f', mongoContainer], { stdio: 'ignore' });
    mongoContainer = null;
  }
}
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

async function main() {
  mkdirSync(out, { recursive: true });
  const store = new ResultStore(out);
  const browser = await chromium.launch();
  const comparer = new PixelComparer(browser);
  const meta: Record<string, string> = {
    Base: base,
    Head: head,
    Started: new Date().toISOString(),
    Browser: `Chromium ${browser.version()}`,
    Tolerance: 'none: any differing channel in any pixel counts',
  };
  try {
    if (!values['skip-build']) {
      for (const dir of [base, head]) run('pnpm', ['run', 'build:e2e'], dir);
    }

    if (suites.includes('components')) {
      const pageDir = join(out, 'fixtures');
      run(
        'pnpm',
        [
          'exec',
          'vite',
          'build',
          '--config',
          join(here, 'components/vite.config.mts'),
        ],
        head,
        {
          NODE_ENV: 'production',
          TRUSTROOTS_SKIP_LOCAL_CONFIG: 'true',
          VISUAL_FIXTURES_OUT_DIR: join(pageDir, 'dist'),
        },
      );
      copyFileSync(
        join(here, 'components/index.html'),
        join(pageDir, 'index.html'),
      );
      const css = {
        before: join(base, 'public/assets'),
        after: join(head, 'public/assets'),
      };
      const fixtures = await listFixtures(browser, pageDir, css.after);
      console.log(`${fixtures.length} component fixtures`);
      await shootComponents({
        browser,
        comparer,
        pageDir,
        css,
        fixtures,
        retries,
        only,
        save: store.save,
      });
    }

    if (suites.includes('app')) {
      const mongoPort = await freePort();
      mongoContainer = `visual-check-mongo-${mongoPort}`;
      run(
        'docker',
        [
          'run',
          '--rm',
          '-d',
          '--name',
          mongoContainer,
          '-p',
          `127.0.0.1:${mongoPort}:27017`,
          '--tmpfs',
          '/data/db:rw,size=512m',
          'mongo:4.4',
        ],
        head,
      );
      const dbHost = `127.0.0.1:${mongoPort}`;
      const mongoUri = `mongodb://${dbHost}/trustroots-test`;
      const env = {
        NODE_ENV: 'test',
        DB_1_PORT_27017_TCP_ADDR: dbHost,
        TRUSTROOTS_SKIP_LOCAL_CONFIG: 'true',
      };
      for (let i = 0; i < 60; i++) {
        try {
          const client = await MongoClient.connect(mongoUri, {
            serverSelectionTimeoutMS: 1000,
          });
          await client.close();
          break;
        } catch {
          await new Promise(done => setTimeout(done, 1000));
        }
      }
      run('node', ['scripts/e2e/seed.js'], head, env);
      const urls = { before: '', after: '' };
      for (const [side, dir] of [
        ['before', base],
        ['after', head],
      ] as const) {
        const port = await freePort();
        const child = spawn('pnpm', ['run', 'start:e2e:api'], {
          cwd: dir,
          detached: true,
          stdio: ['ignore', 'ignore', 'inherit'],
          env: {
            ...process.env,
            ...env,
            TRUSTROOTS_E2E_API_PORT: String(port),
            TRUSTROOTS_TEST_STATS_OUTAGE: 'true',
          },
        });
        children.push(child);
        urls[side] = `http://localhost:${port}`;
      }
      await Promise.all(
        Object.values(urls).map(url =>
          waitFor(`${url}/api/languages?format=array`),
        ),
      );
      meta['Base server'] = urls.before;
      meta['Head server'] = urls.after;
      const params = await seedParams(mongoUri);
      const { REACT_ROUTE_POLICIES } = (await import(
        pathToFileURL(
          join(head, 'modules/core/shared/react-route-ownership.mts'),
        ).href
      )) as { REACT_ROUTE_POLICIES: Parameters<typeof routeTargets>[0] };
      const { E2E_PASSWORD } = (await import(
        pathToFileURL(join(head, 'scripts/e2e/data.mts')).href
      )) as { E2E_PASSWORD: string };
      const targets = [
        ...routeTargets(REACT_ROUTE_POLICIES, params),
        ...stateTargets(params),
      ];
      console.log(`${targets.length} app targets`);
      await shootApp({
        browser,
        comparer,
        urls,
        password: E2E_PASSWORD,
        targets,
        retries,
        workers: Number(values.workers),
        only,
        save: store.save,
      });
    }
  } finally {
    meta.Finished = new Date().toISOString();
    writeReport(out, store.comparisons, meta);
    await browser.close();
    cleanup();
  }
  const summary = store.summary();
  console.log(`Summary: ${JSON.stringify(summary)}`);
  console.log(`Report: ${join(out, 'index.html')}`);
  process.exit(summary.different || summary.error ? 1 : 0);
}

main().catch(error => {
  console.error(error);
  cleanup();
  process.exit(1);
});
