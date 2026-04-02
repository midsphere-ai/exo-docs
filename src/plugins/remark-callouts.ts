import type { Root, Blockquote, Text, Html } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * Remark plugin that converts GitHub-flavored alert blockquotes into
 * styled callout HTML with `data-callout-type` attributes.
 *
 * Supported syntax (inside a blockquote):
 *   > [!TIP] ...
 *   > [!INFO] ...
 *   > [!WARNING] ...
 *   > [!DANGER] ...
 *
 * Output: wrapper div with data-callout-type, icon SVG, label, and content.
 */

const CALLOUT_TYPES: Record<string, { label: string; icon: string }> = {
  tip: {
    label: 'Tip',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
  },
  info: {
    label: 'Info',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  },
  warning: {
    label: 'Warning',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  },
  danger: {
    label: 'Danger',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
  },
};

const CALLOUT_RE = /^\[!(TIP|INFO|WARNING|DANGER)\]\s*/i;

export default function remarkCallouts() {
  return function (tree: Root) {
    visit(tree, 'blockquote', (node: Blockquote, index, parent) => {
      if (index === undefined || !parent) return;

      // The first child of a blockquote should be a paragraph
      const firstChild = node.children[0];
      if (!firstChild || firstChild.type !== 'paragraph') return;

      // The first inline of that paragraph should be text
      const firstInline = firstChild.children[0];
      if (!firstInline || firstInline.type !== 'text') return;

      const match = firstInline.value.match(CALLOUT_RE);
      if (!match) return;

      const type = match[1].toLowerCase();
      const callout = CALLOUT_TYPES[type];
      if (!callout) return;

      // Remove the [!TYPE] marker from the text
      firstInline.value = firstInline.value.replace(CALLOUT_RE, '');

      // If the remaining text is empty and there are more inline children,
      // remove the empty text node
      if (firstInline.value === '' && firstChild.children.length > 1) {
        firstChild.children.shift();
      }

      // If the first paragraph is now completely empty, remove it
      const isFirstParaEmpty =
        firstChild.children.length === 0 ||
        (firstChild.children.length === 1 &&
          firstChild.children[0].type === 'text' &&
          (firstChild.children[0] as Text).value.trim() === '');

      // Build the opening HTML with icon and label
      const openHtml: Html = {
        type: 'html',
        value: `<div data-callout-type="${type}"><div class="callout-header">${callout.icon}<span class="callout-label">${callout.label}</span></div><div class="callout-content">`,
      };

      const closeHtml: Html = {
        type: 'html',
        value: `</div></div>`,
      };

      // Collect content children (skip the first paragraph if it's just the marker)
      const contentChildren = isFirstParaEmpty
        ? node.children.slice(1)
        : node.children;

      // Replace the blockquote with raw HTML wrapper + content + close
      const replacements = [openHtml, ...contentChildren, closeHtml];
      parent.children.splice(index, 1, ...replacements);

      // Return the index to re-visit since we changed the tree
      return index;
    });
  };
}
