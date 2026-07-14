import { useTranslation } from 'react-i18next';
import MediumEditor from 'react-medium-editor';
import PropTypes from 'prop-types';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import 'medium-editor/dist/css/medium-editor.css';

const baseOptions = {
  disableReturn: false,
  disableDoubleReturn: false,
  disableExtraSpaces: false,
  // Automatically turns URLs entered into
  // the text field into HTML anchor tags
  autoLink: false,
  paste: {
    // Forces pasting as plain text
    forcePlainText: false,
    // Cleans pasted content from different sources, like google docs etc
    cleanPastedHTML: true,
    // List of element attributes to remove during
    // paste when `cleanPastedHTML` is `true`
    cleanAttrs: [
      'class',
      'style',
      'dir',
      'id',
      'title',
      'target',
      'tabindex',
      'onclick',
      'oncontextmenu',
      'ondblclick',
      'onmousedown',
      'onmouseenter',
      'onmouseleave',
      'onmousemove',
      'onmouseover',
      'onmouseout',
      'onmouseup',
      'onwheel',
      'onmousewheel',
      'onmessage',
      'ontouchstart',
      'ontouchmove',
      'ontouchend',
      'ontouchcancel',
      'onload',
      'onscroll',
    ],
    // list of element tag names to remove during
    // paste when `cleanPastedHTML` is `true`
    cleanTags: [
      'link',
      'iframe',
      'frameset',
      'noframes',
      'object',
      'video',
      'audio',
      'track',
      'source',
      'base',
      'basefont',
      'applet',
      'param',
      'embed',
      'script',
      'meta',
      'head',
      'title',
      'svg',
      'script',
      'style',
      'input',
      'textarea',
      'form',
      'hr',
      'select',
      'optgroup',
      'label',
      'img',
      'canvas',
      'area',
      'map',
      'figure',
      'picture',
      'figcaption',
      'noscript',
    ],
    //  list of element tag names to unwrap (remove the element tag but retain
    // its child elements) during paste when `cleanPastedHTML` is `true`
    unwrapTags: [
      '!DOCTYPE',
      'html',
      'body',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'table',
      'th',
      'tr',
      'td',
      'tbody',
      'thead',
      'tfoot',
      'article',
      'header',
      'footer',
      'section',
      'aside',
      'font',
      'center',
      'big',
      'code',
      'pre',
      'small',
      'button',
      'label',
      'fieldset',
      'legend',
      'datalist',
      'keygen',
      'output',
      'nav',
      'main',
      'div',
      'span',
    ],
  },
  // Toolbar buttons which appear when highlighting text
  toolbar: {
    buttons: [
      {
        name: 'bold',
        contentDefault: '<span class="icon-bold"></span>',
      },
      {
        name: 'italic',
        contentDefault: '<span class="icon-italic"></span>',
      },
      {
        name: 'underline',
        contentDefault: '<span class="icon-underline"></span>',
      },
      {
        name: 'anchor',
        contentDefault: '<span class="icon-link"></span>',
      },
      {
        name: 'quote',
        contentDefault: '<span class="icon-quote"></span>',
      },
      {
        name: 'unorderedlist',
        contentDefault: '<span class="icon-list"></span>',
      },
    ],
  },
};

// react-medium-editor restores its selection every time it renders. Keeping the
// editor out of React's update path while the member is typing prevents that
// restoration from moving a caret in multi-line text or interrupting a native
// input composition (for example, a dead key or compose key sequence).
const StableMediumEditor = React.memo(MediumEditor);

// medium-editor can give us a <br> at the end that we don't want
function removeTrailingBr(value) {
  return value.replace(/<br><\/p>$/, '</p>');
}

export default function TrEditor({
  id,
  onChange,
  onCtrlEnter,
  placeholder,
  text,
}) {
  const ref = useRef(null);
  const onChangeRef = useRef(onChange);
  const onCtrlEnterRef = useRef(onCtrlEnter);
  const latestEditorText = useRef(text);
  const [editorText, setEditorText] = useState(text);
  const { t } = useTranslation('core');

  onChangeRef.current = onChange;
  onCtrlEnterRef.current = onCtrlEnter;

  useEffect(() => {
    // Input emitted by MediumEditor has already changed its own DOM. Passing
    // that same text back into react-medium-editor makes it save and restore
    // the selection, which corrupts multi-line cursor positions and IME input.
    if (text !== latestEditorText.current) {
      latestEditorText.current = text;
      setEditorText(text);
    }
  }, [text]);

  useEffect(() => {
    const { medium } = ref.current;
    const onEnter = event => event.ctrlKey && onCtrlEnterRef.current(event);
    medium.subscribe('editableKeydownEnter', onEnter);
    return () => {
      medium.unsubscribe('editableKeydownEnter', onEnter);
    };
  }, []);

  const options = useMemo(
    () => ({
      // https://github.com/yabwe/medium-editor#placeholder-options
      placeholder: {
        hideOnClick: true,
        text: placeholder ? placeholder : t('Type your text'),
      },
      ...baseOptions,
    }),
    [placeholder, t],
  );

  const handleChange = useCallback(value => {
    const normalisedValue = removeTrailingBr(value);
    latestEditorText.current = normalisedValue;
    onChangeRef.current(normalisedValue);
  }, []);

  return (
    <StableMediumEditor
      ref={ref}
      id={id}
      text={editorText}
      options={options}
      className="tr-editor"
      onChange={handleChange}
    />
  );
}

TrEditor.defaultProps = {
  onCtrlEnter: () => {},
};

TrEditor.propTypes = {
  id: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onCtrlEnter: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  text: PropTypes.string.isRequired,
};
