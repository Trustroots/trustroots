import '@/config/client/i18n';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LegacyAndroidUpgradeNotice from '@/layers/shell/client/components/LegacyAndroidUpgradeNotice';

function signalReady() {
  document.dispatchEvent(
    new MessageEvent('message', { data: 'trMobileAppInit' }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  delete window.trMobileApp;
  delete window.ReactNativeWebView;
});

it('ignores normal browsers, unrelated messages and non-Android app markers', () => {
  render(<LegacyAndroidUpgradeNotice />);
  act(signalReady);
  expect(screen.queryByRole('note')).toBeNull();

  window.trMobileApp = { os: 'android' };
  act(signalReady);
  expect(screen.queryByRole('note')).toBeNull();

  window.ReactNativeWebView = { postMessage: vi.fn() };
  window.trMobileApp = { os: 'ios' };
  act(signalReady);
  expect(screen.queryByRole('note')).toBeNull();

  window.trMobileApp = { os: 'android' };
  act(() => document.dispatchEvent(new Event('message')));
  act(() =>
    document.dispatchEvent(new MessageEvent('message', { data: 'other' })),
  );
  expect(screen.queryByRole('note')).toBeNull();
});

it('opens the signed APK page through the Expo bridge after late injection', () => {
  render(<LegacyAndroidUpgradeNotice />);
  const postMessage = vi.fn();
  window.trMobileApp = { os: 'android' };
  window.ReactNativeWebView = { postMessage };
  act(signalReady);

  const download = screen.getByRole('link', { name: 'Download for Android' });
  const url = 'https://team.trustroots.org/apps/latest-apk/';
  expect(download).toHaveAttribute('href', url);
  expect(fireEvent.click(download)).toBe(false);
  expect(postMessage).toHaveBeenCalledWith(
    JSON.stringify({ action: 'openUrl', url }),
  );
});

it('keeps the actual download link usable if the bridge becomes unavailable', () => {
  window.trMobileApp = { os: 'android' };
  window.ReactNativeWebView = { postMessage: vi.fn() };
  render(<LegacyAndroidUpgradeNotice />);
  delete window.ReactNativeWebView;

  const download = screen.getByRole('link', { name: 'Download for Android' });
  // Observe the uncancelled click without navigating jsdom away from the page.
  const observeClick = vi.fn((event: MouseEvent) => {
    const preventedByLink = event.defaultPrevented;
    event.preventDefault();
    return preventedByLink;
  });
  window.addEventListener('click', observeClick, { once: true });
  fireEvent.click(download);
  expect(observeClick).toHaveReturnedWith(false);
});

it('remembers dismissal across page loads', () => {
  window.trMobileApp = { os: 'android' };
  window.ReactNativeWebView = { postMessage: vi.fn() };
  const { unmount } = render(<LegacyAndroidUpgradeNotice />);
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByRole('note')).toBeNull();

  unmount();
  render(<LegacyAndroidUpgradeNotice />);
  expect(screen.queryByRole('note')).toBeNull();
});

it('can show and dismiss the notice when storage is blocked', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('Storage blocked');
  });
  window.trMobileApp = { os: 'android' };
  window.ReactNativeWebView = { postMessage: vi.fn() };
  render(<LegacyAndroidUpgradeNotice />);

  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  act(signalReady);
  expect(screen.queryByRole('note')).toBeNull();
});
