import type { Root, Paragraph } from 'mdast';
import type { VFile } from 'vfile';

/**
 * Remark plugin that extracts the first paragraph from the markdown AST
 * and injects it as `file.data.astro.frontmatter.description`.
 *
 * Does NOT remove the paragraph from the AST (it remains useful prose).
 * Skips files that already have a frontmatter `description`.
 * Truncates to 200 characters.
 */
export default function remarkExtractDescription() {
  return function (tree: Root, file: VFile) {
    const data = file.data as Record<string, unknown>;
    if (!data.astro) {
      data.astro = { frontmatter: {} };
    }
    const astroData = data.astro as { frontmatter: Record<string, unknown> };
    if (!astroData.frontmatter) {
      astroData.frontmatter = {};
    }

    if (astroData.frontmatter.description) {
      return;
    }

    const paragraph = tree.children.find(
      (node): node is Paragraph => node.type === 'paragraph',
    );

    if (!paragraph) return;

    let text = '';
    for (const child of paragraph.children) {
      if (child.type === 'text') {
        text += child.value;
      } else if (child.type === 'inlineCode') {
        text += child.value;
      } else if ('children' in child) {
        for (const grandchild of (child as any).children) {
          if (grandchild.type === 'text') {
            text += grandchild.value;
          } else if (grandchild.type === 'inlineCode') {
            text += grandchild.value;
          }
        }
      }
    }

    text = text.trim();
    if (text) {
      if (text.length > 200) {
        text = text.slice(0, 197) + '...';
      }
      astroData.frontmatter.description = text;
    }
  };
}
