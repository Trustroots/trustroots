import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { installationToken, Repository } from './github.mts';
import { Store } from './store.mts';

export function runtime() {
  const required = (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`Set ${name} before starting Nostranslation.`);
    return value;
  };
  const repository = new Repository(
    installationToken({
      appId: required('NOSTRANSLATION_GITHUB_APP_ID'),
      installationId: required('NOSTRANSLATION_GITHUB_INSTALLATION_ID'),
      privateKey: readFileSync(
        required('NOSTRANSLATION_GITHUB_KEY_FILE'),
        'utf8',
      ),
    }),
  );
  const filename =
    process.env.NOSTRANSLATION_DATABASE ?? './tmp/nostranslation.sqlite';
  mkdirSync(dirname(filename), { recursive: true });
  return { repository, store: new Store(filename) };
}
