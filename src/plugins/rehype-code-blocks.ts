import type { Root, Element } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * Rehype plugin that wraps <pre><code> blocks with a window chrome
 * header (three dots + language label) and adds accessibility attributes.
 *
 * Runs after Shiki, which adds `data-language` to <pre> elements.
 */
const rehypeCodeBlocks: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (
        node.tagName !== 'pre' ||
        !parent ||
        typeof index !== 'number'
      ) {
        return;
      }

      // Skip if already wrapped (avoid double-wrapping)
      if (
        parent.type === 'element' &&
        (parent as Element).tagName === 'div' &&
        Array.isArray((parent as Element).properties?.className) &&
        ((parent as Element).properties.className as string[]).includes('code-block')
      ) {
        return;
      }

      // Find the <code> child
      const codeChild = node.children.find(
        (child): child is Element =>
          child.type === 'element' && child.tagName === 'code'
      );
      if (!codeChild) return;

      // Extract language from multiple sources
      let lang = '';

      // Source 1: data-language on <pre> (set by Shiki)
      const dataLang = node.properties?.dataLanguage;
      if (typeof dataLang === 'string' && dataLang) {
        lang = dataLang;
      }


      // Source 2: language-* class on <code>
      if (!lang && codeChild.properties?.className) {
        const classes = Array.isArray(codeChild.properties.className)
          ? codeChild.properties.className
          : [codeChild.properties.className];
        for (const cls of classes) {
          const s = String(cls);
          if (s.startsWith('language-')) {
            lang = s.slice(9);
            break;
          }
        }
      }

      // Source 3: language-* class on <pre>
      if (!lang && node.properties?.className) {
        const classes = Array.isArray(node.properties.className)
          ? node.properties.className
          : [node.properties.className];
        for (const cls of classes) {
          const s = String(cls);
          if (s.startsWith('language-')) {
            lang = s.slice(9);
            break;
          }
        }
      }

      // Display-friendly language name (skip "plaintext")
      const langDisplay = (lang && lang !== 'plaintext') ? lang : 'code';

      // Add accessibility attributes to <pre>
      node.properties = node.properties || {};
      node.properties.tabIndex = 0;
      node.properties.role = 'region';
      node.properties['aria-label'] = `${langDisplay} code example`;

      // Build window chrome header
      const header: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-header'] },
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['code-header-dots'] },
            children: [
              { type: 'element', tagName: 'span', properties: { className: ['dot', 'dot-coral'] }, children: [] },
              { type: 'element', tagName: 'span', properties: { className: ['dot', 'dot-blue'] }, children: [] },
              { type: 'element', tagName: 'span', properties: { className: ['dot', 'dot-green'] }, children: [] },
            ],
          },
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['code-header-lang'] },
            children: [{ type: 'text', value: langDisplay }],
          },
        ],
      };

      // Clone pre node for the wrapper
      const preClone: Element = {
        type: 'element',
        tagName: node.tagName,
        properties: { ...node.properties },
        children: [...node.children],
      };

      // Build copy button with clipboard icon SVG
      const copyButton: Element = {
        type: 'element',
        tagName: 'button',
        properties: {
          className: ['code-copy-btn'],
          type: 'button',
          'aria-label': 'Copy code to clipboard',
        },
        children: [
          // Copy icon (clipboard)
          {
            type: 'element',
            tagName: 'svg',
            properties: {
              className: ['code-copy-icon'],
              width: '16',
              height: '16',
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: '2',
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              'aria-hidden': 'true',
            },
            children: [
              { type: 'element', tagName: 'rect', properties: { x: '9', y: '9', width: '13', height: '13', rx: '2', ry: '2' }, children: [] },
              { type: 'element', tagName: 'path', properties: { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' }, children: [] },
            ],
          },
          // Check icon (shown after copy)
          {
            type: 'element',
            tagName: 'svg',
            properties: {
              className: ['code-check-icon'],
              width: '16',
              height: '16',
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: '2',
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              'aria-hidden': 'true',
            },
            children: [
              { type: 'element', tagName: 'polyline', properties: { points: '20 6 9 17 4 12' }, children: [] },
            ],
          },
        ],
      };

      // Create wrapper div
      const wrapper: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-block'], 'data-language': langDisplay },
        children: [header, copyButton, preClone],
      };

      // Replace <pre> with wrapper in parent
      parent.children[index] = wrapper;
    });
  };
};

export default rehypeCodeBlocks;
