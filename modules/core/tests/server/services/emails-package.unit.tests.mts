import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { emailColors } from '../../../../../packages/emails/src/colors.ts';
import { renderEmail } from '../../../../../packages/emails/src/index.ts';
import '../../../../../packages/emails/src/jsx-loader.ts';

const packageDir = new URL('../../../../../packages/emails/', import.meta.url);

describe('@trustroots/emails', function () {
  it('normalises unread-message HTML and keeps block spacing when no plain text was supplied', async function () {
    const { text } = await renderEmail('messages-unread', {
      userFromName: 'Avery',
      userToName: 'Rowan',
      messageCount: 1,
      messages: [
        {
          content:
            '<p>First   line<br>Second line</p>' +
            '<span class="unread-message-content">Nested   fallback</span>Inline after',
        },
      ],
    });

    assert.match(
      text,
      /First line\nSecond line\n\nNested fallback\n\nInline after/,
    );
  });

  it('keeps contact-request HTML on the standard formatter', async function () {
    const { text } = await renderEmail('confirm-contact', {
      name: 'Rowan',
      meName: 'Avery',
      messageHTML:
        '<p class="unread-message-content">An ordinary   contact message.</p>',
    });

    assert.match(text, /\n\nAn ordinary contact message\.\n\n/);
  });

  it('uses the web client’s brand colour', function () {
    const less = readFileSync(
      new URL('../../../client/less/global-variables.less', import.meta.url),
      'utf8',
    );
    assert.equal(
      emailColors.brand,
      /^@brand-primary:\s*(#[0-9a-f]{6});/m.exec(less)?.[1],
    );
  });

  it('compiles the package’s TSX', async function () {
    const component = new URL('component.test.tsx', packageDir);
    writeFileSync(
      component,
      'export default (name: string) => <p title={name}>Hi</p>;\n',
    );
    try {
      const { default: render } = await import(component.href);
      assert.deepEqual(render('Ada').props, { title: 'Ada', children: 'Hi' });
    } finally {
      rmSync(component);
    }
  });

  it('leaves TSX outside the package to Node', async function () {
    const dir = mkdtempSync(path.join(tmpdir(), 'emails-'));
    const outside = path.join(dir, 'outside.tsx');
    writeFileSync(outside, 'export default 1;\n');
    try {
      await assert.rejects(import(pathToFileURL(outside).href), {
        code: 'ERR_UNKNOWN_FILE_EXTENSION',
      });
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('reports JSX that does not compile', async function () {
    const broken = new URL('broken.test.tsx', packageDir);
    writeFileSync(broken, 'export default () => <p>;\n');
    try {
      await assert.rejects(import(broken.href), /Unexpected token|Expected/);
    } finally {
      rmSync(broken);
    }
  });
});
