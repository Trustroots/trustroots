import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Alert } from '../../../../../packages/ui/src/components/Alert';

test.each([
  [
    'danger',
    'tw:bg-danger-bg',
    'tw:text-danger-text',
    'tw:border-danger-border',
  ],
  ['info', 'tw:bg-info-bg', 'tw:text-info-text', 'tw:border-info-border'],
  [
    'success',
    'tw:bg-success-bg',
    'tw:text-success-text',
    'tw:border-success-border',
  ],
  [
    'warning',
    'tw:bg-warning-bg',
    'tw:text-warning-text',
    'tw:border-warning-border',
  ],
] as const)('the %s tone sets its own colours', (tone, ...classes) => {
  render(
    <Alert tone={tone} role="alert">
      Message
    </Alert>,
  );
  const alert = screen.getByRole('alert');
  expect(alert).toHaveClass('tw:p-4', 'tw:rounded-md', ...classes);
  expect(alert).not.toHaveClass('tw:text-center');
});

test('the centre alignment centres the text', () => {
  render(
    <Alert tone="danger" align="center" role="alert">
      Centred
    </Alert>,
  );
  expect(screen.getByRole('alert')).toHaveClass('tw:text-center');
});

test.each(['status', 'note', 'dialog'] as const)(
  'renders the caller-chosen %s role and other attributes',
  role => {
    render(
      <Alert tone="info" role={role} aria-label="Guide" tabIndex={-1}>
        Guide
      </Alert>,
    );
    const alert = screen.getByRole(role, { name: 'Guide' });
    expect(alert).toHaveAttribute('tabindex', '-1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  },
);

test('a caller class name merges with the tone classes', () => {
  render(
    <Alert tone="info" role="note" className="offer-map-guide">
      Guide
    </Alert>,
  );
  expect(screen.getByRole('note')).toHaveClass(
    'offer-map-guide',
    'tw:bg-info-bg',
  );
});
