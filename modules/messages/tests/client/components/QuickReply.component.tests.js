import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import QuickReply from '@/modules/messages/client/components/QuickReply';

describe('<QuickReply />', () => {
  it('sends a positive hosting quick reply with hosting metadata', () => {
    const onSend = jest.fn();

    render(<QuickReply onFocus={jest.fn()} onSend={onSend} />);

    fireEvent.click(screen.getByRole('button', { name: 'Yes, I can host!' }));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0][0]).toContain('data-hosting="yes"');
    expect(onSend.mock.calls[0][0]).toContain('Yes, I can host!');
  });

  it('sends a negative hosting quick reply with hosting metadata', () => {
    const onSend = jest.fn();

    render(<QuickReply onFocus={jest.fn()} onSend={onSend} />);

    fireEvent.click(screen.getByRole('button', { name: "Sorry I can't host" }));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0][0]).toContain('data-hosting="no"');
    expect(onSend.mock.calls[0][0]).toContain("Sorry I can't host");
  });

  it('focuses the normal reply editor instead of sending content', () => {
    const onFocus = jest.fn();
    const onSend = jest.fn();

    render(<QuickReply onFocus={onFocus} onSend={onSend} />);

    fireEvent.click(screen.getByRole('button', { name: 'Write back' }));

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });
});
