/** @jest-environment node */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runtime } from '../server/runtime.mts';

describe('deployment configuration', () => {
  it('requires server credentials and opens the deployment-owned persistent volume', () => {
    const before = { ...process.env };
    const directory = mkdtempSync(join(tmpdir(), 'nostranslation-runtime-'));
    try {
      delete process.env.NOSTRANSLATION_GITHUB_APP_ID;
      expect(() => runtime()).toThrow('NOSTRANSLATION_GITHUB_APP_ID');
      process.env.NOSTRANSLATION_GITHUB_APP_ID = '123';
      delete process.env.NOSTRANSLATION_GITHUB_INSTALLATION_ID;
      expect(() => runtime()).toThrow('NOSTRANSLATION_GITHUB_INSTALLATION_ID');
      process.env.NOSTRANSLATION_GITHUB_INSTALLATION_ID = '456';
      delete process.env.NOSTRANSLATION_GITHUB_KEY_FILE;
      expect(() => runtime()).toThrow('NOSTRANSLATION_GITHUB_KEY_FILE');
      const keyfile = join(directory, 'key.pem');
      writeFileSync(keyfile, 'fictional-key-not-used-in-this-test');
      process.env.NOSTRANSLATION_GITHUB_KEY_FILE = keyfile;
      process.env.NOSTRANSLATION_DATABASE = join(
        directory,
        'state',
        'db.sqlite',
      );
      const configured = runtime();
      expect(configured.store.consumeSignature('example', 1)).toBe(true);
      configured.store.close();
      const oldDirectory = process.cwd();
      process.chdir(directory);
      delete process.env.NOSTRANSLATION_DATABASE;
      try {
        const defaults = runtime();
        defaults.store.close();
      } finally {
        process.chdir(oldDirectory);
      }
    } finally {
      process.env = before;
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
