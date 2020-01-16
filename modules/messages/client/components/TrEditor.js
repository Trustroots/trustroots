import React from 'react';
import MediumEditor from 'react-medium-editor';
import 'medium-editor/dist/css/medium-editor.css';

const options = {
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
      'class', 'style', 'dir', 'id', 'title', 'target', 'tabindex',
      'onclick', 'oncontextmenu', 'ondblclick', 'onmousedown', 'onmouseenter',
      'onmouseleave', 'onmousemove', 'onmouseover', 'onmouseout', 'onmouseup',
      'onwheel', 'onmousewheel', 'onmessage', 'ontouchstart', 'ontouchmove',
      'ontouchend', 'ontouchcancel', 'onload', 'onscroll',
    ],
    // list of element tag names to remove during
    // paste when `cleanPastedHTML` is `true`
    cleanTags: [
      'link', 'iframe', 'frameset', 'noframes', 'object', 'video', 'audio',
      'track', 'source', 'base', 'basefont', 'applet', 'param', 'embed',
      'script', 'meta', 'head', 'title', 'svg', 'script', 'style',
      'input', 'textarea', 'form', 'hr', 'select', 'optgroup', 'label',
      'img', 'canvas', 'area', 'map', 'figure', 'picture', 'figcaption',
      'noscript',
    ],
    //  list of element tag names to unwrap (remove the element tag but retain
    // its child elements) during paste when `cleanPastedHTML` is `true`
    unwrapTags: [
      '!DOCTYPE', 'html', 'body', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'th', 'tr', 'td', 'tbody', 'thead', 'tfoot', 'article',
      'header', 'footer', 'section', 'aside', 'font', 'center', 'big',
      'code', 'pre', 'small', 'button', 'label', 'fieldset', 'legend',
      'datalist', 'keygen', 'output', 'nav', 'main', 'div', 'span',
    ],
  },
  // Toolbar buttons which appear when highlighting text
  toolbar: {
    buttons: [{
      name: 'bold',
      contentDefault: '<span class="icon-bold"></span>',
    }, {
      name: 'italic',
      contentDefault: '<span class="icon-italic"></span>',
    }, {
      name: 'underline',
      contentDefault: '<span class="icon-underline"></span>',
    }, {
      name: 'anchor',
      contentDefault: '<span class="icon-link"></span>',
    }, {
      name: 'quote',
      contentDefault: '<span class="icon-quote"></span>',
    }, {
      name: 'unorderedlist',
      contentDefault: '<span class="icon-list"></span>',
    }],
  },
};

export default function TrEditor(props) {
  return (
    <MediumEditor
      className="tr-editor"
      options={options}
      {...props}
    />
  );
}
