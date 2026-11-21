import express from 'express';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import expressConfig from './../../../../config/lib/express.mts';

describe('View engine', function () {
  let app: import('express').Express;
  let views: string;

  beforeEach(async function () {
    views = await mkdtemp(join(tmpdir(), 'tr-views-'));
    await writeFile(
      join(views, 'ok.mts'),
      'export default (locals: { name: string }) => `<p>${locals.name}</p>`;\n',
    );
    await writeFile(
      join(views, 'throws.mts'),
      "export default () => { throw new Error('render failed'); };\n",
    );
    app = express();
    expressConfig.initViewEngine(app);
    app.set('views', views);
  });

  afterEach(async function () {
    await rm(views, { recursive: true, force: true });
  });

  function render(name: string) {
    return new Promise<{ err: Error | null; html?: string }>(resolve => {
      app.render(name, { name: 'Ada' }, (err, html) => resolve({ err, html }));
    });
  }

  it('renders a view module with its locals', async function () {
    assert.deepEqual(await render('ok'), { err: null, html: '<p>Ada</p>' });
  });

  it('forwards a throwing view to the callback', async function () {
    const { err } = await render('throws');
    assert.equal(err?.message, 'render failed');
  });
});
