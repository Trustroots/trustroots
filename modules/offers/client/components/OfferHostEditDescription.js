import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Editor from 'react-medium-editor';
import classnames from 'classnames';

// Default options for Medium-Editor directive used site wide
// @link https://github.com/yabwe/medium-editor/blob/master/OPTIONS.md
const editorOptions = {
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

export default function OfferHostEditDescription({
  status,
  description,
  noOfferDescription,
  onChangeDescription,
  onChangeNoOfferDescription,
}) {
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);

  return (
    <>
      {status === 'no' && (
        <div className="panel panel-default">
          <div className="panel-heading">
            <h4 id="noOfferDescriptionLabel">
              Tell others why you cannot host...
            </h4>
          </div>
          <div className="panel-body">
            <Editor
              className={classnames(
                'offer-nodescription',
                {
                  'is-not-empty': noOfferDescription.length,
                },
                'tr-editor',
              )}
              aria-labelledby="noOfferDescriptionLabel"
              aria-required={false}
              text={noOfferDescription}
              onChange={onChangeNoOfferDescription}
              options={editorOptions}
              data-placeholder="Write here..."
            />
          </div>
        </div>
      )}

      <div
        className={classnames(
          'panel',
          'panel-default',
          status === 'no' && !isDescriptionFocused && 'panel-disabled',
        )}
      >
        <div className="panel-heading">
          <h4 id="offerDescriptionLabel">
            Tell about your home and hosting possibilities
            {status !== 'no' && <i> (required)</i>}
          </h4>
        </div>
        {/* TODO migrate ng-hide */}
        <div className="panel-body">
          <Editor
            aria-labelledby="offerDescriptionLabel"
            className={classnames(
              'offer-description',
              {
                'is-not-empty': description.length > 0,
              },
              'tr-editor',
            )}
            text={description}
            onChange={onChangeDescription}
            aria-required={status !== 'no'}
            onFocus={() => setIsDescriptionFocused(true)}
            onBlur={() => setIsDescriptionFocused(false)}
            ng-hide="!offerHostEdit.offer"
            options={editorOptions}
            data-placeholder="Write here..."
          />
        </div>
        {description && status === 'no' && (
          <div
            id="noOfferDescriptionDescription"
            className="panel-footer panel-disabled-highlighted"
          >
            <span className="icon-info icon-lg"></span>
            This description won&apos;t be public until you can host again.
          </div>
        )}
      </div>
    </>
  );
}

OfferHostEditDescription.propTypes = {
  status: PropTypes.oneOf(['yes', 'maybe', 'no']).isRequired,
  description: PropTypes.string.isRequired,
  noOfferDescription: PropTypes.string.isRequired,
  onChangeDescription: PropTypes.func.isRequired,
  onChangeNoOfferDescription: PropTypes.func.isRequired,
};
