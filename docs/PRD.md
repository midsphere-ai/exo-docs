# Orbiter Documentation Site — Product Requirements Document

---

## 1. Overview

### 1.1 What Is This?

A static documentation site for **Orbiter**, a Python multi-agent LLM framework. The site serves 153 markdown documentation files across 5 major sections (Getting Started, Guides, Architecture, Reference, Contributing) with a visually distinctive design that matches Orbiter's existing marketing site aesthetic — warm parchment tones, serif display headings, blur-based scroll animations, and zero framework JavaScript.

### 1.2 Why Build It?

Orbiter's documentation currently exists as raw markdown files in a `docs-source/` directory with no web presentation. Developers evaluating or using the framework need a fast, searchable, well-organized documentation site that:

- Renders 153 markdown files with proper syntax highlighting, navigation, and cross-linking
- Stays in sync with documentation source files that change independently
- Matches the visual identity of the Orbiter marketing site (warm, editorial, not clinical)
- Works entirely as a static site — no server runtime, deployable to any CDN

### 1.3 Who Is It For?

| Audience | What they need |
|----------|---------------|
| **Evaluators** | Landing page with clear value props, quick code examples, fast path to "Getting Started" |
| **New users** | Linear learning path: Installation → Quickstart → Concepts → First Agent |
| **Active developers** | Fast search, sidebar navigation, per-page TOC, copy-able code blocks |
| **Advanced users** | Complete API reference (90+ pages across 13 packages), architecture docs |
| **Contributors** | Contributing guides, code style, package structure, testing docs |

---

## 2. Technical Architecture

### 2.1 Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **Astro 5.x** (static output) | Zero JS shipped by default; pages are pure HTML/CSS until opted in |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` | Tokens in `src/styles/global.css` inside `@theme {}`. NOT the older `@astrojs/tailwind` |
| Type safety | **TypeScript** (strict) | Every component has a typed `Props` interface |
| Content | **Astro Content Collections** with `glob()` loader | Points directly at `docs-source/` — no file copying |
| Markdown | **Astro's built-in markdown** + `rehype-pretty-code` (Shiki) | Syntax highlighting, code titles, line numbers |
| Search | **Pagefind** | Static client-side search, indexes at build time, zero server |
| SEO | Custom `SEOHead.astro` + `@astrojs/sitemap` | JSON-LD, OG tags, RSS for changelog |
| Utility | `clsx` + `tailwind-merge` as `cn()` in `src/utils/merge.ts` | Conflict-free class merging |
| JavaScript | **None shipped by default** | All interactivity is vanilla `<script>` or CSS-only |

### 2.2 Dynamic Documentation Incorporation

The critical requirement: documentation source files in `docs-source/` are modified independently of the site code. The site must consume them dynamically without copying.

#### Content Collection Config (`src/content.config.ts`)

```typescript
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './docs-source',
  }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    order: z.number().optional(),
    category: z.string().optional(),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { docs };
```

#### How It Works

1. **`glob()` loader** scans `docs-source/` at build time and creates entries for every `.md` file
2. **File paths become route slugs**: `docs-source/guides/agents.md` → `/docs/guides/agents`
3. **Frontmatter is optional** — the schema marks all fields as `.optional()`. Documents without frontmatter still work; the title is extracted from the first `# heading` via a remark plugin
4. **No file duplication** — source files stay in `docs-source/`, the content collection references them in-place
5. **Rebuild on change** — Astro's dev server watches `docs-source/` and hot-reloads. Production builds always read fresh content

#### Navigation Generation

Navigation is auto-generated from the file tree at build time:

```typescript
// src/utils/navigation.ts
// Reads all docs collection entries, groups by directory path,
// sorts by frontmatter `order` field (fallback: alphabetical),
// produces a tree structure for the sidebar component
```

The navigation tree structure:

```typescript
interface NavSection {
  slug: string;           // "getting-started", "guides", "reference/core"
  label: string;          // Display name (from index.md title or directory name)
  order: number;          // Sort priority
  items: NavItem[];       // Pages in this section
  children: NavSection[]; // Nested subsections (e.g., guides/context/*)
}

interface NavItem {
  slug: string;
  title: string;
  order: number;
  href: string;
}
```

**Section ordering** (hardcoded, not derived from filesystem):

| Order | Section | Description |
|-------|---------|-------------|
| 1 | Getting Started | Installation, quickstart, concepts, first agent |
| 2 | Guides | Feature guides (agents, tools, running, etc.) |
| 3 | Architecture | Design decisions, execution flow, patterns |
| 4 | Reference | API reference for all 13 packages |
| 5 | Contributing | Code style, development, testing |
| 6 | Other | Changelog, migration guide |

Within each section, items sort by frontmatter `order` (if present), then alphabetically by title.

#### Title Extraction

For docs without a `title` in frontmatter (most of them), a remark plugin extracts it:

1. Find the first `# Heading` in the markdown AST
2. Use its text content as the page title
3. Strip it from the rendered content (the layout renders the title separately with proper styling)

---

## 3. Information Architecture

### 3.1 Route Structure

```
/                           → Landing page (marketing + quick links)
/docs/                      → Docs index (redirects to getting-started)
/docs/getting-started/      → Getting Started index
/docs/getting-started/installation
/docs/getting-started/quickstart
/docs/getting-started/concepts
/docs/getting-started/first-agent
/docs/guides/               → Guides index
/docs/guides/agents
/docs/guides/tools
/docs/guides/running
/docs/guides/streaming
/docs/guides/multi-agent
/docs/guides/agent-groups
/docs/guides/structured-output
/docs/guides/hooks
/docs/guides/events
/docs/guides/human-in-the-loop
/docs/guides/memory
/docs/guides/memory-backends
/docs/guides/context/       → Context engine index
/docs/guides/context/state
/docs/guides/context/prompt-building
/docs/guides/context/processors
/docs/guides/context/workspace
/docs/guides/context/knowledge
/docs/guides/context/checkpoints
/docs/guides/context/token-tracking
/docs/guides/context/context-tools
/docs/guides/mcp
/docs/guides/sandbox
/docs/guides/tracing
/docs/guides/evaluation
/docs/guides/ralph-loop
/docs/guides/training
/docs/guides/a2a
/docs/guides/server
/docs/guides/cli
/docs/guides/models
/docs/guides/config-driven
/docs/guides/skills
/docs/architecture/          → Architecture index
/docs/architecture/execution-flow
/docs/architecture/dependency-graph
/docs/architecture/design-decisions
/docs/architecture/async-patterns
/docs/architecture/error-handling
/docs/reference/             → Reference index
/docs/reference/core/        → Core package (13 sub-pages)
/docs/reference/core-internal/
/docs/reference/models/
/docs/reference/context/
/docs/reference/memory/
/docs/reference/eval/
/docs/reference/a2a/
/docs/reference/cli/
/docs/reference/mcp/
/docs/reference/sandbox/
/docs/reference/server/
/docs/reference/trace/
/docs/reference/train/
/docs/contributing/          → Contributing index
/docs/contributing/code-style
/docs/contributing/development
/docs/contributing/package-structure
/docs/contributing/testing
/docs/changelog
/docs/migration-guide
/docs/migration/             → Version-specific migration guides
```

### 3.2 Page Types

| Page type | Layout | Left sidebar | Right sidebar | Example |
|-----------|--------|:------------:|:-------------:|---------|
| Landing | `LandingLayout` | No | No | `/` |
| Docs page | `DocsLayout` | Nav sidebar | Table of contents | `/docs/guides/agents` |
| Docs index | `DocsLayout` | Nav sidebar | No | `/docs/guides/` |

---

## 4. Layout Architecture

### 4.1 Layout Chain

```
Landing Page:
  → LandingLayout → BaseLayout (html shell, SEOHead, global.css, theme script, animation observer)

Docs Pages:
  → DocsLayout → BaseLayout
    Contains: Navbar + Sidebar + <main class="docs-content"> + TOC + Footer
```

### 4.2 BaseLayout (`src/layouts/BaseLayout.astro`)

The HTML shell shared by all pages:

- `<!DOCTYPE html>` + `<html lang="en" data-theme="light">`
- `<head>`: SEOHead component, font preloads, global.css, blocking theme-detection script
- `<body>`: Slot for page content, IntersectionObserver animation script
- Blocking inline theme script (runs before first paint):
  1. Check `localStorage.getItem('theme')`
  2. Fall back to `prefers-color-scheme`
  3. Default to `'light'`
  4. Set `data-theme` on `<html>`

### 4.3 DocsLayout (`src/layouts/DocsLayout.astro`)

The three-column documentation layout:

```
┌─────────────────────────────────────────────────────────┐
│  Navbar (full width, sticky top)                        │
├──────────┬──────────────────────────────┬───────────────┤
│          │                              │               │
│ Sidebar  │  Content Area               │ TOC           │
│ (nav)    │  (prose)                     │ (headings)    │
│ 256px    │  max-w-3xl                   │ 200px         │
│ sticky   │  mx-auto                     │ sticky        │
│          │                              │               │
│          │                              │               │
│          ├──────────────────────────────┤               │
│          │  Prev / Next nav             │               │
├──────────┴──────────────────────────────┴───────────────┤
│  Footer (full width)                                    │
└─────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

| Breakpoint | Sidebar | Content | TOC |
|------------|---------|---------|-----|
| `< lg` (mobile) | Hidden, opens as drawer from left | Full width | Hidden |
| `lg` – `xl` | Visible, 240px | Remaining space | Hidden |
| `≥ xl` | Visible, 256px | `max-w-3xl` centered | Visible, 200px |

### 4.4 LandingLayout (`src/layouts/LandingLayout.astro`)

Marketing-style page layout:
- Navbar at top
- Full-width sections with the standard section pattern (`section-divider`, `mx-auto max-w-6xl`)
- Footer at bottom
- No sidebar, no TOC

---

## 5. Design System Implementation

### 5.1 Color System

All colors are CSS custom properties that flip between light and dark mode. Defined in `src/styles/global.css`:

```css
:root {
  --zen-paper: #f2f0e3;
  --zen-dark: #2e2e2e;
  --zen-muted: rgba(0, 0, 0, 0.04);
  --zen-subtle: rgba(0, 0, 0, 0.06);
}

[data-theme="dark"] {
  --zen-paper: #1f1f1f;
  --zen-dark: #d1cfc0;
  --zen-muted: rgba(255, 255, 255, 0.04);
  --zen-subtle: rgba(255, 255, 255, 0.07);
}
```

Mapped to Tailwind via `@theme {}`:

| Token | Value | Role |
|-------|-------|------|
| `paper` | `--zen-paper` | Page background (warm off-white / warm charcoal) |
| `dark` | `--zen-dark` | Primary text color (inverts between modes) |
| `coral` | `#F76F53` | Primary accent — CTAs, links, highlights |
| `zen-blue` | `#6287f5` | Secondary accent — info callouts, diagrams |
| `zen-green` | `#63f78b` | Tertiary accent — success states, checkmarks |
| `muted` | `--zen-muted` | Muted surfaces (4% opacity) |
| `subtle` | `--zen-subtle` | Subtle borders and backgrounds (6-7% opacity) |

**Opacity pattern**: Instead of discrete gray shades, use Tailwind's opacity modifier on `dark`: `text-dark/60` for secondary text, `text-dark/70` for sub-headings, `border-dark/[0.06]` for borders, `border-dark/[0.08]` for cards.

### 5.2 Typography

| Font | Role | Loading | Weight |
|------|------|---------|--------|
| **Bricolage Grotesque** | Body, UI, everything | `@fontsource` variable, weights 400–700 | Default 500, `font-variation-settings: 'width' 100` |
| **Junicode** | Display headings only | Self-hosted woff2 in `public/fonts/` (Roman + Italic) | Variable, swash features (`swsh 1` Roman, `swsh 0` Italic) |

**Heading scale** (responsive):

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Page title (`h1`) | `text-3xl` | `text-4xl` | `text-5xl` |
| Section heading (`h2`) | `text-2xl` | `text-3xl` | `text-3xl` |
| Sub-heading (`h3`) | `text-xl` | `text-xl` | `text-xl` |
| Minor heading (`h4`) | `text-lg` | `text-lg` | `text-lg` |

All headings: `font-semibold tracking-tight leading-[0.95]`. Page titles use `font-junicode` class. Body text: `text-base leading-relaxed`.

### 5.3 Prose Styling

Markdown-rendered content gets a `.prose` class scope with these styles:

- **Paragraphs**: `text-dark/80 leading-relaxed` with `mb-5` spacing
- **Inline code**: `bg-dark/[0.06] rounded-md px-1.5 py-0.5 text-[0.9em] font-medium` — warm-tinted, not the typical cold gray
- **Links**: `text-coral underline decoration-coral/30 underline-offset-2 hover:decoration-coral/60` — coral-colored with subtle underline that intensifies on hover
- **Bold**: `font-semibold text-dark` (full opacity, stands out from 80% body text)
- **Blockquotes**: Left border `border-l-2 border-coral/40`, padded, `text-dark/70 italic`
- **Horizontal rules**: The `section-divider` gradient line (transparent → `--zen-dark` → transparent at 8% opacity)
- **Tables**: `border-dark/[0.08]` borders, alternating row backgrounds with `bg-dark/[0.02]`, sticky header
- **Lists**: `list-disc` / `list-decimal`, `ml-6`, `text-dark/80`, `marker:text-dark/30`
- **Images**: `rounded-xl shadow-lg` with optional caption support

### 5.4 Animation System

Entirely CSS-based, triggered by an IntersectionObserver in BaseLayout:

| Attribute | Keyframes | Effect |
|-----------|-----------|--------|
| `data-animate` (default) | `zenReveal` | `blur(4px)` + `translateY(24px)` + opacity 0 → 1 |
| `data-animate="fade"` | `zenFade` | `blur(4px)` + opacity 0 → 1 |
| `data-animate="scale"` | `zenScale` | `blur(4px)` + `scale(0.95)` + opacity 0 → 1 |

Stagger: `data-delay="1"` through `data-delay="6"` (increments of 0.15s). All use `cubic-bezier(0.25, 0.1, 0.25, 1)` easing, 0.5s duration. `@media (prefers-reduced-motion: reduce)` disables everything.

**Usage in docs pages**: Section headings and major content blocks get `data-animate`. Code blocks get `data-animate="fade"`. Not applied to every paragraph (that would be annoying) — only on initial viewport entry of major elements.

---

## 6. Component Inventory

### 6.1 Layout Components

#### `Navbar.astro`
- 3-column grid at desktop: logo left, centered nav links, right-side actions (search trigger, theme toggle, GitHub link)
- `max-w-7xl` container (wider than content)
- Sticky top with `backdrop-blur-sm bg-paper/80`
- Logo: Orbiter wordmark + orbital ring icon
- Nav links: Getting Started, Guides, API Reference, GitHub
- Mobile: Hamburger toggles `MobileMenu`

#### `MobileMenu.astro`
- CSS-only toggle using hidden checkbox + `peer` modifier
- Overlay fades in, panel slides from left (matching sidebar position)
- Contains full navigation tree with collapsible `<details>` groups
- Close on hash-link click (scoped `<script>`)

#### `Footer.astro`
- Inverted colors: `bg-dark text-paper`
- Decorative concentric circle rings (bottom-right, hidden on mobile)
- Link columns: Documentation, Community, Resources
- Orbiter logo + copyright

#### `Sidebar.astro`
- Renders the `NavSection[]` tree
- Collapsible sections using `<details open>` (open by default for current section)
- Current page highlighted with `bg-coral/10 text-coral font-medium` and left border accent
- Sticky positioning: `sticky top-[var(--navbar-height)]` with `overflow-y-auto max-h-[calc(100vh-var(--navbar-height))]`
- Smooth category labels with `text-[11px] uppercase tracking-[0.15em] text-dark/40 font-semibold`

#### `TableOfContents.astro`
- Extracts `h2` and `h3` headings from the current page
- Renders as a nested list with scroll-spy highlighting
- Current heading gets `text-coral font-medium` + left border indicator
- Sticky positioning (same as sidebar)
- Smooth scroll on click
- "On this page" label header
- Vanilla `<script>` IntersectionObserver for scroll-spy

#### `Breadcrumbs.astro`
- Shows: Home → Section → Subsection → Current Page
- `text-sm text-dark/50` with `>` separators
- Last item (current page) is `text-dark/70 font-medium`, not a link
- Derives path from the current slug

#### `PrevNext.astro`
- Bottom of every docs page
- Two-column layout: ← Previous | Next →
- Context-aware: navigates within the current section
- Cards with `border border-dark/[0.08] rounded-xl` and hover lift
- Shows section label + page title

### 6.2 Content Components

#### `CodeBlock` (via rehype-pretty-code + custom wrapper)
- **Window chrome**: Three colored dots (`bg-coral/60`, `bg-zen-blue/40`, `bg-zen-green/40`) + title bar showing filename or language
- **Syntax highlighting**: Shiki with a custom theme derived from the color palette (warm background, not cold dark)
- **Line numbers**: Optional, enabled for blocks > 5 lines
- **Copy button**: Top-right, appears on hover, copies code to clipboard with checkmark feedback
- **Language badge**: Bottom-right when no title is set
- Light theme: `bg-dark/[0.04]` background with warm syntax colors
- Dark theme: `bg-[#161616]` background (slightly darker than page) with warm syntax colors
- `rounded-xl overflow-hidden border border-dark/[0.06]`

#### `Callout.astro`
Styled admonition boxes for tip/info/warning/danger:

| Type | Icon | Accent color | Background |
|------|------|-------------|------------|
| `tip` | Lightbulb | `zen-green` | `bg-zen-green/[0.06]` |
| `info` | Info circle | `zen-blue` | `bg-zen-blue/[0.06]` |
| `warning` | Warning triangle | `coral` | `bg-coral/[0.06]` |
| `danger` | X circle | `#e53e3e` | `bg-red-500/[0.06]` |

Structure: Left accent border (3px), icon + label header, content slot. `rounded-lg` corners. Triggered via a remark plugin that converts `> [!TIP]` / `> [!INFO]` / `> [!WARNING]` / `> [!DANGER]` blockquote syntax (GitHub-flavored alerts).

#### `Card.astro`
- Polymorphic element (`div` / `article` / `a`)
- Base: `rounded-xl bg-subtle/80 border border-dark/[0.08]`
- Hover: `-translate-y-0.5`, increased border opacity, subtle shadow
- 300ms transition

#### `Button.astro`
- Polymorphic: `<a>` if `href`, `<button>` otherwise
- **Primary**: `bg-dark text-paper shadow-lg` (filled dark)
- **Bordered**: `border-2 border-dark/80` that fills on hover
- **Default**: `bg-subtle` or unstyled
- Micro-interaction: `hover:scale-[1.02] active:scale-[0.98]`, 200ms transition, `rounded-xl`

#### `PackageTable.astro`
Renders the 13-package overview grid:
- Each package as a card with name, one-line description, and link to reference docs
- 2-col on mobile, 3-col on desktop
- Subtle hover animation

#### `ApiSignature.astro`
For rendering API signatures in reference pages:
- Function/class signature in a styled code block with special formatting
- Parameter table below with type, default, description columns
- Collapsible "Source" section

### 6.3 Illustration Components

#### `OrbiterHero.astro` (Landing page hero illustration)
A CSS-only animated illustration of the "orbiting agents" concept:
- Central circle representing the core agent (pulsing subtle glow, `bg-dark` with `text-paper`)
- 3 concentric orbital rings at increasing radii (the concentric circle motif from the design system — `border-dark/[0.12]` thick borders)
- Small circles orbiting along the rings at different speeds (CSS `@keyframes` rotation), colored with `coral`, `zen-blue`, `zen-green`
- Connecting lines (dashed, low opacity) suggesting communication paths
- The whole composition sits behind a semi-transparent code example card (the "window chrome" pattern)
- `prefers-reduced-motion`: rings static, orbiters at fixed positions

#### `ExecutionFlowDiagram.astro`
SVG diagram showing the agent execution loop:
- Uses the warm color palette: nodes in `coral`, `zen-blue`, `zen-green`
- Rounded rectangles for stages (User → Agent → LLM → Tools → Response)
- Animated flow arrows (CSS dash-offset animation)
- Background: `bg-subtle` with subtle dot-grid pattern
- Responsive: Vertical on mobile, horizontal on desktop

#### `DependencyGraph.astro`
SVG rendering of the 13-package dependency tree:
- `orbiter-core` at the center/top
- Radiating connections to dependent packages
- Packages colored by layer (core = `coral`, extensions = `zen-blue`, integrations = `zen-green`)
- Hover highlights the dependency chain
- `rounded-xl` container with window chrome header

#### `SwarmModeDiagram.astro`
Three small SVG diagrams showing Swarm execution modes:
- **Workflow**: Linear chain of agents (A → B → C)
- **Handoff**: Central agent with arrows pointing to specialists
- **Team**: Lead agent at top with worker agents below + delegate tools
- Animated arrows showing data flow direction
- Each in a Card container, arranged in a 3-column grid

#### `ContextEngineDiagram.astro`
Tree diagram of the Context object hierarchy:
- Context at root with branches to State, PromptBuilder, Processors, Workspace, KnowledgeStore, Checkpoint, TokenTracker
- Animated reveal on scroll (uses `data-animate` with stagger)
- Warm palette nodes with connecting lines

#### `SectionDecorator.astro`
Reusable subtle background decoration for section headers:
- Orbital arc paths (SVG) at low opacity (`stroke-dark/[0.04]`)
- Positioned behind heading text
- Different variants for different sections (concentric circles for landing, arcs for docs headers)

---

## 7. Landing Page

### 7.1 Structure

The landing page (`src/pages/index.astro`) is a marketing-style page introducing Orbiter with quick paths into the documentation:

```
┌──────────────────────────────────────────────────┐
│ Navbar                                           │
├──────────────────────────────────────────────────┤
│                                                  │
│  HERO SECTION                                    │
│  ┌────────────────────────────────────────────┐  │
│  │ "Orbiter" (Junicode, display)              │  │
│  │ Tagline + description                      │  │
│  │ [Get Started] [GitHub]                     │  │
│  │                                            │  │
│  │ ┌──────────────────────────────────────┐   │  │
│  │ │ Code example in window chrome card   │   │  │
│  │ │ (quickstart weather agent)           │   │  │
│  │ └──────────────────────────────────────┘   │  │
│  │ ← OrbiterHero illustration behind →        │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ─── section-divider ───                         │
│                                                  │
│  FEATURE HIGHLIGHTS (6 cards in 2x3 grid)        │
│  Composable Agents | Type-Safe Tools             │
│  Multi-Agent Swarms | Context Engine             │
│  Memory System | Provider Agnostic               │
│                                                  │
│  ─── section-divider ───                         │
│                                                  │
│  CODE WALKTHROUGH                                │
│  Three tabbed code examples:                     │
│  [Agent] [Multi-Agent] [Streaming]               │
│  Each in window-chrome card with syntax           │
│  highlighting                                    │
│                                                  │
│  ─── section-divider ───                         │
│                                                  │
│  PACKAGE OVERVIEW                                │
│  13-package grid showing the monorepo             │
│  structure with mini descriptions                 │
│                                                  │
│  ─── section-divider ───                         │
│                                                  │
│  ARCHITECTURE DIAGRAM                            │
│  ExecutionFlowDiagram showing agent loop          │
│  or DependencyGraph showing package layout        │
│                                                  │
│  ─── section-divider ───                         │
│                                                  │
│  QUICK LINKS                                     │
│  4 cards: Getting Started, Guides,                │
│  API Reference, GitHub                            │
│                                                  │
├──────────────────────────────────────────────────┤
│ Footer                                           │
└──────────────────────────────────────────────────┘
```

### 7.2 Hero Section Details

- **Headline**: "Orbiter" in Junicode (italic swash variant on the "O"), `text-6xl sm:text-7xl lg:text-8xl`
- **Subheadline**: "A modern, modular multi-agent framework for Python" in Bricolage Grotesque, `text-xl text-dark/60`
- **CTA buttons**: "Get Started" (primary, links to `/docs/getting-started/`) and "View on GitHub" (bordered)
- **Code card**: The quickstart weather agent example in window-chrome styled code block, overlaying the OrbiterHero illustration
- **Hero entrance**: `.hero-child` class with `--hero-delay` custom property, `heroEntrance` keyframes (0.6s, staggered)

### 7.3 Feature Cards

Each card shows:
- A small SVG icon (custom, matching the warm palette — NOT generic icons)
- Feature name as card heading
- 1-2 sentence description
- All wrapped in `Card.astro` with hover lift

| Feature | Icon concept | Description |
|---------|-------------|-------------|
| Composable Agents | Stacked building blocks | Plain Python objects. Model string, instructions, tools, hooks — compose freely. |
| Type-Safe Tools | Schema diagram | `@tool` auto-generates JSON schemas from signatures and docstrings. Full type checking. |
| Multi-Agent Swarms | Connected nodes | Workflow, handoff, and team modes. Flow DSL: `"researcher >> writer >> reviewer"`. |
| Context Engine | Nested layers | Hierarchical state, composable prompt neurons, workspace artifacts, knowledge retrieval. |
| Memory System | Filing cabinet | Short/long-term memory with SQLite, Postgres, and vector backends. |
| Provider Agnostic | Multiple LLM logos | OpenAI, Anthropic, Gemini, Vertex AI. One interface, any model. |

---

## 8. Documentation Pages

### 8.1 Content Rendering Pipeline

```
docs-source/*.md
  → Astro Content Collection (glob loader)
  → remark plugins:
    1. Extract title from first # heading
    2. Convert > [!TIP] blocks to <Callout> components
    3. Add IDs to headings for TOC linking
    4. Rewrite relative .md links to site routes
  → rehype plugins:
    1. rehype-pretty-code (Shiki syntax highlighting)
    2. Custom code block wrapper (adds window chrome, copy button)
  → DocsLayout template
  → Static HTML
```

### 8.2 Markdown Link Rewriting

Source markdown files contain relative links like `[Concepts](concepts.md)` and `[Context Engine](../guides/context/index.md)`. A remark plugin rewrites these:

- `concepts.md` → `/docs/getting-started/concepts` (relative to current file)
- `../guides/context/index.md` → `/docs/guides/context`
- External URLs (`https://...`) are left unchanged
- `index.md` references are stripped to the directory path

### 8.3 Dynamic Route Generation

```astro
---
// src/pages/docs/[...slug].astro
import { getCollection } from 'astro:content';
import DocsLayout from '../../layouts/DocsLayout.astro';

export async function getStaticPaths() {
  const docs = await getCollection('docs');
  return docs.map((entry) => ({
    params: { slug: entry.slug },
    props: { entry },
  }));
}

const { entry } = Astro.props;
const { Content, headings } = await entry.render();
---

<DocsLayout title={entry.data.title} headings={headings} slug={entry.slug}>
  <Content />
</DocsLayout>
```

### 8.4 Code Block Theming

Custom Shiki theme (warm, matches the design system):

**Light mode** (`orbiter-light`):
```
Background: #f5f3e8 (slightly darker than page paper)
Foreground: #2e2e2e
Comments: #8a8778
Strings: #b5573a (warm coral-adjacent)
Keywords: #6287f5 (zen-blue)
Functions: #F76F53 (coral)
Types: #5a9e6f (warm green)
Numbers: #b5573a
Operators: #2e2e2e/70
```

**Dark mode** (`orbiter-dark`):
```
Background: #161616 (slightly darker than page dark)
Foreground: #d1cfc0
Comments: #6b6960
Strings: #f7956f (warm peach)
Keywords: #7d9ff5 (lightened zen-blue)
Functions: #F76F53 (coral)
Types: #63f78b (zen-green)
Numbers: #f7956f
Operators: #d1cfc0/70
```

---

## 9. Search

### 9.1 Pagefind Integration

[Pagefind](https://pagefind.app/) indexes the built site at build time and produces a static search index:

- **Build step**: `npx pagefind --site dist` runs after `astro build`
- **UI**: Custom search modal (not Pagefind's default UI) matching the design system
- **Trigger**: `Ctrl/Cmd + K` keyboard shortcut, or click the search icon in Navbar
- **Modal**: Centered overlay with `backdrop-blur-sm bg-dark/20`, rounded-xl search input, live results as user types
- **Results**: Show page title, section breadcrumb, and content snippet with highlighted matches
- **Keyboard navigation**: Arrow keys move through results, Enter opens, Escape closes

### 9.2 Search Modal Styling

```
┌─────────────────────────────────────────┐
│ 🔍 Search documentation...    ⌘K       │
├─────────────────────────────────────────┤
│                                         │
│  Getting Started > Quickstart           │
│  ...the @tool decorator auto-generates  │
│  JSON schemas from function...          │
│                                         │
│  Guides > Tools                         │
│  ...FunctionTool wraps any sync or      │
│  async function into a Tool...          │
│                                         │
│  Reference > Core > Tool                │
│  ...class Tool(ABC): Abstract base      │
│  class for all tool implementations...  │
│                                         │
└─────────────────────────────────────────┘
```

- Input: `border-b border-dark/[0.08]`, large text, autofocus
- Results: grouped by section, `text-sm`, highlighted matches in `bg-coral/20 text-coral`
- No results: "No results found" with suggestion to try different keywords

---

## 10. Visual Motifs & Illustrations

### 10.1 Orbital Theme

The "Orbiter" name suggests orbital mechanics. This metaphor is woven throughout:

- **Logo**: Stylized "O" with orbital ring (used in Navbar, favicon, OG image)
- **Hero**: Animated orbital rings with agent nodes
- **Page decorations**: Subtle arc SVGs behind section headers
- **Loading/transition**: Orbital spinner (small ring with orbiting dot)
- **404 page**: "Lost in orbit" illustration with floating astronaut

### 10.2 Concentric Circles

From the marketing site's design language:

- **Footer**: Decorative concentric rings (paper-colored borders at 18% opacity), positioned bottom-right
- **Section backgrounds**: Very subtle concentric arcs as background decoration
- **Diagram nodes**: Agent/tool/concept nodes use concentric circle styling

### 10.3 Window Chrome

The fake browser/app window header pattern:

- Three dots: `h-2.5 w-2.5 rounded-full` in coral/blue/green (muted: `/40` opacity)
- Title bar: `text-[11px] text-dark/40 font-medium` showing filename
- Used on: Code blocks, diagram containers, the hero code example
- `rounded-xl overflow-hidden border border-dark/[0.06]`

### 10.4 Illustration Style Guide

All custom SVG illustrations follow these rules:

- **Palette**: Only `coral`, `zen-blue`, `zen-green`, `dark`, `paper` — never arbitrary colors
- **Opacity**: Heavy use of opacity modifiers (nodes at full, connecting lines at 20-30%, backgrounds at 4-8%)
- **Corners**: `rx="12"` on rectangles (matching `rounded-xl`)
- **Stroke**: `stroke-width="1.5"` for lines, `stroke-linecap="round"`
- **Text**: Bricolage Grotesque for labels inside diagrams
- **Animation**: CSS only, subtle, `prefers-reduced-motion` respected
- **Theme-aware**: All colors use `currentColor` or CSS custom properties so they flip in dark mode

---

## 11. Responsive Behavior

### 11.1 Breakpoints

| Breakpoint | Width | Layout change |
|------------|-------|---------------|
| Default | `< 640px` | Single column, stacked everything |
| `sm` | `≥ 640px` | Slightly wider content padding |
| `md` | `≥ 768px` | Two-column grids where applicable |
| `lg` | `≥ 1024px` | Sidebar visible, three-column docs layout (minus TOC) |
| `xl` | `≥ 1280px` | Full three-column docs layout with TOC |

### 11.2 Mobile Documentation Experience

- **Sidebar**: Hidden by default. Hamburger button (top-left, next to breadcrumbs) opens it as a full-height drawer sliding from the left
- **TOC**: Hidden entirely on mobile. Heading links are still clickable via the rendered heading anchors
- **Code blocks**: Horizontally scrollable with `-webkit-overflow-scrolling: touch`
- **Tables**: Horizontally scrollable wrapper
- **Search**: Full-screen modal on mobile

### 11.3 Touch Targets

All interactive elements meet 44×44px minimum touch target size on mobile. Sidebar links have `py-2` padding. The mobile menu toggle is at least 44px.

---

## 12. Performance Requirements

### 12.1 Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.0s |
| Largest Contentful Paint | < 1.5s |
| Cumulative Layout Shift | < 0.05 |
| Total Blocking Time | < 100ms |
| JavaScript shipped | < 20KB total (Pagefind + theme toggle + scroll spy) |
| Build time (153 pages) | < 30s |

### 12.2 Optimization Strategies

- **Zero JS by default**: Astro ships no JavaScript unless explicitly opted in
- **Font loading**: Preload Bricolage Grotesque (critical), lazy-load Junicode (display only). `font-display: swap`
- **Image optimization**: Astro's built-in `<Image>` component with WebP/AVIF generation
- **Pagefind**: Loads search index only when search modal is opened (lazy)
- **Code highlighting**: Done at build time by Shiki — zero runtime JS for syntax highlighting
- **CSS**: Tailwind purges unused styles. Single CSS file, no render-blocking external sheets beyond the inlined critical path
- **Animations**: CSS-only, hardware-accelerated (`transform`, `opacity`, `filter`)

---

## 13. SEO & Metadata

### 13.1 Per-Page SEO

Every page generates:

- `<title>`: `{page title} — Orbiter Docs` (or just "Orbiter" for landing)
- `<meta name="description">`: From frontmatter `description` or auto-generated from first paragraph
- Open Graph tags: `og:title`, `og:description`, `og:type`, `og:url`, `og:image`
- Twitter card: `twitter:card=summary_large_image`
- Canonical URL
- JSON-LD: `Organization` on landing, `TechArticle` on docs pages, `BreadcrumbList` on all pages

### 13.2 Sitemap & Robots

- `@astrojs/sitemap` generates `sitemap.xml` at build time
- `robots.txt` allows all crawlers
- RSS feed for changelog at `/rss.xml`

---

## 14. Accessibility

- **Skip to content**: `<a href="#main-content" class="sr-only focus:not-sr-only">Skip to content</a>` in BaseLayout
- **Semantic HTML**: `<nav>`, `<main>`, `<article>`, `<aside>`, `<footer>` — proper landmarks
- **Heading hierarchy**: Strictly sequential (`h1` → `h2` → `h3`), no skipping levels
- **Color contrast**: All text meets WCAG AA (4.5:1 for body, 3:1 for large text). The warm palette has been tested: `#2e2e2e` on `#f2f0e3` = 10.8:1 ratio
- **Keyboard navigation**: Full tab navigation through sidebar, TOC, search, code copy buttons. Visible focus rings (`ring-2 ring-coral/50 ring-offset-2 ring-offset-paper`)
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables all animations
- **Screen reader**: ARIA labels on icon-only buttons, `aria-current="page"` on active nav items, `aria-expanded` on collapsible sections
- **Code blocks**: `<pre>` has `tabindex="0"` for keyboard scrolling, `role="region"` with `aria-label`

---

## 15. File Structure

```
orbiter-docs/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── CLAUDE.md
│
├── docs-source/                  ← Documentation source (NOT in src/)
│   ├── index.md
│   ├── getting-started/
│   ├── guides/
│   ├── architecture/
│   ├── reference/
│   ├── contributing/
│   ├── changelog.md
│   ├── migration-guide.md
│   └── migration/
│
├── public/
│   ├── fonts/
│   │   ├── Junicode-Roman.woff2
│   │   └── Junicode-Italic.woff2
│   ├── favicon.svg
│   ├── favicon.ico
│   └── og-image.png
│
└── src/
    ├── content.config.ts         ← Content collection pointing at docs-source/
    │
    ├── styles/
    │   └── global.css            ← Color tokens, font faces, keyframes, prose styles
    │
    ├── layouts/
    │   ├── BaseLayout.astro      ← HTML shell, SEOHead, theme script, animation observer
    │   ├── DocsLayout.astro      ← Navbar + Sidebar + Content + TOC + Footer
    │   └── LandingLayout.astro   ← Navbar + Full-width sections + Footer
    │
    ├── components/
    │   ├── Navbar.astro
    │   ├── MobileMenu.astro
    │   ├── Footer.astro
    │   ├── Sidebar.astro
    │   ├── TableOfContents.astro
    │   ├── Breadcrumbs.astro
    │   ├── PrevNext.astro
    │   ├── SearchModal.astro
    │   ├── SEOHead.astro
    │   │
    │   ├── ui/
    │   │   ├── Button.astro
    │   │   ├── Card.astro
    │   │   ├── Callout.astro
    │   │   ├── PackageTable.astro
    │   │   └── ApiSignature.astro
    │   │
    │   ├── landing/
    │   │   ├── Hero.astro
    │   │   ├── FeatureCards.astro
    │   │   ├── CodeWalkthrough.astro
    │   │   ├── PackageOverview.astro
    │   │   ├── ArchitecturePreview.astro
    │   │   └── QuickLinks.astro
    │   │
    │   └── illustrations/
    │       ├── OrbiterHero.astro
    │       ├── ExecutionFlowDiagram.astro
    │       ├── DependencyGraph.astro
    │       ├── SwarmModeDiagram.astro
    │       └── ContextEngineDiagram.astro
    │
    ├── utils/
    │   ├── merge.ts              ← cn() utility (clsx + tailwind-merge)
    │   ├── seo.ts                ← JSON-LD schema generators
    │   └── navigation.ts         ← Build nav tree from collection entries
    │
    └── pages/
        ├── index.astro           ← Landing page
        ├── 404.astro             ← Custom 404
        └── docs/
            └── [...slug].astro   ← Dynamic catch-all for all docs pages
```

---

## 16. Dependencies

### 16.1 Production Dependencies

```json
{
  "astro": "^5.17.0",
  "@astrojs/sitemap": "^3.x",
  "@tailwindcss/vite": "^4.x",
  "tailwindcss": "^4.x",
  "@fontsource-variable/bricolage-grotesque": "^5.x",
  "clsx": "^2.x",
  "tailwind-merge": "^2.x",
  "shiki": "^1.x"
}
```

### 16.2 Dev Dependencies

```json
{
  "typescript": "^5.x",
  "pagefind": "^1.x",
  "@types/node": "^22.x"
}
```

### 16.3 Astro Integrations (in `astro.config.mjs`)

```javascript
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://orbiter.dev',  // Update with actual domain
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'orbiter-light',
        dark: 'orbiter-dark',
      },
    },
  },
});
```

---

## 17. Implementation Phases

### Phase 1: Foundation (Sessions 1–3)

**Goal**: Base infrastructure — can render a single docs page with correct styling.

| Session | Deliverable |
|---------|-------------|
| 1 | Install dependencies. Configure `astro.config.mjs` with Tailwind v4, sitemap. Create `global.css` with color tokens, font faces, keyframes, prose styles. Create `cn()` utility. |
| 2 | `BaseLayout.astro` (HTML shell, SEOHead, theme script, animation observer). `LandingLayout.astro` shell. `DocsLayout.astro` shell (three-column grid, no sidebar content yet). |
| 3 | Content collection config (`src/content.config.ts`) with glob loader pointing at `docs-source/`. Dynamic route `docs/[...slug].astro`. Remark plugin for title extraction. Verify a single page renders. |

### Phase 2: Navigation & Layout (Sessions 4–6)

**Goal**: Full navigation system — sidebar, breadcrumbs, prev/next.

| Session | Deliverable |
|---------|-------------|
| 4 | `navigation.ts` utility — builds nav tree from collection entries. Section ordering logic. |
| 5 | `Sidebar.astro` — renders nav tree, collapsible sections, current page highlighting. Mobile drawer toggle. |
| 6 | `Breadcrumbs.astro`, `PrevNext.astro`, `TableOfContents.astro` with scroll-spy. |

### Phase 3: Components (Sessions 7–9)

**Goal**: All UI components — Navbar, Footer, code blocks, callouts, buttons, cards.

| Session | Deliverable |
|---------|-------------|
| 7 | `Navbar.astro` (3-col grid, theme toggle, search trigger, GitHub link, responsive). `MobileMenu.astro`. `Footer.astro` (inverted, concentric circle decoration). |
| 8 | Code block custom wrapper (window chrome, copy button, language badge). Custom Shiki themes (`orbiter-light`, `orbiter-dark`). |
| 9 | `Callout.astro` with remark plugin for `> [!TIP]` syntax. `Button.astro`, `Card.astro`, `PackageTable.astro`, `ApiSignature.astro`. |

### Phase 4: Markdown Pipeline (Session 10)

**Goal**: All remark/rehype plugins working, all 153 pages render correctly.

| Session | Deliverable |
|---------|-------------|
| 10 | Remark plugin for markdown link rewriting (`.md` → site routes). Verify all 153 pages render. Fix edge cases (missing frontmatter, nested paths, special characters in headings). |

### Phase 5: Landing Page (Sessions 11–13)

**Goal**: Complete landing page with all sections and illustrations.

| Session | Deliverable |
|---------|-------------|
| 11 | `Hero.astro` with `OrbiterHero.astro` illustration (CSS orbital animation), quickstart code card, CTA buttons, hero entrance animations. |
| 12 | `FeatureCards.astro` (6 feature cards with custom SVG icons). `CodeWalkthrough.astro` (tabbed code examples). |
| 13 | `PackageOverview.astro` (13-package grid). `ArchitecturePreview.astro` with `ExecutionFlowDiagram.astro`. `QuickLinks.astro`. |

### Phase 6: Illustrations (Sessions 14–15)

**Goal**: All SVG diagrams and decorative elements.

| Session | Deliverable |
|---------|-------------|
| 14 | `DependencyGraph.astro`, `SwarmModeDiagram.astro`, `ContextEngineDiagram.astro`. |
| 15 | `SectionDecorator.astro` backgrounds. Favicon and OG image generation. 404 page. |

### Phase 7: Search & Polish (Sessions 16–17)

**Goal**: Pagefind search, final polish, performance audit.

| Session | Deliverable |
|---------|-------------|
| 16 | Pagefind build integration. `SearchModal.astro` with custom UI, keyboard shortcuts, result styling. |
| 17 | Performance audit (Lighthouse). Accessibility audit. Cross-browser testing. Final visual polish pass. Build verification (all 153 pages, no broken links). |

---

## 18. Non-Goals (Explicitly Out of Scope)

- **Versioned documentation**: No multi-version selector. Single version only for now.
- **Interactive playground**: No embedded Python REPL or code execution.
- **User accounts / comments**: Static site, no auth, no user-generated content.
- **Internationalization**: English only.
- **CMS integration**: Content is managed as markdown files, not through a CMS.
- **Server-side rendering**: Fully static output. No SSR, no server functions.
- **React / Vue / Svelte islands**: Zero framework JS. All interactivity is vanilla script or CSS.

---

## 19. Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| All 153 docs render | Zero build errors, all pages accessible |
| Links work | No broken internal links (automated check) |
| Search works | Can find any page by title or content keyword |
| Mobile usable | Sidebar drawer, readable code blocks, touch targets met |
| Performance | Lighthouse score ≥ 95 on all categories |
| Accessibility | WCAG AA compliance, no axe-core violations |
| Visual consistency | Matches design system — warm palette, correct fonts, animation patterns |
| Build speed | < 30 seconds for full 153-page build |
| Zero JS default | Pages load and function with JavaScript disabled (except search) |
