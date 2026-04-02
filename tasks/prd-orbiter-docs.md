# PRD: Orbiter Documentation Site

## Introduction

Build a complete documentation site for **Orbiter**, a Python multi-agent LLM framework, serving 153 markdown files across 6 sections (Getting Started, Guides, Architecture, Reference, Contributing, Other). The site dynamically incorporates documentation from `docs-source/` using Astro Content Collections so docs can be modified independently of the site code. The visual design follows the existing Orbiter marketing site aesthetic: warm parchment color palette, Bricolage Grotesque + Junicode typography, blur-based scroll animations, and zero framework JavaScript. The site includes a marketing-style landing page with animated orbital illustrations, full-text client-side search, syntax-highlighted code blocks with window chrome styling, and a responsive three-column documentation layout.

**GitHub Repository:** https://github.com/Midsphere-AI/orbiter-ai.git

## Goals

- Render all 153 markdown documentation files as navigable, searchable web pages with zero build errors
- Dynamically consume `docs-source/` via Astro Content Collections `glob()` loader so docs are never copied or duplicated
- Match the established design system: warm parchment tones (`#f2f0e3` / `#1f1f1f`), coral accent (`#F76F53`), Bricolage Grotesque body + Junicode display headings
- Create a visually distinctive landing page with animated orbital illustrations that communicate the "Orbiter" concept
- Provide fast client-side search (Pagefind) that indexes all 153 pages at build time
- Ship zero framework JavaScript -- all interactivity via vanilla `<script>` tags or CSS-only
- Achieve Lighthouse score >= 95 on all four categories (Performance, Accessibility, Best Practices, SEO)
- Support dark/light mode with system preference detection and manual toggle
- Be fully responsive with a sidebar-drawer pattern on mobile and touch-friendly targets (44px minimum)
- Build in under 30 seconds for the full 153-page static output

## User Stories

### US-001: Install dependencies and configure build tools

**Description:** As a developer, I need the project bootstrapped with all required dependencies so that Astro, Tailwind CSS v4, and TypeScript are properly configured and the dev server starts.

**Acceptance Criteria:**
- [ ] `package.json` includes: `astro@^5.17`, `@tailwindcss/vite@^4`, `tailwindcss@^4`, `@astrojs/sitemap@^3`, `@fontsource-variable/bricolage-grotesque@^5`, `clsx@^2`, `tailwind-merge@^2`
- [ ] `package.json` devDependencies include: `typescript@^5`, `pagefind@^1`
- [ ] `astro.config.mjs` configures Tailwind v4 via `vite.plugins: [tailwindcss()]` (NOT the older `@astrojs/tailwind`)
- [ ] `astro.config.mjs` includes `@astrojs/sitemap` integration
- [ ] `tsconfig.json` extends `astro/tsconfigs/strict`
- [ ] `npm run dev` starts the dev server without errors
- [ ] `npm run build` produces output in `dist/`

### US-002: Create global CSS with design system tokens

**Description:** As a developer, I need the design system's color tokens, font faces, animation keyframes, and base prose styles defined in a single CSS file so all components share a consistent visual language.

**Acceptance Criteria:**
- [ ] `src/styles/global.css` exists with `@import "tailwindcss"` and `@import "@fontsource-variable/bricolage-grotesque"`
- [ ] CSS custom properties defined: `--zen-paper`, `--zen-dark`, `--zen-muted`, `--zen-subtle` with light/dark values
- [ ] `[data-theme="dark"]` overrides all custom properties to dark mode values
- [ ] `@theme {}` block maps tokens to Tailwind: `paper`, `dark`, `coral` (#F76F53), `zen-blue` (#6287f5), `zen-green` (#63f78b), `muted`, `subtle`
- [ ] `@font-face` declarations for Junicode Roman and Italic (woff2 files in `public/fonts/`)
- [ ] `@keyframes` defined: `zenReveal`, `zenFade`, `zenScale`, `heroEntrance`
- [ ] Stagger delay CSS: `[data-delay="1"]` through `[data-delay="6"]` with 0.15s increments
- [ ] `@media (prefers-reduced-motion: reduce)` resets all animations to final state
- [ ] Prose styles scoped under `.prose` class covering: paragraphs, inline code, links, bold, blockquotes, tables, lists, images, headings
- [ ] `src/utils/merge.ts` exports `cn()` function wrapping `clsx` + `tailwind-merge`
- [ ] Typecheck passes (`npm run astro check`)

### US-003: Create BaseLayout with theme detection and animation observer

**Description:** As a user, I need a consistent HTML shell across all pages that handles theme detection before first paint and triggers scroll-based animations.

**Acceptance Criteria:**
- [ ] `src/layouts/BaseLayout.astro` renders `<!DOCTYPE html>`, `<html lang="en" data-theme="light">`, `<head>`, `<body>`
- [ ] `<head>` includes: global.css import, font preloads for Bricolage Grotesque, meta viewport
- [ ] Blocking inline `<script>` in `<head>` that reads `localStorage.getItem('theme')`, falls back to `prefers-color-scheme`, defaults to `'light'`, sets `data-theme` on `<html>` -- prevents flash of wrong theme
- [ ] Body contains a `<script>` that creates an IntersectionObserver for `[data-animate]` elements (threshold 0.05, rootMargin `-40px` bottom), adds `is-visible` class, then unobserves
- [ ] Skip-to-content link: `<a href="#main-content" class="sr-only focus:not-sr-only">Skip to content</a>`
- [ ] Props interface accepts `title: string` and `description?: string`
- [ ] Typecheck passes
- [ ] Verify in browser using dev server -- page renders with correct theme, no flash

### US-004: Configure content collection with glob loader pointing at docs-source

**Description:** As a developer, I need Astro Content Collections configured to read markdown files directly from `docs-source/` so documentation stays in sync without file copying.

**Acceptance Criteria:**
- [ ] `src/content.config.ts` defines a `docs` collection using `glob({ pattern: '**/*.md', base: './docs-source' })`
- [ ] Schema uses `z.object()` with all optional fields: `title` (string), `description` (string), `order` (number), `category` (string), `draft` (boolean, default false)
- [ ] `getCollection('docs')` returns entries for all 153 markdown files in `docs-source/`
- [ ] Entry slugs match file paths: `docs-source/guides/agents.md` produces slug `guides/agents`
- [ ] Files without frontmatter are parsed successfully (all schema fields are optional)
- [ ] Dev server hot-reloads when a file in `docs-source/` is modified
- [ ] Typecheck passes

### US-005: Create dynamic docs route that renders all 153 pages

**Description:** As a user, I need every markdown file in `docs-source/` accessible as a web page under `/docs/` so the entire documentation is browsable.

**Acceptance Criteria:**
- [ ] `src/pages/docs/[...slug].astro` exists with `getStaticPaths()` that maps all docs collection entries to routes
- [ ] Route `docs-source/getting-started/quickstart.md` is accessible at `/docs/getting-started/quickstart`
- [ ] Route `docs-source/guides/context/state.md` is accessible at `/docs/guides/context/state`
- [ ] Route `docs-source/index.md` is accessible at `/docs` (root index)
- [ ] Each page renders the markdown content inside a basic layout wrapper
- [ ] `npm run build` produces 153+ HTML files in `dist/docs/` with zero errors
- [ ] No 404s when navigating between pages

### US-006: Build navigation tree utility from collection entries

**Description:** As a developer, I need a utility that generates a hierarchical navigation tree from the docs collection so the sidebar can render grouped, ordered navigation links.

**Acceptance Criteria:**
- [ ] `src/utils/navigation.ts` exports a `buildNavTree()` async function that returns `NavSection[]`
- [ ] `NavSection` interface: `{ slug, label, order, items: NavItem[], children: NavSection[] }`
- [ ] `NavItem` interface: `{ slug, title, order, href }`
- [ ] Top-level sections ordered: Getting Started (1), Guides (2), Architecture (3), Reference (4), Contributing (5), Other (6)
- [ ] Section labels derived from `index.md` titles when available, otherwise from directory names (title-cased, hyphens to spaces)
- [ ] Items within sections sorted by frontmatter `order` field first, then alphabetically by title
- [ ] Nested subsections work: `guides/context/` appears as a child of Guides with its own items
- [ ] `index.md` files are not listed as separate nav items (their content defines the section)
- [ ] Typecheck passes

### US-007: Create remark plugin for title extraction from first heading

**Description:** As a developer, I need titles automatically extracted from the first `# heading` in each markdown file so pages without frontmatter titles still display correct titles in navigation and page headers.

**Acceptance Criteria:**
- [ ] Remark plugin in `src/plugins/remark-extract-title.ts` finds the first `# heading` node in the AST
- [ ] Extracted title is injected into `file.data.astro.frontmatter.title` (Astro's frontmatter injection pattern)
- [ ] The `# heading` node is removed from the AST (the layout renders the title separately)
- [ ] Files with a frontmatter `title` field are not overridden by the plugin
- [ ] Files without any `# heading` still build without error (title falls back to slug-based name)
- [ ] Plugin registered in `astro.config.mjs` under `markdown.remarkPlugins`
- [ ] Typecheck passes

### US-008: Create remark plugin for markdown link rewriting

**Description:** As a user, I need internal links between docs pages to work correctly so that `[Concepts](concepts.md)` in the markdown source navigates to `/docs/getting-started/concepts` on the rendered site.

**Acceptance Criteria:**
- [ ] Remark plugin in `src/plugins/remark-rewrite-links.ts` processes all link nodes in the AST
- [ ] Relative `.md` links rewritten to absolute site routes: `concepts.md` in `getting-started/quickstart.md` becomes `/docs/getting-started/concepts`
- [ ] Parent-relative links work: `../guides/context/index.md` becomes `/docs/guides/context`
- [ ] `index.md` references stripped to directory path: `guides/context/index.md` becomes `/docs/guides/context`
- [ ] External URLs (`https://...`) left unchanged
- [ ] Anchor-only links (`#section`) left unchanged
- [ ] Plugin registered in `astro.config.mjs` under `markdown.remarkPlugins`
- [ ] Navigate between 5+ cross-linked pages to verify links work
- [ ] Typecheck passes

### US-009: Create DocsLayout with three-column responsive grid

**Description:** As a user, I need a documentation layout with a left sidebar for navigation, a central content area, and a right column for table of contents, all responsive across screen sizes.

**Acceptance Criteria:**
- [ ] `src/layouts/DocsLayout.astro` wraps `BaseLayout` and renders: Navbar, sidebar area (left), main content area (center), TOC area (right), Footer
- [ ] CSS grid: `grid-template-columns: 256px 1fr 200px` at `xl`, `240px 1fr` at `lg`, `1fr` below
- [ ] Sidebar sticky: `sticky top-[var(--navbar-height)]` with `overflow-y-auto max-h-[calc(100vh-var(--navbar-height))]`
- [ ] TOC column hidden below `xl` breakpoint
- [ ] Sidebar hidden below `lg` breakpoint (mobile drawer handled separately)
- [ ] Content area has `.prose` class applied and `max-w-3xl mx-auto` centering
- [ ] `<main id="main-content">` landmark wraps the content slot
- [ ] Props interface accepts: `title`, `headings`, `slug`
- [ ] Typecheck passes
- [ ] Verify in browser: resize from desktop to mobile, layout responds correctly

### US-010: Create Sidebar component with collapsible sections

**Description:** As a user, I need a sidebar navigation that shows all documentation sections as collapsible groups, highlights my current page, and lets me browse the full docs hierarchy.

**Acceptance Criteria:**
- [ ] `src/components/Sidebar.astro` renders the `NavSection[]` tree as nested `<nav>` with `<details>` for each section
- [ ] Current section's `<details>` is `open` by default
- [ ] Current page highlighted with `bg-coral/10 text-coral font-medium` and a 2px left border in coral
- [ ] Section labels styled: `text-[11px] uppercase tracking-[0.15em] text-dark/40 font-semibold`
- [ ] Nav items styled: `text-sm text-dark/70 hover:text-dark py-1.5 pl-3` with `border-l border-dark/[0.06]`
- [ ] Nested subsections (e.g., `guides/context/*`) render as indented child groups
- [ ] `aria-current="page"` set on the active link
- [ ] All links meet 44px minimum touch target height on mobile
- [ ] Typecheck passes
- [ ] Verify in browser: navigate between pages, current page highlighting updates

### US-011: Create mobile sidebar drawer

**Description:** As a mobile user, I need a sidebar that opens as a drawer overlay from the left so I can navigate docs on small screens.

**Acceptance Criteria:**
- [ ] Hamburger button visible below `lg` breakpoint, positioned top-left in the docs layout
- [ ] CSS-only toggle using hidden checkbox + `peer` modifier (no JS required for basic open/close)
- [ ] Drawer slides from left: `translate-x-full` to `translate-x-0` with 300ms transition
- [ ] Backdrop overlay: `bg-dark/30 backdrop-blur-sm`, dismisses drawer on click
- [ ] Drawer contains the full Sidebar component
- [ ] Minimal scoped `<script>` to close drawer on navigation (hash-link click)
- [ ] `aria-expanded` attribute on hamburger button reflects open/close state
- [ ] Verify in browser at mobile viewport: drawer opens, navigates, closes

### US-012: Create Breadcrumbs component

**Description:** As a user, I need breadcrumb navigation above the docs content so I can see where I am in the hierarchy and navigate up.

**Acceptance Criteria:**
- [ ] `src/components/Breadcrumbs.astro` renders: Home > Section > Subsection > Current Page
- [ ] Path derived from the current slug (e.g., `guides/context/state` becomes Home > Guides > Context Engine > State)
- [ ] All items except the last are clickable links
- [ ] Last item (current page) styled as `text-dark/70 font-medium`, not a link
- [ ] Separator: `>` character in `text-dark/30`
- [ ] Overall styling: `text-sm text-dark/50`
- [ ] Typecheck passes

### US-013: Create Table of Contents component with scroll-spy

**Description:** As a user reading a long docs page, I need a right-side table of contents that shows the heading hierarchy and highlights the section I'm currently reading.

**Acceptance Criteria:**
- [ ] `src/components/TableOfContents.astro` accepts `headings` array (from Astro's `entry.render()`)
- [ ] Renders `h2` and `h3` headings as a nested list with anchor links
- [ ] "On this page" label header in `text-[11px] uppercase tracking-[0.15em] text-dark/40 font-semibold`
- [ ] Links styled: `text-sm text-dark/50 hover:text-dark`, `h3` items indented with `pl-3`
- [ ] Scroll-spy: vanilla `<script>` IntersectionObserver highlights the currently visible heading
- [ ] Active heading: `text-coral font-medium` with left border indicator `border-l-2 border-coral`
- [ ] Smooth scroll on click (`scroll-behavior: smooth` or `element.scrollIntoView({ behavior: 'smooth' })`)
- [ ] Sticky positioning matching sidebar
- [ ] Typecheck passes
- [ ] Verify in browser: scroll through a long page, TOC highlights update

### US-014: Create Prev/Next navigation component

**Description:** As a user finishing a docs page, I need prev/next links at the bottom so I can continue reading sequentially through the section.

**Acceptance Criteria:**
- [ ] `src/components/PrevNext.astro` renders two cards: "Previous" (left) and "Next" (right)
- [ ] Navigation is context-aware within the current section (e.g., within Guides, not across sections)
- [ ] Each card shows: section label (small text), page title (larger text), and directional arrow
- [ ] Cards styled: `border border-dark/[0.08] rounded-xl p-4 hover:-translate-y-0.5` with 300ms transition
- [ ] First page in section shows only "Next"; last page shows only "Previous"
- [ ] Props: `prevPage?: { title, href, section }` and `nextPage?: { title, href, section }`
- [ ] Typecheck passes
- [ ] Verify in browser: navigate from first to last page in Getting Started section

### US-015: Create Navbar component

**Description:** As a user, I need a persistent top navigation bar with the Orbiter logo, main section links, theme toggle, search trigger, and GitHub link.

**Acceptance Criteria:**
- [ ] `src/components/Navbar.astro` renders a 3-column grid: logo (left), nav links (center), actions (right)
- [ ] Container: `max-w-7xl mx-auto`, sticky top with `backdrop-blur-sm bg-paper/80`
- [ ] Border bottom: `border-b border-dark/[0.04]`
- [ ] Logo: Orbiter wordmark text (or SVG) linking to `/`
- [ ] Nav links: Getting Started (`/docs/getting-started`), Guides (`/docs/guides`), API Reference (`/docs/reference`), GitHub (external, `https://github.com/Midsphere-AI/orbiter-ai`)
- [ ] Right actions: search trigger button (magnifying glass icon), theme toggle button (sun/moon), GitHub icon link
- [ ] Desktop nav hidden below `lg`; hamburger shown below `lg`
- [ ] Theme toggle swaps `data-theme` attribute, persists to `localStorage`, updates icon
- [ ] Typecheck passes
- [ ] Verify in browser: theme toggles, links navigate correctly

### US-016: Create Footer component

**Description:** As a user, I need a site footer with documentation links, community resources, and decorative elements matching the Orbiter design.

**Acceptance Criteria:**
- [ ] `src/components/Footer.astro` renders with inverted colors: `bg-dark text-paper`
- [ ] Link columns (2-col mobile, 3-col desktop): Documentation, Community, Resources
- [ ] Documentation links: Getting Started, Guides, API Reference, Architecture
- [ ] Community links: GitHub, Discussions, Contributing
- [ ] Resources links: Changelog, Migration Guide
- [ ] Orbiter logo/wordmark + "Built with Astro" credit + copyright year
- [ ] Decorative concentric circle rings (paper-colored borders at 18% opacity) positioned bottom-right, hidden on mobile
- [ ] Typecheck passes
- [ ] Verify in browser: footer displays correctly in both themes

### US-017: Create LandingLayout

**Description:** As a developer, I need a landing page layout without the docs sidebar/TOC so the marketing-style home page has full-width sections.

**Acceptance Criteria:**
- [ ] `src/layouts/LandingLayout.astro` wraps `BaseLayout` with Navbar at top, content slot, Footer at bottom
- [ ] No sidebar, no TOC columns
- [ ] Content sections use the standard pattern: `section.section-divider > div.mx-auto.max-w-6xl.px-4.sm:px-6.lg:px-8`
- [ ] Typecheck passes

### US-018: Create Button component

**Description:** As a developer, I need a polymorphic Button component with primary, bordered, and default variants so CTAs and actions are consistent across the site.

**Acceptance Criteria:**
- [ ] `src/components/ui/Button.astro` renders `<a>` if `href` prop is given, `<button>` otherwise
- [ ] Three variants via props: `isPrimary` (bg-dark text-paper shadow-lg), `isBordered` (border-2 border-dark/80, fills on hover), default (bg-subtle)
- [ ] All variants: `rounded-xl`, `hover:scale-[1.02] active:scale-[0.98]`, 200ms transition
- [ ] Accepts `class` prop merged via `cn()`
- [ ] Typed Props interface
- [ ] Typecheck passes

### US-019: Create Card component

**Description:** As a developer, I need a polymorphic Card component for feature cards, package cards, and nav cards.

**Acceptance Criteria:**
- [ ] `src/components/ui/Card.astro` accepts `as` prop (defaults to `div`, supports `article`, `a`)
- [ ] Base styles: `rounded-xl bg-subtle/80 border border-dark/[0.08]`
- [ ] Hover: `-translate-y-0.5`, increased border opacity, subtle shadow, 300ms transition
- [ ] Accepts `class` prop merged via `cn()`
- [ ] Typed Props interface
- [ ] Typecheck passes

### US-020: Style code blocks with window chrome and copy button

**Description:** As a user reading code examples, I need syntax-highlighted code blocks with a familiar window-chrome header (three dots + filename), a copy button, and warm color theming that matches the site's palette.

**Acceptance Criteria:**
- [ ] Shiki configured in `astro.config.mjs` for syntax highlighting (using a built-in theme as base, customized via CSS overrides for warm tones)
- [ ] Custom rehype plugin or CSS wraps `<pre>` blocks with window chrome header: three dots (coral/blue/green at 40% opacity), title bar showing the language name
- [ ] Copy button appears on hover (top-right of code block), copies code to clipboard, shows checkmark feedback for 2 seconds
- [ ] Code block container: `rounded-xl overflow-hidden border border-dark/[0.06]`
- [ ] Light mode background: warm-tinted (`bg-dark/[0.04]`), not cold gray
- [ ] Dark mode background: `bg-[#161616]` (slightly darker than page)
- [ ] Horizontal scroll for long lines with `-webkit-overflow-scrolling: touch`
- [ ] `<pre>` has `tabindex="0"` for keyboard scrolling, `role="region"` with `aria-label`
- [ ] Verify in browser: Python, YAML, JSON, and bash code blocks all render correctly

### US-021: Create Callout/admonition component with remark plugin

**Description:** As a documentation author, I need `> [!TIP]`, `> [!INFO]`, `> [!WARNING]`, and `> [!DANGER]` blockquote syntax to render as styled admonition boxes so important information stands out visually.

**Acceptance Criteria:**
- [ ] Remark plugin in `src/plugins/remark-callouts.ts` converts GitHub-flavored alert blockquotes (`> [!TIP]`, etc.) into custom HTML with data attributes
- [ ] `src/components/ui/Callout.astro` (or CSS-only styling) renders four variants:
  - `tip`: zen-green accent, lightbulb icon, `bg-zen-green/[0.06]`
  - `info`: zen-blue accent, info circle icon, `bg-zen-blue/[0.06]`
  - `warning`: coral accent, warning triangle icon, `bg-coral/[0.06]`
  - `danger`: red accent, X circle icon, `bg-red-500/[0.06]`
- [ ] Structure: left accent border (3px), icon + label header, content below
- [ ] `rounded-lg` corners
- [ ] Plugin registered in `astro.config.mjs`
- [ ] Typecheck passes
- [ ] Verify in browser: add a `> [!TIP]` block to a test doc, confirm it renders styled

### US-022: Create SEOHead component with meta tags and JSON-LD

**Description:** As a search engine, I need proper meta tags, Open Graph tags, and structured data on every page so the site is discoverable and displays rich previews.

**Acceptance Criteria:**
- [ ] `src/components/SEOHead.astro` generates: `<title>`, `<meta name="description">`, canonical URL
- [ ] Open Graph tags: `og:title`, `og:description`, `og:type`, `og:url`, `og:image`
- [ ] Twitter card: `twitter:card=summary_large_image`
- [ ] Title format: `{page title} - Orbiter Docs` (landing page: just "Orbiter")
- [ ] JSON-LD schemas via `src/utils/seo.ts`: `Organization` on landing, `TechArticle` on docs pages, `BreadcrumbList` on all pages
- [ ] `@astrojs/sitemap` generates `sitemap.xml` at build
- [ ] Typecheck passes

### US-023: Create landing page Hero section with orbital illustration

**Description:** As a visitor evaluating Orbiter, I need a visually striking hero section with the framework name, tagline, CTA buttons, a code example, and an animated orbital illustration that communicates the "orbiting agents" concept.

**Acceptance Criteria:**
- [ ] `src/components/landing/Hero.astro` renders: headline, subheadline, CTA buttons, code card, orbital illustration
- [ ] Headline: "Orbiter" in Junicode font (`font-junicode`), `text-6xl sm:text-7xl lg:text-8xl`
- [ ] Subheadline: "A modern, modular multi-agent framework for Python" in Bricolage Grotesque, `text-xl text-dark/60`
- [ ] CTA buttons: "Get Started" (primary, links to `/docs/getting-started/`) and "View on GitHub" (bordered, links to `https://github.com/Midsphere-AI/orbiter-ai`)
- [ ] Code card: quickstart weather agent example in window-chrome styled block
- [ ] `src/components/illustrations/OrbiterHero.astro`: CSS-only animated illustration with:
  - Central circle (core agent) with subtle pulsing glow
  - 3 concentric orbital rings (`border-dark/[0.12]`)
  - Small circles orbiting at different speeds (CSS `@keyframes rotate`), colored coral/zen-blue/zen-green
  - `prefers-reduced-motion`: orbiters at fixed positions, no rotation
- [ ] Hero entrance animation: staggered `heroEntrance` keyframes (0.6s, children staggered by 0.15s)
- [ ] Verify in browser: animation plays on load, respects reduced motion, looks good in both themes

### US-024: Create landing page Feature Cards section

**Description:** As a visitor, I need to quickly understand Orbiter's key capabilities through a grid of feature cards with icons and descriptions.

**Acceptance Criteria:**
- [ ] `src/components/landing/FeatureCards.astro` renders 6 feature cards in a 2x3 grid (1-col mobile, 2-col tablet, 3-col desktop)
- [ ] Each card uses `Card.astro` with: custom SVG icon (warm palette, not generic), feature name heading, 1-2 sentence description
- [ ] Features: Composable Agents, Type-Safe Tools, Multi-Agent Swarms, Context Engine, Memory System, Provider Agnostic
- [ ] Custom SVG icons use only `coral`, `zen-blue`, `zen-green`, `currentColor` -- no arbitrary colors
- [ ] Section follows standard pattern: `section-divider`, centered heading with `data-animate`, cards with staggered `data-delay`
- [ ] Verify in browser: cards animate on scroll, icons visible in both themes

### US-025: Create landing page Code Walkthrough section

**Description:** As a visitor, I need tabbed code examples showing how Orbiter works for single agents, multi-agent swarms, and streaming so I can evaluate the API design.

**Acceptance Criteria:**
- [ ] `src/components/landing/CodeWalkthrough.astro` renders 3 tabbed code examples: "Agent", "Multi-Agent", "Streaming"
- [ ] Tab switching implemented with vanilla `<script>` toggling `data-active` attributes (CSS transitions between tabs)
- [ ] Each tab shows a Python code example in a window-chrome styled code block
- [ ] Code content sourced from `docs-source/` examples (quickstart weather agent, swarm flow DSL, streaming events)
- [ ] Active tab indicator: `border-b-2 border-coral text-coral`
- [ ] `data-animate="fade"` on the code block container
- [ ] Verify in browser: tabs switch, code is syntax-highlighted, keyboard accessible

### US-026: Create landing page Package Overview section

**Description:** As a visitor, I need to see Orbiter's 13-package monorepo structure so I understand the modular architecture.

**Acceptance Criteria:**
- [ ] `src/components/landing/PackageOverview.astro` renders a grid of 13 package cards
- [ ] Each card shows: package name (e.g., `orbiter-core`), one-line description, link to reference docs
- [ ] Grid: 1-col mobile, 2-col tablet, 3-col desktop
- [ ] Cards use `Card.astro` with hover animation
- [ ] Section heading: "Modular by Design" or similar
- [ ] Verify in browser: all 13 packages displayed, links navigate to reference docs

### US-027: Create landing page Architecture Preview section

**Description:** As a visitor, I need to see a visual diagram of how Orbiter agents execute so I understand the framework's execution model at a glance.

**Acceptance Criteria:**
- [ ] `src/components/landing/ArchitecturePreview.astro` wraps the `ExecutionFlowDiagram.astro` illustration
- [ ] `src/components/illustrations/ExecutionFlowDiagram.astro`: inline SVG showing the agent execution loop
  - Stages: User Input -> Agent -> LLM Call -> Tool Execution -> Response (with loop arrow back to LLM)
  - Rounded rectangles for nodes, colored with coral/zen-blue/zen-green
  - Animated flow arrows (CSS `stroke-dashoffset` animation)
  - Background: `bg-subtle` container with window chrome header
  - Responsive: vertical stack on mobile, horizontal flow on desktop
- [ ] `prefers-reduced-motion`: arrows static
- [ ] All SVG colors use CSS custom properties (theme-aware)
- [ ] Verify in browser: diagram renders in both themes, animates on scroll

### US-028: Create landing page Quick Links section

**Description:** As a visitor ready to dive in, I need prominent links to the main documentation sections.

**Acceptance Criteria:**
- [ ] `src/components/landing/QuickLinks.astro` renders 4 cards in a row: Getting Started, Guides, API Reference, GitHub
- [ ] Each card: icon, section name, brief description, arrow indicator
- [ ] Cards use `Card.astro` as `<a>` elements with hover lift
- [ ] Verify in browser: all 4 cards link to correct destinations

### US-029: Assemble complete landing page

**Description:** As a visitor, I need the landing page to render all sections in order with proper spacing, animations, and section dividers.

**Acceptance Criteria:**
- [ ] `src/pages/index.astro` uses `LandingLayout` and renders in order: Hero, Feature Cards, Code Walkthrough, Package Overview, Architecture Preview, Quick Links
- [ ] Each section separated by `section-divider` gradient lines
- [ ] All sections have `data-animate` for scroll-triggered entrance
- [ ] Page builds without errors
- [ ] Verify in browser: full landing page scrolls through all sections with animations

### US-030: Create additional SVG illustration diagrams

**Description:** As a user reading architecture and guide pages, I need visual diagrams for the dependency graph, swarm execution modes, and context engine hierarchy so complex concepts are easier to understand.

**Acceptance Criteria:**
- [ ] `src/components/illustrations/DependencyGraph.astro`: inline SVG of 13-package dependency tree
  - `orbiter-core` at center/top, radiating connections to dependent packages
  - Packages colored by layer: core=coral, extensions=zen-blue, integrations=zen-green
  - Window chrome container
  - Theme-aware colors via CSS custom properties
- [ ] `src/components/illustrations/SwarmModeDiagram.astro`: three small SVGs in a 3-col grid
  - Workflow: linear chain A -> B -> C
  - Handoff: central agent with arrows to specialists
  - Team: lead agent at top with worker agents below
  - Animated directional arrows
- [ ] `src/components/illustrations/ContextEngineDiagram.astro`: tree diagram of Context hierarchy
  - Context at root branching to State, PromptBuilder, Processors, Workspace, KnowledgeStore, Checkpoint, TokenTracker
  - Staggered scroll-reveal animation
- [ ] All illustrations: only use design system colors, `rx="12"` on rectangles, `stroke-width="1.5"`, `stroke-linecap="round"`
- [ ] All illustrations respect `prefers-reduced-motion`
- [ ] Verify in browser: all diagrams render in both themes

### US-031: Integrate Pagefind for full-text search

**Description:** As a user, I need to search across all 153 documentation pages by typing keywords so I can quickly find relevant content.

**Acceptance Criteria:**
- [ ] Build script in `package.json`: `"postbuild": "npx pagefind --site dist"`
- [ ] `npm run build` produces a Pagefind index in `dist/pagefind/`
- [ ] Pagefind JS/CSS loaded lazily (only when search modal opens)
- [ ] Search returns relevant results for: "tool decorator", "swarm modes", "context engine"
- [ ] Results include page title, section breadcrumb, and content snippet

### US-032: Create Search Modal component

**Description:** As a user, I need a search modal that opens with `Cmd/Ctrl+K` or by clicking the search icon, shows live results as I type, and supports keyboard navigation.

**Acceptance Criteria:**
- [ ] `src/components/SearchModal.astro` renders a centered modal overlay
- [ ] Trigger: `Cmd+K` / `Ctrl+K` keyboard shortcut, or click the search icon in Navbar
- [ ] Modal: `backdrop-blur-sm bg-dark/20` overlay, `rounded-xl` container, `max-w-xl mx-auto`
- [ ] Search input: `border-b border-dark/[0.08]`, large text, autofocus, placeholder "Search documentation..."
- [ ] Live results as user types (Pagefind's API), debounced at 150ms
- [ ] Results show: page title, section breadcrumb trail, content snippet with highlighted matches (`bg-coral/20 text-coral`)
- [ ] Keyboard navigation: Arrow keys move through results, Enter opens selected, Escape closes modal
- [ ] Full-screen on mobile viewports
- [ ] Close on overlay click or Escape key
- [ ] Verify in browser: search for "quickstart", navigate to result with keyboard

### US-033: Create 404 page

**Description:** As a user who hits a broken link, I need a friendly 404 page that matches the site design and helps me find my way back.

**Acceptance Criteria:**
- [ ] `src/pages/404.astro` uses `BaseLayout` (not DocsLayout)
- [ ] "Lost in orbit" heading in Junicode
- [ ] Brief message and link back to docs home (`/docs/getting-started/`)
- [ ] Search bar or link to search
- [ ] Decorative orbital illustration (can reuse/simplify the OrbiterHero rings)
- [ ] Matches site theme (dark/light mode)
- [ ] Verify in browser: navigate to a non-existent URL, see 404 page

### US-034: Create favicon and OG image

**Description:** As a user, I need a proper favicon and social sharing image so browser tabs and link previews are branded.

**Acceptance Criteria:**
- [ ] `public/favicon.svg`: Orbiter logo (stylized "O" with orbital ring) using coral color
- [ ] `public/favicon.ico`: 32x32 ICO fallback
- [ ] `public/og-image.png`: 1200x630 social sharing image with Orbiter branding, warm palette
- [ ] Both favicon formats referenced in SEOHead component
- [ ] OG image referenced in Open Graph meta tags

### US-035: Full build verification and broken link check

**Description:** As a developer, I need to verify that all 153 pages build correctly with no broken internal links so the site is production-ready.

**Acceptance Criteria:**
- [ ] `npm run build` completes with zero errors
- [ ] All 153+ HTML files generated in `dist/`
- [ ] No broken internal links (verify with a link checker or manual spot-check of 20+ cross-linked pages)
- [ ] All remark plugins (title extraction, link rewriting, callouts) work across all pages
- [ ] No pages with missing titles in navigation
- [ ] Code blocks render with syntax highlighting on all pages
- [ ] Build completes in under 30 seconds

### US-036: Performance and accessibility audit

**Description:** As a developer, I need the site to meet performance and accessibility standards so it loads fast and is usable by everyone.

**Acceptance Criteria:**
- [ ] Lighthouse Performance score >= 95 on landing page and a sample docs page
- [ ] Lighthouse Accessibility score >= 95
- [ ] Lighthouse Best Practices score >= 95
- [ ] Lighthouse SEO score >= 95
- [ ] Total JavaScript shipped < 20KB (Pagefind + theme toggle + scroll spy + copy button + search modal)
- [ ] WCAG AA color contrast on all text (verified: `#2e2e2e` on `#f2f0e3` = 10.8:1)
- [ ] All images have alt text
- [ ] All icon-only buttons have `aria-label`
- [ ] Focus rings visible on all interactive elements (`ring-2 ring-coral/50 ring-offset-2 ring-offset-paper`)
- [ ] `prefers-reduced-motion` disables all animations
- [ ] Pages functional with JavaScript disabled (except search)

## Functional Requirements

- FR-01: Astro Content Collection with `glob()` loader reads all `docs-source/**/*.md` files at build time without copying them into `src/`
- FR-02: Dynamic route `docs/[...slug].astro` generates a page for every docs collection entry, mirroring the `docs-source/` directory hierarchy
- FR-03: Remark plugin extracts page title from the first `# heading` in markdown files lacking a `title` frontmatter field
- FR-04: Remark plugin rewrites relative `.md` links (e.g., `concepts.md`, `../guides/context/index.md`) to absolute site routes
- FR-05: Remark plugin converts GitHub-flavored alert blockquotes (`> [!TIP]`, `> [!INFO]`, `> [!WARNING]`, `> [!DANGER]`) into styled callout components
- FR-06: Navigation tree utility auto-generates a hierarchical sidebar structure from collection entries, grouped by directory and sorted by `order` field then alphabetically
- FR-07: Sidebar component renders the nav tree with collapsible `<details>` sections and highlights the current page
- FR-08: Table of contents component extracts `h2`/`h3` headings and highlights the current section via IntersectionObserver scroll-spy
- FR-09: Prev/Next component navigates sequentially within the current documentation section
- FR-10: Breadcrumbs component derives the path hierarchy from the current slug
- FR-11: Code blocks rendered with Shiki syntax highlighting at build time, wrapped in window-chrome styled containers with copy-to-clipboard button
- FR-12: Theme toggle persists choice to `localStorage`, detects `prefers-color-scheme` on first visit, applies `data-theme` attribute before first paint
- FR-13: Pagefind indexes all built pages at build time; search modal loads the index lazily on first open
- FR-14: Search modal supports `Cmd/Ctrl+K` keyboard shortcut, live results with highlighted matches, and arrow-key navigation
- FR-15: Landing page renders: Hero (with orbital animation + code example), Feature Cards (6), Code Walkthrough (3 tabbed examples), Package Overview (13 packages), Architecture Preview (execution flow diagram), Quick Links (4)
- FR-16: All SVG illustrations use only design system colors via CSS custom properties, respect `prefers-reduced-motion`, and adapt to dark/light mode
- FR-17: SEOHead generates `<title>`, meta description, Open Graph tags, Twitter card, canonical URL, and JSON-LD structured data for every page
- FR-18: Sitemap generated at build time via `@astrojs/sitemap`
- FR-19: Mobile sidebar opens as a left-sliding drawer overlay, toggled via CSS checkbox pattern
- FR-20: All interactive elements meet 44px minimum touch target and have visible focus rings
- FR-21: Zero framework JavaScript shipped -- all interactivity via vanilla `<script>` tags or CSS-only patterns
- FR-22: IntersectionObserver-based scroll animations (`zenReveal`, `zenFade`, `zenScale`) with stagger delays, disabled by `prefers-reduced-motion`

## Non-Goals

- **Versioned documentation**: No multi-version selector or version dropdown. Single version at a time.
- **Interactive playground**: No embedded Python REPL, code execution sandbox, or live preview.
- **User accounts or comments**: Static site with no authentication, no user-generated content, no commenting system.
- **Internationalization (i18n)**: English only. No locale routing or translation infrastructure.
- **CMS integration**: Content managed as raw markdown files in `docs-source/`, not via a headless CMS.
- **Server-side rendering**: Fully static output. No SSR, no server functions, no API routes.
- **React / Vue / Svelte islands**: Zero framework component islands. All interactivity is vanilla JS or CSS.
- **Deployment configuration**: No deployment pipeline configured in v1 (decided to handle later).
- **Custom search backend**: No Algolia, Meilisearch, or server-based search. Pagefind only.
- **PDF export**: No downloadable PDF version of the documentation.
- **API auto-generation**: Reference docs are handwritten markdown, not auto-generated from Python source code.

## Design Considerations

### Visual Identity
The site follows the established Orbiter marketing site aesthetic documented in `docs/design-system.md`:

- **Color palette**: Warm parchment (`#f2f0e3` light / `#1f1f1f` dark), coral accent (`#F76F53`), zen-blue (`#6287f5`), zen-green (`#63f78b`). Opacity modifiers instead of discrete gray shades.
- **Typography**: Bricolage Grotesque (body, weight 500 default, variable 400-700) + Junicode (display headings, self-hosted woff2, swash features). Heading scale: `text-3xl` mobile to `text-5xl` desktop.
- **Borders & surfaces**: Extremely subtle -- `border-dark/[0.04]` for navbar, `border-dark/[0.06]` for dividers, `border-dark/[0.08]` for cards. Never solid 1px gray.
- **Corner radius**: `rounded-xl` for major containers, `rounded-lg` for smaller elements, `rounded-md` for inline code.
- **Section dividers**: `::before` pseudo-element gradient line (transparent -> `--zen-dark` at 8% opacity -> transparent).
- **Animation**: Blur(4px) + translate/scale + opacity entrance animations, CSS-only, IntersectionObserver triggered, `prefers-reduced-motion` honored.

### Illustration Style
All SVG illustrations follow strict rules: only design system colors, `rx="12"` on rectangles, `stroke-width="1.5"`, `stroke-linecap="round"`, CSS animations only, theme-aware via `currentColor` or CSS custom properties. The orbital metaphor (concentric rings, orbiting nodes) is the primary visual motif.

### Components to Reuse from Marketing Site
Directly reusable: `global.css` tokens, `BaseLayout.astro`, `Button.astro`, `Card.astro`, `cn()` utility, `seo.ts`, Navbar (adapted links), Footer (adapted content).

## Technical Considerations

### Content Collection with glob() Loader
- The `glob()` loader in Astro 5.x reads files from any directory at build time. Using `base: './docs-source'` means documentation source files are never copied into `src/content/`.
- All schema fields must be optional since most docs lack frontmatter entirely. Title extraction relies on the remark plugin.
- Astro's dev server watches the glob base directory for changes and hot-reloads.

### Remark/Rehype Plugin Chain
Three custom remark plugins run in order: title extraction, callout conversion, link rewriting. These are registered in `astro.config.mjs` under `markdown.remarkPlugins`. The code block styling is handled via rehype (post-HTML) or CSS targeting Shiki's output classes.

### Pagefind Static Search
Pagefind runs as a postbuild step, scanning the `dist/` output. It creates a compressed index (`~50KB` for 153 pages) that loads only when the search modal opens. The search UI uses Pagefind's JavaScript API (not its default UI component) for full styling control.

### Zero-JS Architecture
Astro's static output ships no JavaScript by default. The site adds minimal vanilla `<script>` tags for: theme detection (inline, blocking), IntersectionObserver for animations, scroll-spy for TOC, copy-to-clipboard for code blocks, tab switching for code walkthrough, search modal (Pagefind API). Total budget: < 20KB.

### Font Loading Strategy
Bricolage Grotesque loaded via `@fontsource` (inlined in CSS bundle). Junicode self-hosted as woff2 in `public/fonts/` with `font-display: swap`. Bricolage preloaded in `<head>` for critical text; Junicode loads on demand since it's only used on display headings.

## Success Metrics

- All 153 documentation files render as accessible web pages with zero build errors
- Navigation sidebar correctly groups and orders all sections and pages
- Internal cross-links between docs pages resolve correctly (zero broken links)
- Search returns relevant results for framework concepts (e.g., "tool decorator", "swarm", "context engine")
- Lighthouse scores >= 95 on all four categories
- Total JavaScript shipped < 20KB
- Full build completes in under 30 seconds
- Site is fully functional with JavaScript disabled (except search)
- WCAG AA compliance with no axe-core violations
- Visual consistency with design system verified in both light and dark mode

## Open Questions

1. Should the site include an RSS feed for the changelog page, or is the changelog only accessible via the web?
2. Are there any documentation pages that should be marked as "draft" and excluded from the build?
3. Should the `docs-source/design-spec.md` and `docs-source/rewrite-plan.md` (internal development documents) be rendered as regular pages or hidden behind a "Development" section?
4. Will the Orbiter logo SVG be provided as an asset, or should it be created as part of this project?
5. Should code examples on the landing page be hardcoded in the component, or dynamically pulled from specific docs-source files?
