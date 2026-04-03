import type { Root, Link } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';
import path from 'node:path';

/**
 * Remark plugin that rewrites relative .md links to absolute /docs/ routes.
 *
 * - `concepts.md` in `getting-started/quickstart.md` → `/docs/getting-started/concepts`
 * - `../guides/context/index.md` → `/docs/guides/context`
 * - External URLs and anchor-only links are left unchanged.
 * - Anchors on .md links are preserved: `file.md#section` → `/docs/path/file#section`
 */
export default function remarkRewriteLinks() {
  return function (tree: Root, file: VFile) {
    // file.path is an absolute filesystem path like:
    // /home/user/project/docs-source/getting-started/quickstart.md
    // We need the directory relative to docs-source for resolving links.
    const absolutePath = file.history[0] ?? file.path ?? '';
    const docsSourceMarker = path.sep + 'docs-source' + path.sep;
    const markerIdx = absolutePath.indexOf(docsSourceMarker);

    // Extract relative file path within docs-source (e.g. "getting-started/quickstart.md")
    const relativePath =
      markerIdx !== -1
        ? absolutePath.slice(markerIdx + docsSourceMarker.length)
        : absolutePath;

    // Use posix paths for URL construction
    const posixRelative = relativePath.split(path.sep).join('/');
    const fileDir = posixPath.dirname(posixRelative);

    visit(tree, 'link', (node: Link) => {
      const url = node.url;

      // Skip external URLs
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return;
      }

      // Skip anchor-only links
      if (url.startsWith('#')) {
        return;
      }

      // Extract the path part (before any anchor)
      const hashIdx = url.indexOf('#');
      const pathPart = hashIdx !== -1 ? url.slice(0, hashIdx) : url;
      const anchor = hashIdx !== -1 ? url.slice(hashIdx) : '';

      // Skip non-.md links (images, PDFs, etc.)
      if (!pathPart.endsWith('.md')) {
        return;
      }

      // Resolve the relative path against the current file's directory
      const resolved = posixPath.normalize(posixPath.join(fileDir, pathPart));

      // Remove .md extension
      let route = resolved.replace(/\.md$/, '');

      // Strip /index suffix (index.md maps to directory path)
      route = route.replace(/\/index$/, '');

      // Handle root index case
      if (route === 'index' || route === '.') {
        route = '';
      }

      // Build the final absolute route
      node.url = '/' + route + anchor;
    });
  };
}

// Convenience alias for path.posix
const posixPath = path.posix;
