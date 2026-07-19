import React from 'react';
import { act, render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import MediumEditor from 'medium-editor';

import '@/config/client/i18n';
import TrEditor from '@/modules/core/client/components/TrEditor';

const mockMediumEditors = [];

jest.mock('medium-editor', () =>
  jest.fn().mockImplementation((element, options) => {
    const subscribers = {};
    const editor = {
      destroy: jest.fn(),
      element,
      options,
      restoreSelection: jest.fn(),
      saveSelection: jest.fn(),
      subscribe: jest.fn((eventName, handler) => {
        subscribers[eventName] = [...(subscribers[eventName] || []), handler];
      }),
      trigger(eventName, ...args) {
        (subscribers[eventName] || []).forEach(handler => handler(...args));
      },
      unsubscribe: jest.fn((eventName, handler) => {
        subscribers[eventName] = (subscribers[eventName] || []).filter(
          entry => entry !== handler,
        );
      }),
    };
    mockMediumEditors.push(editor);
    return editor;
  }),
);

function renderEditor(props = {}) {
  return render(
    <TrEditor
      id="bio"
      onChange={jest.fn()}
      onCtrlEnter={jest.fn()}
      text="initial"
      {...props}
    />,
  );
}

describe('<TrEditor />', () => {
  beforeEach(() => {
    mockMediumEditors.length = 0;
    MediumEditor.mockClear();
  });

  it('forwards onChange text without trailing <br></p>', () => {
    const onChange = jest.fn();
    const { container } = renderEditor({ onChange });
    const editor = mockMediumEditors[0];
    editor.element.innerHTML = '<p>hello<br></p>';

    act(() => editor.trigger('editableInput'));

    expect(container.querySelector('.tr-editor')).toHaveAttribute('id', 'bio');
    expect(onChange).toHaveBeenCalledWith('<p>hello</p>');
  });

  it('subscribes to ctrl+enter events', () => {
    const onCtrlEnter = jest.fn();
    const { unmount } = renderEditor({ onCtrlEnter });
    const editor = mockMediumEditors[0];

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
    const handler = editor.subscribe.mock.calls[1][1];
    unmount();
    expect(editor.unsubscribe).toHaveBeenCalledWith(
      'editableKeydownEnter',
      handler,
    );
    expect(editor.destroy).toHaveBeenCalledTimes(1);
  });

  it('forwards non-normalised content unchanged', () => {
    const onChange = jest.fn();
    renderEditor({ onChange });
    const editor = mockMediumEditors[0];
    editor.element.innerHTML = '<p>Hello</p>';

    act(() => editor.trigger('editableInput'));

    expect(onChange).toHaveBeenCalledWith('<p>Hello</p>');
  });

  it('uses translated default placeholder text when none is provided', () => {
    renderEditor();

    expect(mockMediumEditors[0].options.placeholder.text).toBe(
      'Type your text',
    );
  });

  it('passes through a custom placeholder', () => {
    renderEditor({ placeholder: 'Write a careful reply' });

    expect(mockMediumEditors[0].options.placeholder.text).toBe(
      'Write a careful reply',
    );
  });

  it('uses a no-op ctrl+enter handler by default', () => {
    render(<TrEditor id="bio" onChange={jest.fn()} text="initial" />);
    const editor = mockMediumEditors[0];

    expect(() =>
      editor.trigger('editableKeydownEnter', {
        ctrlKey: true,
        preventDefault: jest.fn(),
      }),
    ).not.toThrow();
  });

  it('updates external content without overwriting an editor update', () => {
    const onChange = jest.fn();
    const { container, rerender } = renderEditor({ onChange });
    const editor = mockMediumEditors[0];
    const element = container.querySelector('.tr-editor');
    element.innerHTML = 'typed locally';

    act(() => editor.trigger('editableInput'));
    rerender(
      <TrEditor
        id="bio"
        onChange={onChange}
        onCtrlEnter={jest.fn()}
        text="typed locally"
      />,
    );
    expect(element).toHaveTextContent('typed locally');

    rerender(
      <TrEditor
        id="bio"
        onChange={onChange}
        onCtrlEnter={jest.fn()}
        text="updated remotely"
      />,
    );
    expect(element).toHaveTextContent('updated remotely');
    expect(editor.saveSelection).toHaveBeenCalled();
    expect(editor.restoreSelection).toHaveBeenCalled();
  });
});
