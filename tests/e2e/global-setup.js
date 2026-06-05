const { request } = require('@playwright/test');

/**
 * The end-to-end API server accepts HTTP connections before its Agenda
 * (background job) MongoDB connection is fully established. Signup schedules a
 * confirmation email through Agenda, so requests that arrive during that window
 * fail with a transient "User signup failed" error. This is especially likely
 * early in the run while the webpack dev server is still compiling and starving
 * the API process of CPU.
 *
 * To keep the suite reliable we warm the server up here: repeatedly attempt a
 * throwaway signup until one succeeds, which proves the signup pipeline
 * (including Agenda) is ready before any spec runs.
 */
module.exports = async () => {
  const webPort = process.env.TRUSTROOTS_E2E_WEB_PORT || 4300;
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${webPort}`;

  const timeoutMs =
    Number(process.env.TRUSTROOTS_E2E_WARMUP_TIMEOUT_MS) || 90000;
  const context = await request.newContext({ baseURL });
  const deadline = Date.now() + timeoutMs;

  let lastError = 'no attempts made';

  try {
    while (Date.now() < deadline) {
      const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

      let response;
      try {
        response = await context.post('/api/auth/signup', {
          data: {
            firstName: 'Warmup',
            lastName: 'User',
            username: `warmup-${unique}`,
            email: `warmup-${unique}@example.test`,
            password: 'Tester123',
          },
        });
      } catch (error) {
        lastError = error.message;
        await wait(1000);
        continue;
      }

      if (response.ok()) {
        return;
      }

      lastError = `${response.status()} ${await response.text()}`;
      await wait(1000);
    }
  } finally {
    await context.dispose();
  }

  throw new Error(
    `End-to-end warmup signup never succeeded within ${timeoutMs}ms. Last response: ${lastError}`,
  );
};

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
