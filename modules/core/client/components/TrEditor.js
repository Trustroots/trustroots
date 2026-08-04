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
  const editorElementRef = useRef();
  const mediumRef = useRef();
  const onChangeRef = useRef(onChange);
  const onCtrlEnterRef = useRef(onCtrlEnter);
  const updatedByEditorRef = useRef(false);
  const { t } = useTranslation('core');

  onChangeRef.current = onChange;
  onCtrlEnterRef.current = onCtrlEnter;

  const options = {
    // https://github.com/yabwe/medium-editor#placeholder-options
    placeholder: {
      hideOnClick: true,
      text: placeholder ? placeholder : t('Type your text'),
    },
    ...baseOptions,
  };
  const optionsRef = useRef(options);

  useEffect(() => {
    const medium = new MediumEditor(
      editorElementRef.current,
      optionsRef.current,
    );
    const handleInput = () => {
      updatedByEditorRef.current = true;
      onChangeRef.current(removeTrailingBr(editorElementRef.current.innerHTML));
    };
    const handleEnter = event => event.ctrlKey && onCtrlEnterRef.current(event);

    mediumRef.current = medium;
    medium.subscribe('editableInput', handleInput);
    medium.subscribe('editableKeydownEnter', handleEnter);

    return () => {
      medium.unsubscribe('editableInput', handleInput);
      medium.unsubscribe('editableKeydownEnter', handleEnter);
      medium.destroy();
      mediumRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (updatedByEditorRef.current) {
      updatedByEditorRef.current = false;
      return;
    }

    const element = editorElementRef.current;
    if (element.innerHTML === text) {
      return;
    }

    mediumRef.current?.saveSelection();
    element.innerHTML = text;
    mediumRef.current?.restoreSelection();
  }, [text]);

  return <div className="tr-editor" id={id} ref={editorElementRef} />;
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
