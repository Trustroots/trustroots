import type { MockedFunction } from 'vitest';
import React from 'react';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';

import '@/config/client/i18n';
import TrEditor from '@/modules/core/client/components/TrEditor';

type TrEditorProps = React.ComponentProps<typeof TrEditor>;

const execCommand = vi.fn<(...args: [string, boolean?, string?]) => boolean>();
const queryCommandValue = vi.fn<(command: string) => string>();

function onChangeMock(): MockedFunction<TrEditorProps['onChange']> {
  return vi.fn();
}

/** Highlight the first `length` characters of an element. */
function select(element: Element, length: number) {
  const range = document.createRange();
  range.setStart(element.firstChild!, 0);
  range.setEnd(element.firstChild!, length);
  document.getSelection()!.removeAllRanges();
  document.getSelection()!.addRange(range);
  fireEvent(document, new Event('selectionchange'));
}

function typeInto(editor: Element, html: string) {
  editor.innerHTML = html;
  fireEvent.input(editor);
}

function pasteInto(editor: Element, data: Record<string, string>) {
  const event = createEvent.paste(editor, {
    clipboardData: { getData: (type: string) => data[type] ?? '' },
  });
  fireEvent(editor, event);
  return event.defaultPrevented;
}

describe('<TrEditor />', () => {
  beforeEach(() => {
    execCommand.mockReset();
    queryCommandValue.mockReset().mockReturnValue('p');
    Object.assign(document, { execCommand, queryCommandValue });
    Range.prototype.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 50, y: 100, width: 40, height: 20 });
  });

  it('forwards input without a trailing <br></p>', () => {
    const onChange = onChangeMock();
    render(<TrEditor id="bio" onChange={onChange} text="" />);
    const editor = screen.getByRole('textbox');

    typeInto(editor, '<p>Hello<br></p>');
    expect(onChange).toHaveBeenLastCalledWith('<p>Hello</p>');
    typeInto(editor, '<p>Hello<br>there</p>');
    expect(onChange).toHaveBeenLastCalledWith('<p>Hello<br>there</p>');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('wraps bare text typed into the editor in a paragraph', () => {
    render(<TrEditor id="bio" onChange={onChangeMock()} text="" />);

    typeInto(screen.getByRole('textbox'), 'Hello');

    expect(execCommand).toHaveBeenCalledExactlyOnceWith(
      'formatBlock',
      false,
      'p',
    );
  });

  it('handles Command+Enter and Ctrl+Enter as submit shortcuts', () => {
    const onSubmitShortcut = vi.fn();
    render(
      <TrEditor
        id="editor"
        text="Fictional message"
        onChange={onChangeMock()}
        onSubmitShortcut={onSubmitShortcut}
      />,
    );
    const editor = screen.getByRole('textbox');

    for (const keys of [
      { key: 'Enter' },
      { key: 'm', ctrlKey: true },
      { key: 'Enter', metaKey: true, isComposing: true },
      { key: 'Enter', metaKey: true, shiftKey: true },
      { key: 'Enter', ctrlKey: true, altKey: true },
    ]) {
      expect(fireEvent.keyDown(editor, keys)).toBe(true);
    }
    expect(
      fireEvent.keyDown(editor, { key: 'Enter', metaKey: true, repeat: true }),
    ).toBe(false);
    expect(onSubmitShortcut).not.toHaveBeenCalled();

    expect(fireEvent.keyDown(editor, { key: 'Enter', metaKey: true })).toBe(
      false,
    );
    expect(fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true })).toBe(
      false,
    );
    expect(onSubmitShortcut).toHaveBeenCalledTimes(2);
    expect(onSubmitShortcut.mock.calls[0][0]).toBeInstanceOf(KeyboardEvent);
  });

  it('leaves Enter combinations alone when there is no submit callback', () => {
    render(<TrEditor id="editor" text="" onChange={onChangeMock()} />);

    expect(
      fireEvent.keyDown(screen.getByRole('textbox'), {
        key: 'Enter',
        metaKey: true,
      }),
    ).toBe(true);
  });

  it('uses the latest callbacks and placeholder', () => {
    const first = { onChange: onChangeMock(), onSubmitShortcut: vi.fn() };
    const latest = { onChange: onChangeMock(), onSubmitShortcut: vi.fn() };
    const { rerender } = render(<TrEditor id="bio" text="" {...first} />);
    const editor = screen.getByRole('textbox');
    expect(editor).toHaveAttribute('data-placeholder', 'Type your text');

    rerender(
      <TrEditor
        id="bio"
        text=""
        placeholder="Write a careful reply"
        {...latest}
      />,
    );
    typeInto(editor, '<p>Edited text</p>');
    fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true });

    expect(first.onChange).not.toHaveBeenCalled();
    expect(first.onSubmitShortcut).not.toHaveBeenCalled();
    expect(latest.onChange).toHaveBeenCalledWith('<p>Edited text</p>');
    expect(latest.onSubmitShortcut).toHaveBeenCalledTimes(1);
    expect(editor).toHaveAttribute('data-placeholder', 'Write a careful reply');
  });

  it('applies the formatting policy to initial and externally replaced content', () => {
    const onChange = onChangeMock();
    const { rerender } = render(
      <TrEditor
        id="formatted-editor"
        text={'<p onclick="alert(1)">Initial<img src="/missing"></p>'}
        onChange={onChange}
      />,
    );
    const editor = screen.getByRole('textbox');
    expect(editor.innerHTML).toBe('<p>Initial</p>');
    rerender(
      <TrEditor
        id="formatted-editor"
        text={'<p><b>Replacement</b><a href="javascript:alert(1)">Link</a></p>'}
        onChange={onChange}
      />,
    );
    expect(editor.innerHTML).toBe('<p><b>Replacement</b><a>Link</a></p>');
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    ['', ''],
    ['initial', ''],
    ['initial', 'initial'],
    ['initial', '<p>Replacement note</p>'],
  ] as Array<[string, string]>)(
    'applies external text after typing (%o → %o)',
    (initial, replacement) => {
      const onChange = onChangeMock();
      const { rerender } = render(
        <TrEditor id="editor" text={initial} onChange={onChange} />,
      );
      const editor = screen.getByRole('textbox');
      const typedText = '<p>Fictional note</p>';

      typeInto(editor, typedText);
      expect(onChange).toHaveBeenLastCalledWith(typedText);
      editor.innerHTML = '<p>Fictional note, still typing</p>';
      rerender(<TrEditor id="editor" text={typedText} onChange={onChange} />);
      // Its own input echoed back must not reset the editor.
      expect(editor.innerHTML).toBe('<p>Fictional note, still typing</p>');

      rerender(<TrEditor id="editor" text={replacement} onChange={onChange} />);
      expect(editor.innerHTML).toBe(replacement);
      expect(onChange).toHaveBeenCalledTimes(1);

      typeInto(editor, '<p>Another fictional note</p>');
      rerender(
        <TrEditor
          id="editor"
          text="<p>Another fictional note</p>"
          onChange={onChange}
        />,
      );
      rerender(<TrEditor id="editor" text="" onChange={onChange} />);
      expect(editor).toBeEmptyDOMElement();
      expect(onChange).toHaveBeenCalledTimes(2);
    },
  );

  it('offers formatting tools above highlighted text, without a link tool', () => {
    render(
      <>
        <TrEditor
          id="editor"
          text="<p>Fictional note</p>"
          onChange={onChangeMock()}
        />
        <p>Elsewhere</p>
      </>,
    );
    const editor = screen.getByRole('textbox');
    expect(screen.queryByRole('toolbar')).toBeNull();

    select(editor.querySelector('p')!, 0);
    expect(screen.queryByRole('toolbar')).toBeNull();
    select(screen.getByText('Elsewhere'), 1);
    expect(screen.queryByRole('toolbar')).toBeNull();
    select(editor.querySelector('p')!, 1);
    const toolbar = screen.getByRole('toolbar', { name: 'Formatting' });
    expect(toolbar).toHaveStyle({ top: '92px', left: '70px' });
    const buttons = Array.from(toolbar.querySelectorAll('button'));
    expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual([
      'Bold',
      'Italic',
      'Underline',
      'Quote',
      'List',
    ]);

    // Pressing a tool keeps the selection in the editor.
    expect(fireEvent.mouseDown(buttons[0])).toBe(false);
    for (const button of buttons) fireEvent.click(button);
    expect(execCommand.mock.calls).toEqual([
      ['bold'],
      ['italic'],
      ['underline'],
      ['formatBlock', false, 'blockquote'],
      ['insertUnorderedList'],
    ]);

    queryCommandValue.mockReturnValue('blockquote');
    fireEvent.click(buttons[3]);
    expect(queryCommandValue).toHaveBeenCalledWith('formatBlock');
    expect(execCommand).toHaveBeenLastCalledWith('formatBlock', false, 'p');

    select(editor.querySelector('p')!, 0);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('shows the placeholder only while the editor has no text', () => {
    const { rerender } = render(
      <TrEditor
        id="editor"
        text="<p>Fictional note</p>"
        onChange={onChangeMock()}
      />,
    );
    const editor = screen.getByRole('textbox');
    const placeholderShown = () =>
      editor.className.includes('tw:before:content-[attr(data-placeholder)]');
    expect(placeholderShown()).toBe(false);

    typeInto(editor, '<p><br></p>');
    expect(placeholderShown()).toBe(true);
    typeInto(editor, '<p>Typed</p>');
    expect(placeholderShown()).toBe(false);
    rerender(<TrEditor id="editor" text="" onChange={onChangeMock()} />);
    expect(placeholderShown()).toBe(true);
  });

  it('moves lists out of the paragraph they replaced and keeps the selection', () => {
    const onChange = onChangeMock();
    render(<TrEditor id="editor" text="" onChange={onChange} />);
    const editor = screen.getByRole('textbox');
    // Browsers build this nesting; the HTML parser would not.
    editor.innerHTML = '<ul><li>First</li><li>Second</li></ul><p>After</p>';
    const paragraph = document.createElement('p');
    editor.prepend(paragraph);
    paragraph.append(editor.querySelector('ul')!);
    const [first, second] = Array.from(editor.querySelectorAll('li'));
    document
      .getSelection()!
      .setBaseAndExtent(first.firstChild!, 1, second.firstChild!, 2);

    fireEvent.input(editor);

    const html = '<ul><li>First</li><li>Second</li></ul><p>After</p>';
    expect(editor.innerHTML).toBe(html);
    expect(onChange).toHaveBeenCalledWith(html);
    expect(String(document.getSelection())).toBe('irstSe');
  });

  it('applies the formatting policy to pasted HTML and leaves plain text alone', () => {
    render(<TrEditor id="editor" text="" onChange={onChangeMock()} />);
    const editor = screen.getByRole('textbox');

    expect(pasteInto(editor, { 'text/plain': 'Plain note' })).toBe(false);
    expect(execCommand).not.toHaveBeenCalled();
    expect(
      pasteInto(editor, {
        'text/html': '<div style="color:red"><b>Pasted</b> note</div>',
      }),
    ).toBe(true);
    expect(execCommand).toHaveBeenCalledExactlyOnceWith(
      'insertHTML',
      false,
      '<b>Pasted</b> note',
    );
  });

  it('preserves message line breaks from editor input and plain-text paste', () => {
    const onChange = onChangeMock();
    render(
      <TrEditor id="message" text="" onChange={onChange} messageFormatting />,
    );
    const editor = screen.getByRole('textbox');
    const markup = '<p>First<br></p><p><br></p><p>Second<br>Third</p>';

    typeInto(editor, markup);
    expect(onChange).toHaveBeenLastCalledWith(markup);
    expect(pasteInto(editor, {})).toBe(false);
    expect(execCommand).not.toHaveBeenCalled();
    expect(
      pasteInto(editor, { 'text/plain': 'First\r\n\r\nSecond\rThird' }),
    ).toBe(true);
    expect(execCommand).toHaveBeenCalledExactlyOnceWith(
      'insertText',
      false,
      'First\n\nSecond\nThird',
    );
  });
});
