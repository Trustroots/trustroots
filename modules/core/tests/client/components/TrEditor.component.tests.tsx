import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import TrEditor from '@/modules/core/client/components/TrEditor';

type EditorEventName = 'editableInput' | 'editableKeydownEnter';
type EditorHandler = (...args: unknown[]) => void;
type EditorFixture = {
  subscribe: jest.Mock<void, [EditorEventName, EditorHandler]>;
  unsubscribe: jest.Mock<void, [EditorEventName, EditorHandler]>;
  trigger: (eventName: EditorEventName, ...args: unknown[]) => void;
  onChange: (value: string) => void;
  setContent: jest.Mock<void, [string]>;
  destroy: jest.Mock<void, []>;
  readonly text: string;
};

const mediumEditors: EditorFixture[] = [];
type TrEditorProps = React.ComponentProps<typeof TrEditor>;

function onChangeMock(): jest.MockedFunction<TrEditorProps['onChange']> {
  return jest.fn();
}

function onCtrlEnterMock(): jest.MockedFunction<TrEditorProps['onCtrlEnter']> {
  return jest.fn();
}

jest.mock('medium-editor', () => {
  return jest.fn().mockImplementation((element: HTMLElement) => {
    const subscribers: Partial<Record<EditorEventName, EditorHandler>> = {};
    const medium: EditorFixture = {
      subscribe: jest.fn(
        (eventName: EditorEventName, handler: EditorHandler) => {
          subscribers[eventName] = handler;
        },
      ),
      unsubscribe: jest.fn(
        (eventName: EditorEventName, handler: EditorHandler) => {
          if (subscribers[eventName] === handler) delete subscribers[eventName];
        },
      ),
      trigger(eventName: EditorEventName, ...args: unknown[]) {
        subscribers[eventName]?.(...args);
      },
      onChange(value: string) {
        element.innerHTML = value;
        medium.trigger('editableInput', new Event('input'), element);
      },
      setContent: jest.fn((value: string) => medium.onChange(value)),
      destroy: jest.fn(),
      get text() {
        return element.innerHTML;
      },
    };
    mediumEditors.push(medium);
    return medium;
  });
});

describe('<TrEditor />', () => {
  beforeEach(() => {
    mediumEditors.length = 0;
  });

  it('forwards onChange text without trailing <br></p>', () => {
    const onChange = onChangeMock();
    render(
      <TrEditor
        id="bio"
        onChange={onChange}
        onCtrlEnter={onCtrlEnterMock()}
        text="initial"
      />,
    );

    const editor = mediumEditors[0];
    editor.onChange('<p>hello<br></p>');

    expect(onChange).toHaveBeenCalledWith('<p>hello</p>');
  });

  it('subscribes to ctrl+enter events', () => {
    const onCtrlEnter = onCtrlEnterMock();
    const { unmount } = render(
      <TrEditor
        id="bio"
        onChange={onChangeMock()}
        onCtrlEnter={onCtrlEnter}
        text="initial"
      />,
    );

    const editor = mediumEditors[0];
    editor.trigger('editableKeydownEnter', { ctrlKey: false });
    editor.trigger('editableKeydownEnter', {
      ctrlKey: true,
      preventDefault: jest.fn(),
    });

    expect(onCtrlEnter).toHaveBeenCalledTimes(1);
    expect(editor.subscribe).toHaveBeenCalledWith(
      'editableKeydownEnter',
      expect.any(Function),
    );
    const handler = editor.subscribe.mock.calls.find(
      ([eventName]) => eventName === 'editableKeydownEnter',
    )![1];
    unmount();
    expect(editor.unsubscribe).toHaveBeenCalledWith(
      'editableKeydownEnter',
      handler,
    );
    expect(editor.destroy).toHaveBeenCalledTimes(1);
  });

  it('forwards non-normalized content unchanged', () => {
    const onChange = onChangeMock();
    render(
      <TrEditor
        id="bio"
        onChange={onChange}
        onCtrlEnter={onCtrlEnterMock()}
        text="initial"
      />,
    );

    const editor = mediumEditors[0];
    editor.onChange('<p>Hello</p>');

    expect(onChange).toHaveBeenCalledWith('<p>Hello</p>');
  });

  it('does not re-render the editor for its own input but accepts external text', async () => {
    const onChange = onChangeMock();
    const onCtrlEnter = onCtrlEnterMock();
    const { rerender } = render(
      <TrEditor
        id="bio"
        onChange={onChange}
        onCtrlEnter={onCtrlEnter}
        text="initial"
      />,
    );

    const editor = mediumEditors[0];
    editor.onChange('<p>initial edit</p>');
    rerender(
      <TrEditor
        id="bio"
        onChange={onChange}
        onCtrlEnter={onCtrlEnter}
        text="<p>initial edit</p>"
      />,
    );

    expect(mediumEditors).toHaveLength(1);

    rerender(
      <TrEditor
        id="bio"
        onChange={onChange}
        onCtrlEnter={onCtrlEnter}
        text=""
      />,
    );

    await waitFor(() => expect(editor.text).toBe(''));
    expect(mediumEditors).toHaveLength(1);
    expect(editor.setContent).toHaveBeenCalledWith('');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps current callbacks and placeholder without recreating the editor', () => {
    const firstChange = onChangeMock();
    const latestChange = onChangeMock();
    const firstEnter = onCtrlEnterMock();
    const latestEnter = onCtrlEnterMock();
    const { rerender, container } = render(
      <TrEditor
        id="bio"
        text="initial"
        onChange={firstChange}
        onCtrlEnter={firstEnter}
      />,
    );
    const editor = mediumEditors[0];
    rerender(
      <TrEditor
        id="bio"
        text="initial"
        onChange={latestChange}
        onCtrlEnter={latestEnter}
        placeholder="Updated placeholder"
      />,
    );
    editor.onChange('<p>Edited text</p>');
    editor.trigger('editableKeydownEnter', { ctrlKey: true });
    expect(mediumEditors).toHaveLength(1);
    expect(firstChange).not.toHaveBeenCalled();
    expect(firstEnter).not.toHaveBeenCalled();
    expect(latestChange).toHaveBeenCalledWith('<p>Edited text</p>');
    expect(latestEnter).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.tr-editor')).toHaveAttribute(
      'data-placeholder',
      'Updated placeholder',
    );
  });

  it('resets to its original text without reporting external changes as input', () => {
    const onChange = onChangeMock();
    const { rerender, container } = render(
      <TrEditor id="bio" text="<p>Original</p>" onChange={onChange} />,
    );
    expect(container.querySelector('.tr-editor')!.innerHTML).toBe(
      '<p>Original</p>',
    );
    const editor = mediumEditors[0];
    editor.onChange('<p>Edited</p>');
    rerender(<TrEditor id="bio" text="<p>Edited</p>" onChange={onChange} />);
    expect(editor.setContent).not.toHaveBeenCalled();
    rerender(<TrEditor id="bio" text="<p>Original</p>" onChange={onChange} />);
    expect(editor.text).toBe('<p>Original</p>');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('uses translated default placeholder text when none is provided', () => {
    const { container } = render(
      <TrEditor
        id="bio"
        onChange={onChangeMock()}
        onCtrlEnter={onCtrlEnterMock()}
        text="initial"
      />,
    );

    expect(container.querySelector('.tr-editor')).toHaveAttribute(
      'data-placeholder',
      'Type your text',
    );
  });

  it('passes through a custom placeholder', () => {
    const { container } = render(
      <TrEditor
        id="bio"
        onChange={onChangeMock()}
        onCtrlEnter={onCtrlEnterMock()}
        placeholder="Write a careful reply"
        text="initial"
      />,
    );

    expect(container.querySelector('.tr-editor')).toHaveAttribute(
      'data-placeholder',
      'Write a careful reply',
    );
  });

  it('uses a no-op ctrl+enter handler by default', () => {
    render(<TrEditor id="bio" onChange={onChangeMock()} text="initial" />);

    const editor = mediumEditors[0];
    expect(() =>
      editor.trigger('editableKeydownEnter', {
        ctrlKey: true,
        preventDefault: jest.fn(),
      }),
    ).not.toThrow();
  });
});
