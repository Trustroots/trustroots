import { useTranslation } from 'react-i18next';
import MediumEditor from 'medium-editor';
import PropTypes from 'prop-types';
import React, { useEffect, useRef } from 'react';
import 'medium-editor/dist/css/medium-editor.css';

class MediumEditorBridge extends React.Component {
  constructor(props) {
    super(props);
    this.editorRef = React.createRef();
    this.state = { text: props.text };
  }

  componentDidMount() {
    this.medium = new MediumEditor(this.editorRef.current, this.props.options);
    this.medium.subscribe('editableInput', this.handleInput);
  }

  componentDidUpdate() {
    this.medium.restoreSelection();
  }

  componentWillUnmount() {
    this.medium.destroy();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.text !== this.state.text && !this.updatedByEditor) {
      this.setState({ text: nextProps.text });
    }

    this.updatedByEditor = false;
  }

  handleInput = () => {
    this.updatedByEditor = true;
    this.props.onChange(this.editorRef.current.innerHTML, this.medium);
  };

  render() {
    if (this.medium) {
      this.medium.saveSelection();
    }

    return (
      <div
        className={this.props.className}
        dangerouslySetInnerHTML={{ __html: this.state.text }}
        id={this.props.id}
        ref={this.editorRef}
      />
    );
  }
}

MediumEditorBridge.propTypes = {
  className: PropTypes.string.isRequired,
  id: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.object.isRequired,
  text: PropTypes.string.isRequired,
};

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
  const ref = useRef();
  const { t } = useTranslation('core');

  useEffect(() => {
    const { medium } = ref.current;
    const onEnter = event => event.ctrlKey && onCtrlEnter(event);
    medium.subscribe('editableKeydownEnter', onEnter);
    return () => {
      // the onCtrlEnter that gets passed through will change quite a lot as it
      // probably gets redefined over and over with different bound state
      // this means it'll actually subscribe/unsubscribe per keypress...
      // seems a bit much, but that's how these react hooks work!
      medium.unsubscribe('editableKeydownEnter', onEnter);
    };
  }, [onCtrlEnter]);

  const options = {
    // https://github.com/yabwe/medium-editor#placeholder-options
    placeholder: {
      hideOnClick: true,
      text: placeholder ? placeholder : t('Type your text'),
    },
    ...baseOptions,
  };

  const editorProps = { id, text, options, className: 'tr-editor' };
  return (
    <MediumEditorBridge
      ref={ref}
      onChange={value => onChange(removeTrailingBr(value))}
      {...editorProps}
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
