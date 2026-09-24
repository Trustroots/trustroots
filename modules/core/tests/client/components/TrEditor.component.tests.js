import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import TrEditor from '@/modules/core/client/components/TrEditor';

const mediumEditors = [];

jest.mock('medium-editor', () => {
  return jest.fn().mockImplementation(element => {
    const subscribers = {};
    const medium = {
      subscribe: jest.fn((eventName, handler) => {
        subscribers[eventName] = handler;
      }),
      unsubscribe: jest.fn((eventName, handler) => {
        if (subscribers[eventName] === handler) delete subscribers[eventName];
      }),
      trigger(eventName, ...args) {
        subscribers[eventName](...args);
      },
      onChange(value) {
        element.innerHTML = value;
        medium.trigger('editableInput', {}, element);
      },
      setContent: jest.fn(value => medium.onChange(value)),
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
    const onChange = jest.fn();
    render(
      <TrEditor
        id="bio"
        onChange={onChange}
        onCtrlEnter={jest.fn()}
        text="initial"
      />,
    );

    const editor = mediumEditors[0];
    editor.onChange('<p>hello<br></p>');

    expect(onChange).toHaveBeenCalledWith('<p>hello</p>');
  });

  it('subscribes to ctrl+enter events', () => {
    const onCtrlEnter = jest.fn();
    const { unmount } = render(
      <TrEditor
        id="bio"
        onChange={jest.fn()}
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
    )[1];
    unmount();
    expect(editor.unsubscribe).toHaveBeenCalledWith(
      'editableKeydownEnter',
      handler,
    );
    expect(editor.destroy).toHaveBeenCalledTimes(1);
  });

  it('forwards non-normalized content unchanged', () => {
    const onChange = jest.fn();
    render(
      <TrEditor
        id="bio"
        onChange={onChange}
        onCtrlEnter={jest.fn()}
        text="initial"
      />,
    );

    const editor = mediumEditors[0];
    editor.onChange('<p>Hello</p>');

    expect(onChange).toHaveBeenCalledWith('<p>Hello</p>');
  });

  it('does not re-render the editor for its own input but accepts external text', async () => {
    const onChange = jest.fn();
    const onCtrlEnter = jest.fn();
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
    const firstChange = jest.fn();
    const latestChange = jest.fn();
    const firstEnter = jest.fn();
    const latestEnter = jest.fn();
    const { rerender, container } = render(
      <TrEditor
        text="initial"
        onChange={firstChange}
        onCtrlEnter={firstEnter}
      />,
    );
    const editor = mediumEditors[0];
    rerender(
      <TrEditor
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
    const onChange = jest.fn();
    const { rerender, container } = render(
      <TrEditor text="<p>Original</p>" onChange={onChange} />,
    );
    expect(container.querySelector('.tr-editor').innerHTML).toBe(
      '<p>Original</p>',
    );
    const editor = mediumEditors[0];
    editor.onChange('<p>Edited</p>');
    rerender(<TrEditor text="<p>Edited</p>" onChange={onChange} />);
    expect(editor.setContent).not.toHaveBeenCalled();
    rerender(<TrEditor text="<p>Original</p>" onChange={onChange} />);
    expect(editor.text).toBe('<p>Original</p>');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('uses translated default placeholder text when none is provided', () => {
    const { container } = render(
      <TrEditor
        id="bio"
        onChange={jest.fn()}
        onCtrlEnter={jest.fn()}
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
        onChange={jest.fn()}
        onCtrlEnter={jest.fn()}
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
    render(<TrEditor id="bio" onChange={jest.fn()} text="initial" />);

    const editor = mediumEditors[0];
    expect(() =>
      editor.trigger('editableKeydownEnter', {
        ctrlKey: true,
        preventDefault: jest.fn(),
      }),
    ).not.toThrow();
  });
});
