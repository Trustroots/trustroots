/* global window, document, MessageEvent */
import { expect, test } from '../../support/fixtures.mts';

test('offers the signed APK only inside the old Android app and remembers dismissal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 640 });
  const notice = page.getByRole('note').filter({
    hasText: 'Switch to the new Trustroots app for Android',
  });
  await page.goto('/?app');
  await expect(notice).toHaveCount(0);

  await page.addInitScript(() => {
    // The archived Expo APK sends this message on the Android WebView document.
    const messages: string[] = [];
    Object.assign(window, {
      trMobileApp: { os: 'android', version: '1.3.0' },
      ReactNativeWebView: {
        postMessage: (message: string) => messages.push(message),
      },
      legacyAppMessages: messages,
    });
    window.setInterval(() => {
      document.dispatchEvent(
        new MessageEvent('message', { data: 'trMobileAppInit' }),
      );
    }, 1500);
  });
  await page.reload();
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(
    'sign in with your existing Trustroots account',
  );
  await notice.getByRole('link', { name: 'Download for Android' }).click();
  expect(
    await page.evaluate(() => Reflect.get(window, 'legacyAppMessages')),
  ).toEqual([
    JSON.stringify({
      action: 'openUrl',
      url: 'https://team.trustroots.org/apps/latest-apk/',
    }),
  ]);

  await notice.getByRole('button', { name: 'Dismiss' }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('navigation', { name: 'Page navigation' }),
  ).toBeVisible();
  await expect(notice).toHaveCount(0);
});
