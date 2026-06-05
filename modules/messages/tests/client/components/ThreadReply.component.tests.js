import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ThreadReply from '@/modules/messages/client/components/ThreadReply';

jest.mock('@/modules/core/client/components/TrEditor', () => {
  function MockTrEditor({ id, onChange, text }) {
    return (
      <textarea
        id={id}
        onChange={event => onChange(event.target.value)}
        value={text}
      />
    );
  }
  MockTrEditor.propTypes = {
    id: () => null,
    onChange: () => null,
    text: () => null,
  };

  return MockTrEditor;
});

afterEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
});

describe('<ThreadReply>', () => {
  it('loads and saves the draft for a cached thread', () => {
    window.localStorage.setItem('messages-draft-user', 'Hello there');

    const { getByRole } = render(
      <ThreadReply cacheKey="messages-draft-user" onSend={jest.fn()} />,
    );

    const editor = getByRole('textbox');
    expect(editor).toHaveValue('Hello there');

    fireEvent.change(editor, { target: { value: 'Updated draft' } });

    expect(window.localStorage.getItem('messages-draft-user')).toBe(
      'Updated draft',
    );
  });

  it('sends content and clears a saved draft after a successful send', async () => {
    window.localStorage.setItem('messages-draft-user', 'Saved draft');
    const onSend = jest.fn().mockResolvedValue(true);
    const { container, getByRole } = render(
      <ThreadReply cacheKey="messages-draft-user" onSend={onSend} />,
    );

    fireEvent.change(getByRole('textbox'), {
      target: { value: '<p>Can I stay?</p>' },
    });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith('<p>Can I stay?</p>'),
    );
    await waitFor(() => expect(getByRole('textbox')).toHaveValue(''));
    expect(window.localStorage.getItem('messages-draft-user')).toBeNull();
  });

  it('keeps content when sending does not complete', async () => {
    const onSend = jest.fn().mockResolvedValue(false);
    const { container, getByRole } = render(<ThreadReply onSend={onSend} />);

    fireEvent.change(getByRole('textbox'), {
      target: { value: '<p>Still deciding</p>' },
    });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(onSend).toHaveBeenCalled());
    expect(getByRole('textbox')).toHaveValue('<p>Still deciding</p>');
  });
});
