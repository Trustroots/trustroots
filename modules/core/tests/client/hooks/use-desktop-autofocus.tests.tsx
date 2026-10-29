import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import useDesktopAutofocus from '@/modules/core/client/hooks/use-desktop-autofocus';

function Form({ enabled = true }: { enabled?: boolean }) {
  const ref = useDesktopAutofocus<HTMLInputElement>(enabled);
  return <input aria-label="First field" ref={ref} />;
}

describe('useDesktopAutofocus', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it.each([true, false])(
    'focuses only when the desktop query matches: %s',
    matches => {
      window.matchMedia = jest.fn().mockReturnValue({ matches });
      render(<Form />);
      expect(window.matchMedia).toHaveBeenCalledWith(
        '(min-width: 768px) and (hover: hover) and (pointer: fine)',
      );
      if (matches) expect(screen.getByLabelText('First field')).toHaveFocus();
      else expect(screen.getByLabelText('First field')).not.toHaveFocus();
    },
  );

  it('does not steal existing focus', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    try {
      render(<Form />);
      expect(button).toHaveFocus();
    } finally {
      button.remove();
    }
  });

  it('does not focus when disabled', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    render(<Form enabled={false} />);
    expect(screen.getByLabelText('First field')).not.toHaveFocus();
  });
});
