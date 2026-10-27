import {
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  UNRESOLVED_STATUSES,
  isSupportStatus,
  normaliseSupportStatus,
} from '../../shared/statuses';
import { redactSupportRequestUrl } from '../../shared/request-url';

test('support statuses preserve legacy meanings and expose all six states', () => {
  expect(SUPPORT_STATUSES).toHaveLength(6);
  expect(SUPPORT_STATUS_LABELS.hold).toBe('On hold');
  expect(UNRESOLVED_STATUSES).toEqual(['new', 'open', 'pending', 'hold']);
  expect(isSupportStatus('closed')).toBe(true);
  expect(isSupportStatus('resolved')).toBe(false);
  expect(normaliseSupportStatus('resolved')).toBe('solved');
  expect(normaliseSupportStatus('pending')).toBe('pending');
  expect(normaliseSupportStatus()).toBe('open');
  expect(normaliseSupportStatus(null)).toBe('open');
  expect(normaliseSupportStatus('unknown')).toBe('open');
});

test('support request URLs omit queries without changing unrelated routes', () => {
  expect(redactSupportRequestUrl('/api/admin/support?q=fictional')).toBe(
    '/api/admin/support',
  );
  expect(
    redactSupportRequestUrl('/admin/support/requests/fictional?q=private'),
  ).toBe('/admin/support/requests/fictional');
  expect(
    redactSupportRequestUrl('/api/admin/support-import/preview?token=private'),
  ).toBe('/api/admin/support-import/preview');
  expect(
    redactSupportRequestUrl('/api/admin/support-members?search=fictional'),
  ).toBe('/api/admin/support-members');
  expect(redactSupportRequestUrl('/admin/support')).toBe('/admin/support');
  expect(redactSupportRequestUrl('/search?location=fictional')).toBe(
    '/search?location=fictional',
  );
});
