// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import remarkExtractTitle from './src/plugins/remark-extract-title.ts';
import remarkExtractDescription from './src/plugins/remark-extract-description.ts';
import remarkRewriteLinks from './src/plugins/remark-rewrite-links.ts';
import remarkCallouts from './src/plugins/remark-callouts.ts';
import rehypeCodeBlocks from './src/plugins/rehype-code-blocks.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://orbiter.dev',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkExtractTitle, remarkExtractDescription, remarkRewriteLinks, remarkCallouts],
    rehypePlugins: [rehypeCodeBlocks],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
