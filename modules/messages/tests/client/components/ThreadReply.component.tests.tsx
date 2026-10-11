import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import ThreadReply from '@/modules/messages/client/components/ThreadReply';

import { previewMessage } from '@/modules/messages/client/api/messages.api';

jest.mock('@/modules/messages/client/api/messages.api', () => ({
  previewMessage: jest.fn(),
}));
const mockPreviewMessage = jest.mocked(previewMessage);

type EditorMockProps = {
  id?: string;
  onChange: (value: string) => void;
  onCtrlEnter: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  text: string;
};
type OnSend = React.ComponentProps<typeof ThreadReply>['onSend'];

jest.mock('@/modules/core/client/components/TrEditor', () => {
  function MockTrEditor({ id, onChange, onCtrlEnter, text }: EditorMockProps) {
    return (
      <textarea
        id={id}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.ctrlKey && event.key === 'Enter') {
            onCtrlEnter(event);
          }
        }}
        value={text}
      />
    );
  }
  return MockTrEditor;
});

afterEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
});

function getForm(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector('form');
  if (!form) {
    throw new Error('Expected the reply form to be rendered');
  }
  return form;
}

describe('<ThreadReply>', () => {
  it('disables preview for empty drafts and shows formatted content without changing the cached draft', async () => {
    const draft = '<p><strong>Fictional draft</strong></p>';
    mockPreviewMessage.mockResolvedValue('<p><b>Fictional draft</b></p>');
    const onSend = jest.fn();
    const { getByRole, queryByRole } = render(
      <ThreadReply cacheKey="preview-draft" onSend={onSend} />,
    );
    expect(getByRole('button', { name: 'Preview' })).toBeDisabled();
    fireEvent.change(getByRole('textbox'), { target: { value: '<p> </p>' } });
    expect(getByRole('button', { name: 'Preview' })).toBeDisabled();
    fireEvent.change(getByRole('textbox'), { target: { value: draft } });
    fireEvent.click(getByRole('button', { name: 'Preview' }));
    expect(getByRole('status')).toHaveTextContent('Loading preview');
    expect(getByRole('button', { name: 'Edit' })).toHaveFocus();
    await waitFor(() => expect(queryByRole('status')).not.toBeInTheDocument());
    expect(
      getByRole('region', { name: 'Message preview' }).querySelector('b'),
    ).toHaveTextContent('Fictional draft');
    expect(previewMessage).toHaveBeenCalledWith(draft);
    expect(onSend).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('preview-draft')).toBe(draft);
    fireEvent.click(getByRole('button', { name: 'Edit' }));
    expect(getByRole('textbox')).toHaveValue(draft);
    expect(getByRole('textbox')).toHaveFocus();
  });

  it('offers retry after preview failure and uses message link rules', async () => {
    mockPreviewMessage
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(
        '<p><a href="https://outside.example/">External</a> <a href="/profile/fictional">Internal</a></p>',
      );
    const { getByRole } = render(<ThreadReply onSend={jest.fn()} />);
    fireEvent.change(getByRole('textbox'), {
      target: { value: '<p>Draft</p>' },
    });
    fireEvent.click(getByRole('button', { name: 'Preview' }));
    await waitFor(() =>
      expect(getByRole('alert')).toHaveTextContent('Failed to load preview'),
    );
    fireEvent.click(getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(getByRole('link', { name: 'Internal' })).toHaveAttribute(
        'href',
        '/profile/fictional',
      ),
    );
    expect(getByRole('region', { name: 'Message preview' })).toHaveTextContent(
      'External',
    );
    expect(previewMessage).toHaveBeenCalledTimes(2);
  });

  it('ignores stale success and error responses when editing a newer draft', async () => {
    let resolveFirst!: (content: string) => void;
    let rejectSecond!: (error: Error) => void;
    mockPreviewMessage
      .mockImplementationOnce(
        () =>
          new Promise<string>(resolve => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<string>((_resolve, reject) => {
            rejectSecond = reject;
          }),
      )
      .mockResolvedValueOnce('<p>Newest preview</p>');
    const { getByRole, queryByRole } = render(
      <ThreadReply onSend={jest.fn()} />,
    );
    fireEvent.change(getByRole('textbox'), {
      target: { value: '<p>First</p>' },
    });
    fireEvent.click(getByRole('button', { name: 'Preview' }));
    fireEvent.click(getByRole('button', { name: 'Edit' }));
    fireEvent.change(getByRole('textbox'), {
      target: { value: '<p>Second</p>' },
    });
    fireEvent.click(getByRole('button', { name: 'Preview' }));
    fireEvent.click(getByRole('button', { name: 'Edit' }));
    fireEvent.change(getByRole('textbox'), {
      target: { value: '<p>Newest</p>' },
    });
    fireEvent.click(getByRole('button', { name: 'Preview' }));
    await waitFor(() =>
      expect(
        getByRole('region', { name: 'Message preview' }),
      ).toHaveTextContent('Newest preview'),
    );
    resolveFirst('<p>Old preview</p>');
    rejectSecond(new Error('old error'));
    await waitFor(() => expect(previewMessage).toHaveBeenCalledTimes(3));
    expect(getByRole('region', { name: 'Message preview' })).toHaveTextContent(
      'Newest preview',
    );
    expect(queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores preview responses after unmounting', async () => {
    let resolvePreview!: (content: string) => void;
    mockPreviewMessage.mockImplementationOnce(
      () =>
        new Promise<string>(resolve => {
          resolvePreview = resolve;
        }),
    );
    const { getByRole, unmount } = render(<ThreadReply onSend={jest.fn()} />);
    fireEvent.change(getByRole('textbox'), { target: { value: 'Draft' } });
    fireEvent.click(getByRole('button', { name: 'Preview' }));
    unmount();
    resolvePreview('Old conversation');
    await Promise.resolve();
  });

  it('sends the original draft from preview, preserves it on failure and clears it on success', async () => {
    const draft = '<p><strong>Original draft</strong></p>';
    mockPreviewMessage.mockResolvedValue('<p><b>Original draft</b></p>');
    const onSend = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const { getByRole, queryByRole } = render(
      <ThreadReply cacheKey="preview-draft" onSend={onSend} />,
    );
    fireEvent.change(getByRole('textbox'), { target: { value: draft } });
    fireEvent.click(getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(queryByRole('status')).not.toBeInTheDocument());
    fireEvent.click(getByRole('button', { name: /Send/ }));
    await waitFor(() =>
      expect(getByRole('button', { name: /Send/ })).toBeEnabled(),
    );
    expect(onSend).toHaveBeenCalledWith(draft);
    expect(getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(window.localStorage.getItem('preview-draft')).toBe(draft);
    fireEvent.click(getByRole('button', { name: /Send/ }));
    await waitFor(() => expect(getByRole('textbox')).toHaveValue(''));
    expect(getByRole('textbox')).toHaveFocus();
    expect(window.localStorage.getItem('preview-draft')).toBeNull();
  });

  it('focuses the editor when desktop autofocus is enabled', () => {
    const { getByRole } = render(<ThreadReply autoFocus onSend={jest.fn()} />);

    expect(getByRole('textbox')).toHaveFocus();
  });

  it('does not focus the editor on initial mobile render', () => {
    const { getByRole } = render(<ThreadReply onSend={jest.fn()} />);

    expect(getByRole('textbox')).not.toHaveFocus();
  });

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
    const onSend: OnSend = jest.fn().mockResolvedValue(true);
    const { container, getByRole } = render(
      <ThreadReply cacheKey="messages-draft-user" onSend={onSend} />,
    );

    fireEvent.change(getByRole('textbox'), {
      target: { value: '<p>Can I stay?</p>' },
    });
    fireEvent.submit(getForm(container));

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith('<p>Can I stay?</p>'),
    );
    await waitFor(() => expect(getByRole('textbox')).toHaveValue(''));
    expect(getByRole('textbox')).toHaveFocus();
    expect(window.localStorage.getItem('messages-draft-user')).toBeNull();
  });

  it('keeps content when sending does not complete', async () => {
    const onSend: OnSend = jest.fn().mockResolvedValue(false);
    const { container, getByRole } = render(<ThreadReply onSend={onSend} />);

    fireEvent.change(getByRole('textbox'), {
      target: { value: '<p>Still deciding</p>' },
    });
    fireEvent.submit(getForm(container));

    await waitFor(() => expect(onSend).toHaveBeenCalled());
    expect(getByRole('textbox')).toHaveValue('<p>Still deciding</p>');
  });

  it('does not send empty content or disable the send button', () => {
    const onSend: OnSend = jest.fn();
    const { container, getByRole } = render(<ThreadReply onSend={onSend} />);

    fireEvent.change(getByRole('textbox'), {
      target: { value: '<p>   </p>' },
    });
    fireEvent.submit(getForm(container));

    expect(onSend).not.toHaveBeenCalled();
    expect(getByRole('button', { name: /Send/ })).toBeEnabled();
  });

  it('ignores duplicate submits while a message is still sending', async () => {
    let resolveSend!: (sent: boolean) => void;
    const onSend: OnSend = jest.fn(
      () =>
        new Promise<boolean>(resolve => {
          resolveSend = resolve;
        }),
    );
    const { container, getByRole } = render(<ThreadReply onSend={onSend} />);

    fireEvent.change(getByRole('textbox'), {
      target: { value: '<p>One message only</p>' },
    });
    fireEvent.submit(getForm(container));

    await waitFor(() =>
      expect(getByRole('button', { name: /Send/ })).toBeDisabled(),
    );
    fireEvent.submit(getForm(container));

    expect(onSend).toHaveBeenCalledTimes(1);
    resolveSend(true);
    await waitFor(() =>
      expect(getByRole('button', { name: /Send/ })).toBeEnabled(),
    );
  });

  it('sends content from the editor ctrl-enter shortcut', async () => {
    const onSend: OnSend = jest.fn().mockResolvedValue(true);
    const { getByRole } = render(<ThreadReply onSend={onSend} />);

    fireEvent.change(getByRole('textbox'), {
      target: { value: '<p>Shortcut send</p>' },
    });
    fireEvent.keyDown(getByRole('textbox'), {
      ctrlKey: true,
      key: 'Enter',
    });

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith('<p>Shortcut send</p>'),
    );
  });
});
