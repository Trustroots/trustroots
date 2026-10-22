import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const source = new URL('../../docs/src/', import.meta.url);
const output = new URL('../../docs/assets/js/', import.meta.url);
await mkdir(output, { recursive: true });
for (const name of await readdir(source)) {
  if (!name.endsWith('.mts')) continue;
  const code = stripTypeScriptTypes(
    await readFile(new URL(name, source), 'utf8'),
  ).replace(/(from\s+['"]\.[^'"]*)\.mts(['"])/g, '$1.mjs$2');
  await writeFile(new URL(name.replace(/\.mts$/, '.mjs'), output), code);
}
