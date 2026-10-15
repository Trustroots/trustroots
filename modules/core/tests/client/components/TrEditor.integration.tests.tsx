import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import TrEditor from '@/modules/core/client/components/TrEditor';

type TrEditorProps = React.ComponentProps<typeof TrEditor>;

describe('<TrEditor /> with MediumEditor', () => {
  it('offers formatting without a link tool or clickable link preview', () => {
    const content = '<p><a href="https://example.org/">Fictional notes</a></p>';
    const { container } = render(
      <TrEditor id="editor" text={content} onChange={jest.fn()} />,
    );
    expect(document.querySelector('[data-action="createLink"]')).toBeNull();
    expect(document.querySelector('.medium-editor-anchor-preview')).toBeNull();
    expect(document.querySelector('[data-action="bold"]')).toBeInTheDocument();
    expect(container.querySelector('.tr-editor')?.innerHTML).toBe(content);
  });
  it('applies the formatting policy to initial and externally replaced content', () => {
    const onChange = jest.fn();
    const { container, rerender } = render(
      <TrEditor
        id="formatted-editor"
        text={'<p onclick="alert(1)">Initial<img src="/missing"></p>'}
        onChange={onChange}
      />,
    );
    const editor = container.querySelector('.tr-editor')!;
    expect(editor.innerHTML).toBe('<p>Initial</p>');
    rerender(
      <TrEditor
        id="formatted-editor"
        text={'<p><b>Replacement</b><a href="javascript:alert(1)">Link</a></p>'}
        onChange={onChange}
      />,
    );
    expect(editor.querySelector('b')).toHaveTextContent('Replacement');
    expect(editor.querySelector('a')).not.toHaveAttribute('href');
    expect(onChange).not.toHaveBeenCalled();
  });
  it.each([
    ['', ''],
    ['initial', ''],
    ['initial', 'initial'],
    ['initial', '<p>Replacement note</p>'],
  ] as Array<[string, string]>)(
    'applies external text after typing (%p → %p)',
    (initial, replacement) => {
      const onChange: jest.MockedFunction<TrEditorProps['onChange']> =
        jest.fn();
      const { container, rerender } = render(
        <TrEditor id="editor" text={initial} onChange={onChange} />,
      );
      const editor = container.querySelector('.tr-editor')!;
      const typedText = '<p>Fictional note</p>';

      editor.innerHTML = typedText;
      fireEvent.input(editor);
      expect(onChange).toHaveBeenLastCalledWith(typedText);
      rerender(<TrEditor id="editor" text={typedText} onChange={onChange} />);
      expect(editor.innerHTML).toBe(typedText);

      rerender(<TrEditor id="editor" text={replacement} onChange={onChange} />);
      expect(editor.innerHTML).toBe(replacement);
      expect(onChange).toHaveBeenCalledTimes(1);

      // Input and further external updates must still work after the reset.
      const nextOnChange: jest.MockedFunction<TrEditorProps['onChange']> =
        jest.fn();
      rerender(
        <TrEditor id="editor" text={replacement} onChange={nextOnChange} />,
      );
      editor.innerHTML = '<p>Another fictional note</p>';
      fireEvent.input(editor);
      expect(nextOnChange).toHaveBeenCalledWith(
        '<p>Another fictional note</p>',
      );
      rerender(
        <TrEditor
          id="editor"
          text="<p>Another fictional note</p>"
          onChange={nextOnChange}
        />,
      );
      rerender(<TrEditor id="editor" text="" onChange={nextOnChange} />);
      expect(editor).toBeEmptyDOMElement();
      expect(nextOnChange).toHaveBeenCalledTimes(1);
    },
  );
});
