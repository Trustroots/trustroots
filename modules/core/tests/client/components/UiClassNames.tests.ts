import { cn } from '../../../../../packages/ui/src/lib/utils';

test('cn joins conditional class names', () => {
  expect(
    cn('tw:block', false, undefined, ['tw:text-text'], { extra: true }),
  ).toBe('tw:block tw:text-text extra');
});

test('cn lets later prefixed utilities replace conflicting ones', () => {
  expect(cn('tw:px-2 tw:py-1', 'tw:px-4')).toBe('tw:py-1 tw:px-4');
  expect(
    cn('tw:enabled:hover:brightness-95', 'tw:enabled:hover:brightness-90'),
  ).toBe('tw:enabled:hover:brightness-90');
});

test('cn knows the theme tokens from globals.css', () => {
  expect(cn('tw:px-control-x', 'tw:px-0')).toBe('tw:px-0');
  expect(cn('tw:py-control-y', 'tw:py-2')).toBe('tw:py-2');
  expect(cn('tw:rounded-base', 'tw:rounded-full')).toBe('tw:rounded-full');
  expect(cn('tw:leading-base', 'tw:leading-none')).toBe('tw:leading-none');
  expect(cn('tw:bg-brand-primary', 'tw:bg-white')).toBe('tw:bg-white');
});

test('cn keeps unprefixed legacy classes', () => {
  expect(cn('pull-right', 'tw:px-0', 'pull-left')).toBe(
    'pull-right tw:px-0 pull-left',
  );
});
