import React from 'react';
import { render } from '@testing-library/react';
import type { AxiosAdapter } from 'axios';

import { AnalyticsErrorEvents } from '@/layers/shell/client/AnalyticsErrorEvents';
import httpClient from '@/modules/core/client/api/http-client';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

const failingAdapter: AxiosAdapter = async config => {
  throw Object.assign(new Error('Forbidden'), {
    config,
    response: { status: 403 },
  });
};

describe('AnalyticsErrorEvents', () => {
  it('tracks failed API requests without their URL', async () => {
    const analytics = fakeAnalytics();
    render(<AnalyticsErrorEvents />, { wrapper: analytics.wrapper });

    await expect(
      httpClient.post('/api/contacts/some-id', {}, { adapter: failingAdapter }),
    ).rejects.toThrow('Forbidden');

    expect(analytics.track).toHaveBeenCalledWith('api_request_failed', {
      status: 403,
      method: 'post',
      area: 'contacts',
    });
  });

  it('tracks uncaught errors and unhandled rejections by kind only', () => {
    const analytics = fakeAnalytics();
    render(<AnalyticsErrorEvents />, { wrapper: analytics.wrapper });

    window.dispatchEvent(new Event('error'));
    window.dispatchEvent(new Event('unhandledrejection'));

    expect(analytics.track.mock.calls).toEqual([
      ['client_error', { kind: 'error' }],
      ['client_error', { kind: 'unhandled_rejection' }],
    ]);
  });

  it('stops listening once unmounted', async () => {
    const analytics = fakeAnalytics();
    const { unmount } = render(<AnalyticsErrorEvents />, {
      wrapper: analytics.wrapper,
    });
    unmount();

    window.dispatchEvent(new Event('error'));
    await expect(
      httpClient.get('/api/users', { adapter: failingAdapter }),
    ).rejects.toThrow('Forbidden');

    expect(analytics.track).not.toHaveBeenCalled();
  });
});
