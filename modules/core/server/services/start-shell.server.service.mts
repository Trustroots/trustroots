import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const builtShellFile = fileURLToPath(
  new URL('../../../../public/assets/_shell.html', import.meta.url),
);

// Server tests run without a client build.
const testShell =
  '<!DOCTYPE html><html lang="en"><head></head><body></body></html>';

let builtShell: Promise<string> | undefined;

function readBuiltShell(file = builtShellFile): Promise<string> {
  return readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT' && process.env.NODE_ENV === 'test') {
      return testShell;
    }
    throw error;
  });
}

/**
 * The TanStack Start SPA shell: prerendered by `vite build`, or rendered on
 * each request by the Vite development server.
 */
function getStartShell(): Promise<string> {
  if (
    process.env.TRUSTROOTS_VITE_DEV_SERVER === 'true' &&
    process.env.NODE_ENV === 'development'
  ) {
    const viteURL =
      process.env.TRUSTROOTS_VITE_URL ||
      `http://localhost:${Number(process.env.PORT) || 3000}`;
    return fetch(new URL('/assets/_shell', viteURL)).then(response => {
      if (!response.ok) {
        throw new Error(
          `The Vite development server answered the shell request with ${response.status}`,
        );
      }
      return response.text();
    });
  }
  builtShell ??= readBuiltShell();
  return builtShell;
}

/** Add the per-request head and script nonce to the Start shell. */
function renderStartShell(shell: string, head: string, nonce: string): string {
  return shell
    .replace(/<script(?![^>]*\snonce=)/g, `<script nonce="${nonce}"`)
    .replace('<head>', () => `<head>${head}`);
}

export { getStartShell, readBuiltShell, renderStartShell };
