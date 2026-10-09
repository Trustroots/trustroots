import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import TrEditor from '@/modules/core/client/components/TrEditor';

type TrEditorProps = React.ComponentProps<typeof TrEditor>;

describe('<TrEditor /> with MediumEditor', () => {
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
