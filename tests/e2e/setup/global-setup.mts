import {
  request,
  type APIRequestContext,
  type APIResponse,
} from '@playwright/test';

async function globalSetup(): Promise<void> {
  const webPort = process.env.TRUSTROOTS_E2E_WEB_PORT || 4300;
  const apiPort = process.env.TRUSTROOTS_E2E_API_PORT || 4301;
  const useWebpackDevServer =
    process.env.TRUSTROOTS_E2E_USE_WEBPACK_DEV_SERVER === 'true';
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ||
    (useWebpackDevServer
      ? `http://localhost:${webPort}`
      : `http://localhost:${apiPort}`);

  const timeoutMs =
    Number(process.env.TRUSTROOTS_E2E_WARMUP_TIMEOUT_MS) || 90000;
  const context = await request.newContext({ baseURL });
  const signupDeadline = Date.now() + timeoutMs;

  let lastError = 'no attempts made';

  try {
    while (Date.now() < signupDeadline) {
      const unique = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

      let response: APIResponse;
      try {
        response = await context.post('/api/auth/signup', {
          data: {
            firstName: 'Warmup',
            lastName: 'User',
            username: `warmup${unique}`,
            email: `warmup${unique}@example.test`,
            password: 'Tester123',
          },
        });
      } catch (error) {
        lastError = errorMessage(error);
        await wait(1000);
        continue;
      }

      if (response.ok()) {
        break;
      }

      lastError = `${response.status()} ${await response.text()}`;
      await wait(1000);
    }

    if (Date.now() >= signupDeadline) {
      throw new Error(
        `End-to-end warmup signup never succeeded within ${timeoutMs}ms. Last response: ${lastError}`,
      );
    }

    await waitForSeededTribes(context, Date.now() + timeoutMs);
  } finally {
    await context.dispose();
  }
}

async function waitForSeededTribes(
  context: APIRequestContext,
  deadline: number,
): Promise<void> {
  let lastError = 'no attempts made';

  while (Date.now() < deadline) {
    try {
      const response = await context.get('/api/tribes?limit=150');

      if (response.ok()) {
        const tribes: unknown = await response.json();
        if (Array.isArray(tribes) && tribes.length >= 10) {
          return;
        }

        lastError = `expected at least 10 tribes, received ${Array.isArray(tribes) ? tribes.length : 'a non-array response'}`;
      } else {
        lastError = `${response.status()} ${await response.text()}`;
      }
    } catch (error) {
      lastError = errorMessage(error);
    }

    await wait(1000);
  }

  throw new Error(
    `End-to-end seeded tribes never appeared before timeout. Last response: ${lastError}`,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default globalSetup;
