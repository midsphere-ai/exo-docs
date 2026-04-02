import type { Root, Heading } from 'mdast';
import type { VFile } from 'vfile';

/**
 * Remark plugin that extracts the first `# heading` from the markdown AST,
 * injects it into `file.data.astro.frontmatter.title`, and removes the
 * heading node so the layout can render the title separately.
 *
 * Files that already have a frontmatter `title` are left untouched.
 */
export default function remarkExtractTitle() {
  return function (tree: Root, file: VFile) {
    // Ensure file.data.astro.frontmatter exists
    const data = file.data as Record<string, unknown>;
    if (!data.astro) {
      data.astro = { frontmatter: {} };
    }
    const astroData = data.astro as { frontmatter: Record<string, unknown> };
    if (!astroData.frontmatter) {
      astroData.frontmatter = {};
    }

    // If frontmatter already has a title, don't override
    if (astroData.frontmatter.title) {
      return;
    }

    // Find the first h1 heading in the tree
    const h1Index = tree.children.findIndex(
      (node): node is Heading => node.type === 'heading' && node.depth === 1,
    );

    if (h1Index === -1) {
      // No h1 found — title falls back to slug-based name downstream
      return;
    }

    const h1 = tree.children[h1Index] as Heading;

    // Extract text content from the heading (handles nested inline nodes)
    const title = extractText(h1);

    if (title) {
      astroData.frontmatter.title = title;
    }

    // Remove the h1 from the AST so layouts render the title separately
    tree.children.splice(h1Index, 1);
  };
}

/** Recursively extract plain text from an mdast node. */
function extractText(node: Heading): string {
  let text = '';
  for (const child of node.children) {
    if (child.type === 'text') {
      text += child.value;
    } else if ('children' in child) {
      // Handle inline elements like emphasis, strong, code, links
      text += extractText(child as unknown as Heading);
    } else if (child.type === 'inlineCode') {
      text += child.value;
    }
  }
  return text;
}
