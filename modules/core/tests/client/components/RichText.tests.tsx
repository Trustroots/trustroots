import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RichText from '../../../client/components/RichText';
import { richTextLinkSchemes } from '../../../shared/rich-text-policy.mts';

test('allows Trustroots links only when requested and sanitises their markup', () => {
  const content =
    '<a href="https://www.trustroots.org/safety" onclick="alert(1)">Safety</a><a href="https://outside.example/">External</a>';
  const { rerender } = render(<RichText content={content} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  rerender(<RichText content={content} allowTrustrootsLinks />);
  expect(screen.getByRole('link', { name: 'Safety' })).toHaveAttribute(
    'href',
    'https://www.trustroots.org/safety',
  );
  expect(screen.getByRole('link', { name: 'Safety' })).not.toHaveAttribute(
    'onclick',
  );
  expect(
    screen.queryByRole('link', { name: 'External' }),
  ).not.toBeInTheDocument();
  rerender(<RichText content={content} allowTrustrootsLinks={false} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test('allows sanitised links when explicitly requested', () => {
  render(
    <RichText
      content={
        '<a href="https://outside.example/" onclick="alert(1)">External</a><a href="javascript:alert(1)">Unsafe</a>'
      }
      allowLinks
    />,
  );
  expect(screen.getByRole('link', { name: 'External' })).toHaveAttribute(
    'href',
    'https://outside.example/',
  );
  expect(screen.getByRole('link', { name: 'External' })).not.toHaveAttribute(
    'onclick',
  );
  expect(
    screen.queryByRole('link', { name: 'Unsafe' }),
  ).not.toBeInTheDocument();
});

test('retains supported formatting and attributes on their supported elements', () => {
  const { container, rerender } = render(
    <RichText
      className="formatted"
      content={
        '<p data-hosting="yes"><b>Bold</b><i>Italic</i><em>Emphasis</em><strong>Strong</strong><u>Underlined</u><br><a href="/safety">Safety</a></p><ul><li>List</li></ul><blockquote>Quote</blockquote>'
      }
    />,
  );
  expect(container.querySelector('.formatted p')).toHaveAttribute(
    'data-hosting',
    'yes',
  );
  for (const tag of [
    'b',
    'i',
    'em',
    'strong',
    'u',
    'br',
    'ul',
    'li',
    'blockquote',
  ]) {
    expect(container.querySelector(tag)).not.toBeNull();
  }
  rerender(<RichText content="Replacement" />);
  expect(screen.getByText('Replacement')).toBeInTheDocument();
  expect(container.querySelector('p')).toBeNull();
});

test.each([
  '<p onclick="window.fixtureExecuted=true">Text<img src="/missing" onerror="window.fixtureExecuted=true"></p>',
  '<svg><g onload="window.fixtureExecuted=true"></g></svg><math><mi>x</mi></math><iframe srcdoc="text"></iframe><script>window.fixtureExecuted=true</script>',
  '<a href="java&#x09;script:window.fixtureExecuted=true" id="fixture" name="fixture">Link</a>',
  '<p href="/safety" aria-label="changed" data-unrecognised="value" style="color:red">Text</p><a data-hosting="yes" href="/safety">Link</a>',
])('normalises display markup: %s', content => {
  const { container } = render(<RichText content={content} />);
  expect(container.querySelector('img, svg, math, iframe, script')).toBeNull();
  for (const element of Array.from(container.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      expect(['href', 'data-hosting']).toContain(attribute.name);
      if (attribute.name === 'href') expect(element.tagName).toBe('A');
      if (attribute.name === 'data-hosting') expect(element.tagName).toBe('P');
    }
  }
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
});

test('displays link labels for all schemes and literal encoded text', () => {
  render(
    <RichText
      content={
        richTextLinkSchemes
          .map(scheme => `<a href="${scheme}:example">${scheme}</a>`)
          .join('') + '&lt;img src=x&gt;'
      }
    />,
  );
  for (const scheme of richTextLinkSchemes) {
    expect(
      screen.queryByRole('link', { name: scheme }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(scheme))).toBeInTheDocument();
  }
  expect(screen.getByText(/<img src=x>/)).toBeInTheDocument();
});

test('presentation unwraps all links and retains their formatted labels', () => {
  const { container, rerender } = render(
    <RichText
      content={
        '<a href="/safety">Safety</a><a href="https://example.test"><b>External</b></a><a href="mailto:member@example.test">Email</a><a href="http://[">Invalid</a><a>Missing</a><a href="">Empty</a><a href="javascript:alert(1)">Other</a>'
      }
    />,
  );
  expect(container.querySelectorAll('a')).toHaveLength(0);
  expect(container).toHaveTextContent('Safety');
  expect(screen.getByText('External').tagName).toBe('B');
  expect(container).toHaveTextContent('EmailInvalidMissingEmptyOther');
  rerender(<RichText content="" />);
  expect(container.firstChild).toBeEmptyDOMElement();
});
