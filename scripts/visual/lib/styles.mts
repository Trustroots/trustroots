// Computed-style snapshots: every element plus ::before and ::after, every
// standard property. Custom properties are left out because Tailwind adds
// its `--tw-*` variables to every element, and nothing reads them except the
// utilities themselves.
import type { Page } from '@playwright/test';

/** Element path → property → value, for one page. */
export type StyleSnapshot = Record<string, Record<string, string>>;

export interface StyleDifference {
  path: string;
  property: string;
  before: string | undefined;
  after: string | undefined;
}

export async function snapshotStyles(
  page: Page,
  root = 'body',
): Promise<StyleSnapshot> {
  return page.evaluate(rootSelector => {
    const rootElement = document.querySelector(rootSelector);
    if (!rootElement) return {};
    // A forced style and layout pass. Without it Chromium can report stale
    // `auto` margins in RTL even though the box is already positioned.
    void document.documentElement.getBoundingClientRect();
    void document.body.offsetHeight;
    const snapshot: Record<string, Record<string, string>> = {};
    const pathOf = (element: Element): string => {
      const parts: string[] = [];
      let node: Element | null = element;
      while (node && node !== rootElement.parentElement) {
        const parent: Element | null = node.parentElement;
        const index = parent ? Array.from(parent.children).indexOf(node) : 0;
        parts.unshift(`${node.tagName.toLowerCase()}:${index}`);
        node = parent;
      }
      return parts.join('>');
    };
    const read = (element: Element, pseudo: string | null) => {
      const style = getComputedStyle(element, pseudo);
      if (pseudo && (style.content === 'none' || style.content === 'normal')) {
        return null;
      }
      const values: Record<string, string> = {};
      for (let i = 0; i < style.length; i++) {
        const property = style[i];
        if (property.startsWith('--')) continue;
        values[property] = style.getPropertyValue(property);
      }
      return values;
    };
    const elements = [rootElement, ...rootElement.querySelectorAll('*')];
    for (const element of elements) {
      const path = pathOf(element);
      snapshot[path] = read(element, null)!;
      for (const pseudo of ['::before', '::after']) {
        const values = read(element, pseudo);
        if (values) snapshot[`${path}${pseudo}`] = values;
      }
    }
    return snapshot;
  }, root);
}

export function compareStyles(
  before: StyleSnapshot,
  after: StyleSnapshot,
  limit = 200,
): { count: number; differences: StyleDifference[] } {
  const differences: StyleDifference[] = [];
  let count = 0;
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const path of paths) {
    const a = before[path];
    const b = after[path];
    if (!a || !b) {
      count++;
      if (differences.length < limit) {
        differences.push({
          path,
          property: '(element)',
          before: a ? 'present' : undefined,
          after: b ? 'present' : undefined,
        });
      }
      continue;
    }
    for (const property of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[property] !== b[property]) {
        count++;
        if (differences.length < limit) {
          differences.push({
            path,
            property,
            before: a[property],
            after: b[property],
          });
        }
      }
    }
  }
  return { count, differences };
}
