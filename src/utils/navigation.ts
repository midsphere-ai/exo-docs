import { getCollection, render } from 'astro:content';

export interface NavItem {
  slug: string;
  title: string;
  order: number;
  href: string;
}

export interface NavSection {
  slug: string;
  label: string;
  order: number;
  items: NavItem[];
  children: NavSection[];
}

/** Predefined ordering for top-level sections */
const SECTION_ORDER: Record<string, number> = {
  'getting-started': 1,
  guides: 2,
  distributed: 3,
  architecture: 4,
  reference: 5,
  contributing: 6,
};

const DEFAULT_ORDER = 7;

function titleCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function buildNavTree(): Promise<NavSection[]> {
  const docs = await getCollection('docs');

  // Build set of all entry IDs for index detection.
  // An entry is an "index" if other entries have it as a path prefix.
  // e.g. "guides" is an index because "guides/agents" exists.
  const allIds = new Set(docs.map((e) => e.id));
  const dirPrefixes = new Set<string>();
  for (const id of allIds) {
    const slashIdx = id.lastIndexOf('/');
    if (slashIdx !== -1) {
      dirPrefixes.add(id.substring(0, slashIdx));
    }
  }

  function isIndexEntry(id: string): boolean {
    // Root index
    if (id === 'index') return true;
    // Directory index: the ID matches a directory that contains other entries
    return dirPrefixes.has(id);
  }

  // Collect index titles and non-index items
  const indexTitles = new Map<string, { title: string; order?: number }>();
  const nonIndexEntries: typeof docs = [];

  for (const entry of docs) {
    if (isIndexEntry(entry.id)) {
      // Root index — skip from nav entirely
      if (entry.id === 'index') continue;

      // Get title: prefer frontmatter, then render to get remark-extracted title
      let title = entry.data.title;
      if (!title) {
        // Render to trigger remark-extract-title, then read remarkPluginFrontmatter
        const rendered = await render(entry);
        title = (rendered as any).remarkPluginFrontmatter?.title;
      }
      if (!title) {
        title = titleCase(entry.id.split('/').pop()!);
      }

      indexTitles.set(entry.id, { title, order: entry.data.order ?? undefined });
    } else {
      nonIndexEntries.push(entry);
    }
  }

  // Build nav items from non-index entries
  const items: Array<{
    slug: string;
    title: string;
    order: number;
    segments: string[];
  }> = [];

  for (const entry of nonIndexEntries) {
    const slug = entry.id;
    const title =
      entry.data.title ||
      titleCase(slug.split('/').pop()!);

    const segments = slug.split('/');
    items.push({
      slug,
      title,
      order: entry.data.order ?? 999,
      segments,
    });
  }

  // Group items by section
  const sectionMap = new Map<
    string,
    {
      items: NavItem[];
      subsections: Map<string, NavItem[]>;
    }
  >();

  for (const item of items) {
    const { segments, slug, title, order } = item;

    if (segments.length === 1) {
      // Top-level file with no parent directory — goes into "other"
      const sectionKey = 'other';
      if (!sectionMap.has(sectionKey)) {
        sectionMap.set(sectionKey, { items: [], subsections: new Map() });
      }
      sectionMap.get(sectionKey)!.items.push({
        slug,
        title,
        order,
        href: `/docs/${slug}`,
      });
    } else if (segments.length === 2) {
      // Direct child of a top-level section: getting-started/quickstart
      const sectionKey = segments[0];
      if (!sectionMap.has(sectionKey)) {
        sectionMap.set(sectionKey, { items: [], subsections: new Map() });
      }
      sectionMap.get(sectionKey)!.items.push({
        slug,
        title,
        order,
        href: `/docs/${slug}`,
      });
    } else {
      // Nested: guides/context/state -> section=guides, subsection=guides/context
      const sectionKey = segments[0];
      const subsectionKey = segments.slice(0, -1).join('/');
      if (!sectionMap.has(sectionKey)) {
        sectionMap.set(sectionKey, { items: [], subsections: new Map() });
      }
      const section = sectionMap.get(sectionKey)!;
      if (!section.subsections.has(subsectionKey)) {
        section.subsections.set(subsectionKey, []);
      }
      section.subsections.get(subsectionKey)!.push({
        slug,
        title,
        order,
        href: `/docs/${slug}`,
      });
    }
  }

  // Sort helper
  const sortItems = (a: NavItem, b: NavItem) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  };

  // Build final NavSection[]
  const sections: NavSection[] = [];

  for (const [sectionKey, data] of sectionMap) {
    const indexInfo = indexTitles.get(sectionKey);
    const label = indexInfo?.title || titleCase(sectionKey);
    const sectionOrder = SECTION_ORDER[sectionKey] ?? DEFAULT_ORDER;

    // Build children (subsections)
    const children: NavSection[] = [];
    for (const [subKey, subItems] of data.subsections) {
      const subIndexInfo = indexTitles.get(subKey);
      const subLabel = subIndexInfo?.title || titleCase(subKey.split('/').pop()!);
      children.push({
        slug: subKey,
        label: subLabel,
        order: subIndexInfo?.order ?? 999,
        items: subItems.sort(sortItems),
        children: [],
      });
    }
    children.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.label.localeCompare(b.label);
    });

    sections.push({
      slug: sectionKey,
      label,
      order: sectionOrder,
      items: data.items.sort(sortItems),
      children,
    });
  }

  sections.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.label.localeCompare(b.label);
  });

  return sections;
}
