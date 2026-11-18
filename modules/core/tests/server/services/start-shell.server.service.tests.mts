import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sinon from 'sinon';

import {
  getStartShell,
  readBuiltShell,
  renderStartShell,
} from '../../../server/services/start-shell.server.service.mts';

describe('Start shell service', function () {
  const environment = { ...process.env };

  afterEach(function () {
    process.env = { ...environment };
  });

  describe('renderStartShell', function () {
    it('adds the head after <head> and a nonce to every script', function () {
      const html = renderStartShell(
        '<html><head><link rel="stylesheet"></head><body><script>a()</script><script type="module" src="/x.js"></script></body></html>',
        '<title>Trustroots</title>',
        'abc',
      );

      assert.equal(
        html,
        '<html><head><title>Trustroots</title><link rel="stylesheet"></head><body><script nonce="abc">a()</script><script nonce="abc" type="module" src="/x.js"></script></body></html>',
      );
    });

    it('keeps existing nonces, including those in the head', function () {
      const html = renderStartShell(
        '<head></head><script nonce="kept"></script><script type="module" nonce="late"></script>',
        '<script nonce="head">var user = null;</script>',
        'abc',
      );

      assert.equal(
        html,
        '<head><script nonce="head">var user = null;</script></head><script nonce="kept"></script><script type="module" nonce="late"></script>',
      );
    });

    it('inserts the head literally, without replacement patterns', function () {
      assert.equal(
        renderStartShell('<head></head>', '<title>$& $1</title>', 'abc'),
        '<head><title>$& $1</title></head>',
      );
    });
  });

  describe('readBuiltShell', function () {
    let directory: string;

    beforeEach(async function () {
      directory = await mkdtemp(join(tmpdir(), 'start-shell-'));
    });

    afterEach(async function () {
      await rm(directory, { recursive: true, force: true });
    });

    it('reads the prerendered shell', async function () {
      const file = join(directory, '_shell.html');
      await writeFile(file, '<html>built</html>');

      assert.equal(await readBuiltShell(file), '<html>built</html>');
    });

    it('uses an empty document in tests without a client build', async function () {
      process.env.NODE_ENV = 'test';

      assert.equal(
        await readBuiltShell(join(directory, 'missing.html')),
        '<!DOCTYPE html><html lang="en"><head></head><body></body></html>',
      );
    });

    it('fails outside tests when the shell has not been built', async function () {
      process.env.NODE_ENV = 'production';

      await assert.rejects(readBuiltShell(join(directory, 'missing.html')), {
        code: 'ENOENT',
      });
    });

    it('fails on read errors other than a missing file', async function () {
      process.env.NODE_ENV = 'test';

      await assert.rejects(readBuiltShell(directory), { code: 'EISDIR' });
    });
  });

  describe('getStartShell', function () {
    let server: Server;
    let requestedPaths: string[];

    beforeEach(async function () {
      requestedPaths = [];
      server = createServer((req, res) => {
        requestedPaths.push(req.url!);
        res.end('<html>vite shell</html>');
      });
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
    });

    afterEach(async function () {
      server.close();
      await once(server, 'close');
    });

    it('fetches the shell from the Vite development server on every request', async function () {
      const address = server.address() as { port: number };
      process.env.NODE_ENV = 'development';
      process.env.TRUSTROOTS_VITE_DEV_SERVER = 'true';
      process.env.TRUSTROOTS_VITE_URL = `http://127.0.0.1:${address.port}`;

      assert.equal(await getStartShell(), '<html>vite shell</html>');
      assert.equal(await getStartShell(), '<html>vite shell</html>');
      assert.deepEqual(requestedPaths, ['/assets/_shell', '/assets/_shell']);
    });

    it('expects the Vite development server on port 3000 by default', async function () {
      process.env.NODE_ENV = 'development';
      process.env.TRUSTROOTS_VITE_DEV_SERVER = 'true';
      delete process.env.TRUSTROOTS_VITE_URL;
      delete process.env.PORT;
      const fetch = sinon
        .stub(globalThis, 'fetch')
        .resolves(new Response('<html>default</html>'));

      try {
        assert.equal(await getStartShell(), '<html>default</html>');
        assert.equal(
          String(fetch.firstCall.args[0]),
          'http://localhost:3000/assets/_shell',
        );
      } finally {
        fetch.restore();
      }
    });

    it('expects the Vite development server on the port Vite reads from PORT', async function () {
      const address = server.address() as { port: number };
      process.env.NODE_ENV = 'development';
      process.env.TRUSTROOTS_VITE_DEV_SERVER = 'true';
      delete process.env.TRUSTROOTS_VITE_URL;
      process.env.PORT = String(address.port);

      assert.equal(await getStartShell(), '<html>vite shell</html>');
      assert.deepEqual(requestedPaths, ['/assets/_shell']);
    });

    it('rejects an error response from the Vite development server', async function () {
      const address = server.address() as { port: number };
      process.env.NODE_ENV = 'development';
      process.env.TRUSTROOTS_VITE_DEV_SERVER = 'true';
      process.env.TRUSTROOTS_VITE_URL = `http://127.0.0.1:${address.port}`;
      server.removeAllListeners('request');
      server.on('request', (_req, res) => {
        res.statusCode = 500;
        res.end('Internal Server Error');
      });

      await assert.rejects(getStartShell(), {
        message:
          'The Vite development server answered the shell request with 500',
      });
    });

    it('caches the built shell unless the development server is enabled in development', async function () {
      const address = server.address() as { port: number };
      process.env.NODE_ENV = 'test';
      process.env.TRUSTROOTS_VITE_DEV_SERVER = 'true';
      process.env.TRUSTROOTS_VITE_URL = `http://127.0.0.1:${address.port}`;

      const shell = getStartShell();
      assert.equal(getStartShell(), shell);
      assert.match(await shell, /^<!DOCTYPE html><html lang="en"><head>/);

      process.env.NODE_ENV = 'development';
      process.env.TRUSTROOTS_VITE_DEV_SERVER = 'false';
      assert.equal(await getStartShell(), await shell);
      assert.deepEqual(requestedPaths, []);
    });
  });
});
