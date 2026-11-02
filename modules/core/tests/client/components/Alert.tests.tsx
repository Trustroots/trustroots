import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Alert } from '../../../../../packages/ui/src/components/Alert';

test.each(['danger', 'info', 'success', 'warning'] as const)(
  'the %s intent uses Bootstrap’s subtle colours for it',
  intent => {
    render(
      <Alert intent={intent} role="alert">
        Message
      </Alert>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-intent', intent);
    expect(alert).toHaveClass(
      'tw:p-4',
      'tw:rounded-md',
      `tw:bg-(--bs-${intent}-bg-subtle)`,
      `tw:border-(--bs-${intent}-border-subtle)`,
      `tw:text-(--bs-${intent}-text-emphasis)`,
    );
  },
);

test.each(['status', 'note', 'dialog'] as const)(
  'renders the caller-chosen %s role and other attributes',
  role => {
    render(
      <Alert intent="info" role={role} aria-label="Guide" tabIndex={-1}>
        Guide
      </Alert>,
    );
    const alert = screen.getByRole(role, { name: 'Guide' });
    expect(alert).toHaveAttribute('tabindex', '-1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  },
);

test('a caller class name merges with the intent classes', () => {
  render(
    <Alert intent="info" role="note" className="offer-map-guide tw:text-center">
      Guide
    </Alert>,
  );
  expect(screen.getByRole('note')).toHaveClass(
    'offer-map-guide',
    'tw:text-center',
    'tw:bg-(--bs-info-bg-subtle)',
  );
});
