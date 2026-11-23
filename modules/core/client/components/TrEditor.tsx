import { useTranslation } from 'react-i18next';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@trustroots/ui/Button';
import { ButtonGroup } from '@trustroots/ui/ButtonGroup';
import { cn } from '@trustroots/ui/cn';
import { sanitiseRichText } from '../utils/rich-text';

function toggleQuote() {
  const quoted = document.queryCommandValue('formatBlock') === 'blockquote';
  document.execCommand('formatBlock', false, quoted ? 'p' : 'blockquote');
}

// Chromium and WebKit put new lists inside the paragraph they replace.
function unwrapListParagraphs(editable: HTMLElement) {
  const paragraphs = Array.from(
    editable.querySelectorAll(':scope > p > ul'),
    list => list.parentElement!,
  );
  if (!paragraphs.length) return;
  const selection = document.getSelection()!;
  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
  for (const paragraph of paragraphs) {
    paragraph.replaceWith(...paragraph.childNodes);
  }
  selection.setBaseAndExtent(
    anchorNode!,
    anchorOffset,
    focusNode!,
    focusOffset,
  );
}

// Browsers can leave a <br> at the end of a paragraph that we don't want
function removeTrailingBr(value: string): string {
  return value.replace(/<br><\/p>$/, '</p>');
}

type TrEditorProps = {
  id: string;
  onChange: (value: string) => void;
  onSubmitShortcut?: (event: KeyboardEvent) => void;
  placeholder?: string;
  text: string;
};
export default function TrEditor({
  id,
  onChange,
  onSubmitShortcut,
  placeholder,
  text,
}: TrEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const latestEditorText = useRef(text);
  const [initialMarkup] = useState(() => ({ __html: sanitiseRichText(text) }));
  const [empty, setEmpty] = useState(true);
  const [selection, setSelection] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const { t } = useTranslation('core');

  useLayoutEffect(() => {
    // The browser owns the editable DOM. Echoing its own input back into it
    // would disturb the caret and native input composition.
    if (text !== latestEditorText.current) {
      latestEditorText.current = text;
      ref.current!.innerHTML = sanitiseRichText(text);
    }
    setEmpty(!ref.current!.textContent);
  }, [text]);

  useEffect(() => {
    // Like the old editor, offer formatting above highlighted text.
    const onSelectionChange = () => {
      const current = document.getSelection()!;
      if (current.isCollapsed || !ref.current!.contains(current.anchorNode)) {
        setSelection(null);
        return;
      }
      const { top, left, width } = current
        .getRangeAt(0)
        .getBoundingClientRect();
      setSelection({ top: top - 8, left: left + width / 2 });
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () =>
      document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  const onInput = () => {
    const editable = ref.current!;
    // Typing into an empty editor leaves bare text; keep every line in a <p>.
    if (
      Array.from(editable.childNodes).some(
        node => node.nodeType === Node.TEXT_NODE,
      )
    ) {
      document.execCommand('formatBlock', false, 'p');
    }
    unwrapListParagraphs(editable);
    setEmpty(!editable.textContent);
    const value = removeTrailingBr(editable.innerHTML);
    latestEditorText.current = value;
    onChange(value);
  };

  const onKeyDown = ({ nativeEvent: event }: React.KeyboardEvent) => {
    if (
      !onSubmitShortcut ||
      event.key !== 'Enter' ||
      !(event.ctrlKey || event.metaKey) ||
      event.altKey ||
      event.shiftKey ||
      event.isComposing
    ) {
      return;
    }
    event.preventDefault();
    if (!event.repeat) onSubmitShortcut(event);
  };

  const onPaste = (event: React.ClipboardEvent) => {
    const html = event.clipboardData.getData('text/html');
    if (!html) return;
    event.preventDefault();
    document.execCommand('insertHTML', false, sanitiseRichText(html));
  };

  const tools: Array<[string, string, () => void]> = [
    [t('Bold'), 'icon-bold', () => document.execCommand('bold')],
    [t('Italic'), 'icon-italic', () => document.execCommand('italic')],
    [t('Underline'), 'icon-underline', () => document.execCommand('underline')],
    [t('Quote'), 'icon-quote', toggleQuote],
    [t('List'), 'icon-list', () => document.execCommand('insertUnorderedList')],
  ];

  return (
    <>
      <div
        ref={ref}
        id={id}
        role="textbox"
        aria-multiline="true"
        contentEditable
        tabIndex={0}
        className={cn(
          'tr-editor tw:relative tw:min-h-25 tw:cursor-text tw:hover:bg-brand-primary/10 tw:focus:bg-transparent tw:focus:outline-none',
          empty &&
            'tw:before:pointer-events-none tw:before:absolute tw:before:text-muted tw:before:content-[attr(data-placeholder)]',
        )}
        data-placeholder={placeholder ? placeholder : t('Type your text')}
        dangerouslySetInnerHTML={initialMarkup}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
      {selection &&
        createPortal(
          <ButtonGroup
            role="toolbar"
            aria-label={t('Formatting')}
            className="tw:fixed tw:z-1040 tw:-translate-x-1/2 tw:-translate-y-full"
            style={{ top: selection.top, left: selection.left }}
          >
            {tools.map(([label, icon, run]) => (
              <Button
                key={icon}
                intent="primary"
                aria-label={label}
                title={label}
                // Keep the selection in the editor.
                onMouseDown={event => event.preventDefault()}
                onClick={run}
              >
                <span className={icon} aria-hidden="true" />
              </Button>
            ))}
          </ButtonGroup>,
          document.body,
        )}
    </>
  );
}
