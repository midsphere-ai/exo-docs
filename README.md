<div align="center">

# Exo Docs

### The documentation site for [Exo](https://github.com/Midsphere-AI/exo-ai) -- a modern, modular multi-agent framework for Python.

[![Built with Astro](https://astro.badg.es/v2/built-with-astro/small.svg)](https://astro.build)

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/Midsphere-AI/exo-docs/tree/main)

[Live Site](https://exo.midsphere.ai) &nbsp;&middot;&nbsp; [Exo Framework](https://github.com/Midsphere-AI/exo-ai) &nbsp;&middot;&nbsp; [Contributing](#syncing-docs)

</div>

---

<br/>

<table>
<tr>
<td width="50%">

**160+ pages** of documentation covering agents, tools, multi-agent swarms, context engine, memory, tracing, evaluation, and the full API reference.

Built with **Astro 5**, **Tailwind CSS v4**, and **Pagefind** search. Ships **zero framework JavaScript** -- all interactivity is vanilla JS or CSS-only.

</td>
<td width="50%">

```
npm install
npm run dev       # localhost:4321
npm run build     # static site + search index
```

</td>
</tr>
</table>

<br/>

## How It Works

The site reads markdown files directly from `docs-source/` using Astro's Content Collections `glob()` loader. Documentation is synced from the [exo-ai](https://github.com/Midsphere-AI/exo-ai) repo's `docs/` directory -- no file copying or build-time transforms needed.

```
docs-source/              Markdown source (synced from exo-ai/docs/)
  ├── getting-started/    Installation, quickstart, core concepts
  ├── guides/             Agents, tools, multi-agent, context, memory, MCP, sandbox...
  ├── reference/          Full API reference for all 13 packages
  ├── advanced/           Architecture, design docs, porting guides, contributing
  ├── migration/          Migration guides from AWorld
  └── index.md            Landing page

src/
  ├── components/         Sidebar, Navbar, SearchModal, TOC, illustrations
  ├── layouts/            BaseLayout, DocsLayout (3-column responsive grid)
  ├── pages/              docs/[...slug].astro dynamic route, 404
  ├── plugins/            Remark + Rehype plugins
  └── utils/              Navigation tree, SEO, class merge utility
```

## Features

| | |
|---|---|
| **Full-text search** | Pagefind indexes all pages at build time, lazy-loads on `Cmd+K` |
| **Dark / light mode** | System preference detection + manual toggle, persisted to localStorage |
| **Responsive layout** | Three-column grid (sidebar, content, TOC) with mobile drawer |
| **Remark plugins** | Auto-extracts titles from `# headings`, rewrites `.md` links to site routes, renders `> [!TIP]` callout blocks |
| **Code blocks** | Shiki syntax highlighting, window-chrome headers, copy-to-clipboard |
| **Scroll animations** | IntersectionObserver-triggered entrance animations, respects `prefers-reduced-motion` |
| **SEO** | Open Graph, Twitter Cards, JSON-LD structured data, auto-generated sitemap |
| **Zero framework JS** | No React, Vue, or Svelte -- vanilla `<script>` tags only, total JS < 10KB |

## Commands

| Command | Action |
|:---|:---|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build static site to `dist/` and generate Pagefind search index |
| `npm run preview` | Preview the production build locally |
| `npx astro check` | Run TypeScript type checking |

## Syncing Docs

To pull the latest documentation from the main Exo repository:

```sh
# Copy all docs from exo-ai
cp -r /path/to/exo-ai/docs/* docs-source/

# Verify everything builds
npm run build
```

> [!NOTE]
> New top-level sections need an entry in `SECTION_ORDER` in [`src/utils/navigation.ts`](src/utils/navigation.ts) and icon mappings in [`src/components/Sidebar.astro`](src/components/Sidebar.astro).

## Tech Stack

- **[Astro 5](https://astro.build)** -- static site generator with Content Collections
- **[Tailwind CSS v4](https://tailwindcss.com)** -- utility-first CSS via Vite plugin
- **[Pagefind](https://pagefind.app)** -- static search indexing
- **[Shiki](https://shiki.matsu.io)** -- syntax highlighting at build time

---

<div align="center">
<sub>Built with Astro. Docs synced from <a href="https://github.com/Midsphere-AI/exo-ai">exo-ai</a>.</sub>
</div>
