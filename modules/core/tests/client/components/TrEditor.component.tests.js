import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import TrEditor from '@/modules/core/client/components/TrEditor';

const mediumEditors = [];

jest.mock('react-medium-editor', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  const MockMediumEditor = React.forwardRef(function MockMediumEditor(
    { onChange },
    ref,
  ) {
    const medium = React.useRef(null);

    if (!medium.current) {
      const subscribers = {};

      medium.current = {
        subscribe: jest.fn(function (eventName, handler) {
          const handlers = subscribers[eventName] || [];
          handlers.push(handler);
          subscribers[eventName] = handlers;
        }),
        unsubscribe: jest.fn(function (eventName, handler) {
          const handlers = subscribers[eventName] || [];
          subscribers[eventName] = handlers.filter(entry => entry !== handler);
        }),
        trigger(eventName, ...args) {
          (subscribers[eventName] || []).forEach(handler => handler(...args));
        },
        onChange,
        _subscribers: subscribers,
      };

      mediumEditors.push(medium.current);
    }

    medium.current.onChange = onChange;

    React.useImperativeHandle(ref, () => ({
      medium: medium.current,
    }));

    return <div data-testid="tr-editor" />;
  });

  MockMediumEditor.propTypes = {
    onChange: PropTypes.func,
  };

  return {
    __esModule: true,
    default: MockMediumEditor,
  };
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
    editor.onChange('hello<br></p>');

    expect(onChange).toHaveBeenCalledWith('hello</p>');
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
    const handler = editor.subscribe.mock.calls[0][1];
    unmount();
    expect(editor.unsubscribe).toHaveBeenCalledWith(
      'editableKeydownEnter',
      handler,
    );
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
});
