import * as he from 'he';
import {
  defaultTreeAdapter as tree,
  html,
  parseFragment,
  serialize,
  type DefaultTreeAdapterTypes as Nodes,
} from 'parse5';
import sanitizeHtml, { type SanitizeOptions } from 'sanitize-html';
import {
  messageLineBlockTags,
  messageRichTextTags,
  normaliseMessageSourceNewlines,
} from '../../shared/rich-text-policy.mts';
import { linkText, sanitizeOptions } from './text.server.service.mts';

function tagName(node: Nodes.ChildNode | undefined): string | undefined {
  return node && tree.isElementNode(node) ? node.tagName : undefined;
}

function isLineBlock(node: Nodes.Element): boolean {
  return messageLineBlockTags.has(node.tagName);
}

function isBreak(node: Nodes.ChildNode): boolean {
  return tagName(node) === 'br';
}

function hasLineBoundary(node: Nodes.ChildNode): boolean {
  return (
    tree.isElementNode(node) &&
    (isBreak(node) ||
      isLineBlock(node) ||
      node.childNodes.some(hasLineBoundary))
  );
}

function isBlank(node: Nodes.ChildNode): boolean {
  return tree.isTextNode(node)
    ? !node.value.trim()
    : tree.isElementNode(node) && node.childNodes.every(isBlank);
}

function createBreak() {
  // Stryker disable next-line ArrayDeclaration: the final sanitizer drops attributes added by the mutation
  return tree.createElement('br', html.NS.HTML, []);
}

function normaliseLines(parent: Nodes.ParentNode): void {
  const children = [...parent.childNodes];
  for (const [index, node] of children.entries()) {
    if (tree.isTextNode(node) && node.value.includes('\n')) {
      const content = normaliseMessageSourceNewlines(
        node.value,
        tagName(children[index - 1]),
        tagName(children[index + 1]),
      );
      for (const [lineIndex, line] of content.split('\n').entries()) {
        if (lineIndex > 0) {
          tree.insertBefore(parent, createBreak(), node);
        }
        // Stryker disable next-line ConditionalExpression: an empty text node has no serialized output
        if (line) tree.insertBefore(parent, tree.createTextNode(line), node);
      }
      tree.detachNode(node);
    } else if (tree.isElementNode(node)) {
      normaliseLines(node);
      if (
        (node.tagName === 'p' || node.tagName === 'div') &&
        !node.childNodes.some(hasLineBoundary) &&
        node.childNodes.every(isBlank)
      ) {
        tree.appendChild(node, createBreak());
      }
    }
  }
}

function trimEmptyLines(root: Nodes.ParentNode, fromEnd: boolean): void {
  const nodes = [...root.childNodes];
  if (fromEnd) nodes.reverse();
  const contentIndex = nodes.findIndex(node => !isBlank(node));
  const empty = contentIndex === -1 ? nodes : nodes.slice(0, contentIndex);
  const removeWhitespace = contentIndex === -1 || empty.some(isBreak);
  for (const node of empty) {
    if (removeWhitespace || !tree.isTextNode(node)) tree.detachNode(node);
  }
  const content = nodes[contentIndex];
  if (content && tree.isElementNode(content)) trimEmptyLines(content, fromEnd);
}

/** Sanitize current and stored message HTML without re-linking existing text. */
export function sanitiseMessageHtml(
  content: string,
  options: SanitizeOptions = sanitizeOptions,
): string {
  const rules = { ...options, allowedTags: messageRichTextTags };
  const fragment = parseFragment(sanitizeHtml(content.trim(), rules));
  normaliseLines(fragment);
  trimEmptyLines(fragment, false);
  trimEmptyLines(fragment, true);
  // Keep the existing API serialization for void tags such as <br />.
  return sanitizeHtml(serialize(fragment), rules);
}

/** Apply the same formatting to drafts and new messages. */
export function formatMessage(content: string): string {
  return sanitiseMessageHtml(linkText(content.replace(/&nbsp;/g, ' ')));
}

function plainLines(
  nodes: Nodes.ChildNode[],
  includeLinkDestinations: boolean,
  endsAtBlockBoundary = false,
): string {
  const sections: string[] = [];
  let inline = '';
  for (const node of nodes) {
    if (tree.isTextNode(node)) {
      inline += node.value.replaceAll('\u00a0', ' ');
    } else if (tree.isElementNode(node)) {
      if (isBreak(node)) {
        inline += '\n';
      } else if (isLineBlock(node)) {
        if (inline.trim() || inline.includes('\n')) {
          sections.push(inline.replace(/\n$/, ''));
        }
        inline = '';
        const content = plainLines(
          node.childNodes,
          includeLinkDestinations,
          true,
        );
        sections.push(
          includeLinkDestinations && node.tagName === 'li'
            ? `* ${content}`
            : content,
        );
      } else {
        const label = plainLines(node.childNodes, includeLinkDestinations);
        inline += label;
        if (includeLinkDestinations && node.tagName === 'a') {
          const href = node.attrs.find(attr => attr.name === 'href')?.value;
          if (href && href !== label) inline += label ? ` ${href}` : href;
        }
      }
    }
  }
  if (!sections.length || inline.trim() || inline.includes('\n')) {
    // A block boundary already ends the line occupied by its final break.
    sections.push(endsAtBlockBoundary ? inline.replace(/\n$/, '') : inline);
  }
  return sections.join('\n');
}

/** Produce line-preserving text from sanitised message HTML. */
export function messagePlainText(
  content: string,
  includeLinkDestinations = false,
): string {
  return plainLines(parseFragment(content).childNodes, includeLinkDestinations)
    .replace(/[ \t\f]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

/** Inbox excerpts are rendered as text by the clients. */
export function messageExcerpt(content: string): string {
  return he
    .decode(messagePlainText(sanitiseMessageHtml(content)))
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}
