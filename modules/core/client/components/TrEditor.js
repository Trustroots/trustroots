import { useTranslation } from 'react-i18next';
import MediumEditor from 'medium-editor';
import PropTypes from 'prop-types';
import React, { useEffect, useLayoutEffect, useRef } from 'react';
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
  const mediumRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onCtrlEnterRef = useRef(onCtrlEnter);
  const latestEditorText = useRef(text);
  const initialMarkup = useRef({ __html: text });
  const isApplyingExternalText = useRef(false);
  const { t } = useTranslation('core');

  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    onCtrlEnterRef.current = onCtrlEnter;
  });

  useLayoutEffect(() => {
    const medium = new MediumEditor(ref.current, {
      ...baseOptions,
      placeholder: { hideOnClick: true },
    });
    mediumRef.current = medium;
    const onInput = (event, editable) => {
      // setContent emits editableInput too; external changes are not user input.
      if (isApplyingExternalText.current) return;
      const value = removeTrailingBr(editable.innerHTML);
      latestEditorText.current = value;
      onChangeRef.current(value);
    };
    const onEnter = event => event.ctrlKey && onCtrlEnterRef.current(event);
    medium.subscribe('editableInput', onInput);
    medium.subscribe('editableKeydownEnter', onEnter);
    return () => {
      medium.unsubscribe('editableInput', onInput);
      medium.unsubscribe('editableKeydownEnter', onEnter);
      medium.destroy();
    };
  }, []);

  useEffect(() => {
    // MediumEditor owns the editable DOM. Echoing its own input back into it
    // would disturb the caret and native input composition.
    if (text !== latestEditorText.current) {
      latestEditorText.current = text;
      isApplyingExternalText.current = true;
      try {
        mediumRef.current.setContent(text);
      } finally {
        isApplyingExternalText.current = false;
      }
    }
  }, [text]);

  return (
    <div
      ref={ref}
      id={id}
      className="tr-editor"
      data-placeholder={placeholder ? placeholder : t('Type your text')}
      dangerouslySetInnerHTML={initialMarkup.current}
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
